from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from supabase import Client

from app.routers.auth_routes import require_role
from app.db.supabase import get_admin_client

router = APIRouter(prefix="/users", tags=["Users"])

_require_admin = require_role("admin")

VALID_ROLES = {"admin", "lab_technician", "service_staff", "purchase_dept"}


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class UserOut(BaseModel):
    id: str
    email: str
    name: str                           # DB column is `name` (not full_name)
    role: Optional[str] = None          # resolved via JOIN with roles table
    status: str = "pending"             # 'active' | 'pending'
    department_id: Optional[str] = None
    created_at: Optional[str] = None
    # Derived fields kept for frontend compatibility
    is_approved: Optional[bool] = None
    is_active: Optional[bool] = None


class UpdateRoleRequest(BaseModel):
    role: str

    def validate_role(self) -> None:
        if self.role not in VALID_ROLES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"role must be one of: {', '.join(sorted(VALID_ROLES))}",
            )


# ---------------------------------------------------------------------------
# Helper: flatten role JOIN and derive is_active / is_approved from status
# ---------------------------------------------------------------------------
def _enrich_user(row: dict) -> dict:
    row = dict(row)
    roles_obj = row.pop("roles", None) or {}
    row["role"] = roles_obj.get("role_name", row.get("role", ""))
    is_active = row.get("status") == "active"
    row["is_active"] = is_active
    row["is_approved"] = is_active
    return row


# ---------------------------------------------------------------------------
# GET /users
# ---------------------------------------------------------------------------
@router.get("/", response_model=List[UserOut], summary="List all users (admin only)")
def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    role: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    is_approved: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_admin),
):
    if role and role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"role must be one of: {', '.join(sorted(VALID_ROLES))}",
        )

    q = (
        sb.table("users")
        .select("*, roles(role_name)")
        .range(skip, skip + limit - 1)
        .order("created_at", desc=True)
    )

    # Filter by role: resolve role_id from the roles lookup table
    if role:
        role_res = sb.table("roles").select("id").eq("role_name", role).limit(1).execute()
        if role_res.data:
            q = q.eq("role_id", role_res.data[0]["id"])
        else:
            return []

    # Map is_active / is_approved query params → status column
    if is_active is not None or is_approved is not None:
        active_flag = is_active if is_active is not None else is_approved
        q = q.eq("status", "active" if active_flag else "pending")

    # Search by name or email
    if search:
        q = q.or_(f"name.ilike.%{search}%,email.ilike.%{search}%")

    result = q.execute()
    return [_enrich_user(row) for row in (result.data or [])]


# ---------------------------------------------------------------------------
# GET /users/{user_id}
# ---------------------------------------------------------------------------
@router.get("/{user_id}", response_model=UserOut, summary="Get user by ID (admin only)")
def get_user(
    user_id: str,
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_admin),
):
    result = (
        sb.table("users")
        .select("*, roles(role_name)")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return _enrich_user(dict(result.data))


# ---------------------------------------------------------------------------
# PUT /users/{user_id}/approve
# ---------------------------------------------------------------------------
@router.put("/{user_id}/approve", response_model=UserOut, summary="Approve a user (admin only)")
def approve_user(
    user_id: str,
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_admin),
):
    existing = (
        sb.table("users")
        .select("id, status, roles(role_name)")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if existing.data.get("status") == "active":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User is already approved")
    result = sb.table("users").update({"status": "active"}).eq("id", user_id).execute()
    row = dict(result.data[0])
    row["roles"] = existing.data.get("roles")
    return _enrich_user(row)


# ---------------------------------------------------------------------------
# PUT /users/{user_id}/role
# ---------------------------------------------------------------------------
@router.put("/{user_id}/role", response_model=UserOut, summary="Update user role (admin only)")
def update_role(
    user_id: str,
    payload: UpdateRoleRequest,
    sb: Client = Depends(get_admin_client),
    current_admin: dict = Depends(_require_admin),
):
    payload.validate_role()
    if current_admin["id"] == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admins cannot change their own role",
        )
    existing = sb.table("users").select("id").eq("id", user_id).maybe_single().execute()
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    # Resolve role_id by role name
    role_res = sb.table("roles").select("id").eq("role_name", payload.role).limit(1).execute()
    if not role_res.data:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Role '{payload.role}' not found in database",
        )
    result = (
        sb.table("users")
        .update({"role_id": role_res.data[0]["id"]})
        .eq("id", user_id)
        .execute()
    )
    row = dict(result.data[0])
    row["roles"] = {"role_name": payload.role}
    return _enrich_user(row)


# ---------------------------------------------------------------------------
# DELETE /users/{user_id}  -- soft delete (sets is_active = False)
# ---------------------------------------------------------------------------
@router.delete("/{user_id}", response_model=UserOut, summary="Deactivate a user (admin only)")
def deactivate_user(
    user_id: str,
    sb: Client = Depends(get_admin_client),
    current_admin: dict = Depends(_require_admin),
):
    if current_admin["id"] == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admins cannot deactivate their own account",
        )
    existing = (
        sb.table("users")
        .select("id, status, roles(role_name)")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if existing.data.get("status") != "active":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User is already deactivated")
    result = sb.table("users").update({"status": "pending"}).eq("id", user_id).execute()
    row = dict(result.data[0])
    row["roles"] = existing.data.get("roles")
    return _enrich_user(row)
