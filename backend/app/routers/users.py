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
    full_name: str
    role: str
    is_active: bool
    is_approved: bool
    phone: Optional[str] = None
    department: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: Optional[str] = None


class UpdateRoleRequest(BaseModel):
    role: str

    def validate_role(self) -> None:
        if self.role not in VALID_ROLES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"role must be one of: {', '.join(sorted(VALID_ROLES))}",
            )


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
    q = sb.table("users").select("*").range(skip, skip + limit - 1).order("created_at", desc=True)
    if role:
        q = q.eq("role", role)
    if is_active is not None:
        q = q.eq("is_active", is_active)
    if is_approved is not None:
        q = q.eq("is_approved", is_approved)
    if search:
        q = q.or_(f"full_name.ilike.%{search}%,email.ilike.%{search}%")
    result = q.execute()
    return result.data or []


# ---------------------------------------------------------------------------
# GET /users/{user_id}
# ---------------------------------------------------------------------------
@router.get("/{user_id}", response_model=UserOut, summary="Get user by ID (admin only)")
def get_user(
    user_id: str,
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_admin),
):
    result = sb.table("users").select("*").eq("id", user_id).maybe_single().execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return result.data


# ---------------------------------------------------------------------------
# PUT /users/{user_id}/approve
# ---------------------------------------------------------------------------
@router.put("/{user_id}/approve", response_model=UserOut, summary="Approve a user (admin only)")
def approve_user(
    user_id: str,
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_admin),
):
    existing = sb.table("users").select("id, is_approved").eq("id", user_id).maybe_single().execute()
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if existing.data.get("is_approved"):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User is already approved")
    result = sb.table("users").update({"is_approved": True, "is_active": True}).eq("id", user_id).execute()
    return result.data[0]


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
    result = sb.table("users").update({"role": payload.role}).eq("id", user_id).execute()
    return result.data[0]


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
    existing = sb.table("users").select("id, is_active").eq("id", user_id).maybe_single().execute()
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not existing.data.get("is_active", True):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User is already deactivated")
    result = sb.table("users").update({"is_active": False}).eq("id", user_id).execute()
    return result.data[0]
