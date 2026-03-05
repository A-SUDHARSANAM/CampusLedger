from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import Client

from app.core.security import decode_supabase_token
from app.db.supabase import get_admin_client

bearer_scheme = HTTPBearer()

# ---------------------------------------------------------------------------
# Valid role constants (matches the role column in the `profiles` table)
# ---------------------------------------------------------------------------
ROLE_ADMIN = "admin"
ROLE_LAB_TECHNICIAN = "lab_technician"
ROLE_SERVICE_STAFF = "service_staff"
ROLE_PURCHASE_DEPT = "purchase_dept"
ALL_ROLES = {ROLE_ADMIN, ROLE_LAB_TECHNICIAN, ROLE_SERVICE_STAFF, ROLE_PURCHASE_DEPT}


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    sb: Client = Depends(get_admin_client),
) -> dict:
    """
    Validates the Bearer JWT (issued by Supabase Auth) and returns the user
    profile row from the `profiles` table.

    The `profiles` table must have:  id (uuid, FK → auth.users.id), role, full_name,
    is_active, email, phone, department, avatar_url, created_at, updated_at.
    """
    token = credentials.credentials
    payload = decode_supabase_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id: Optional[str] = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: missing subject",
        )

    result = sb.table("profiles").select("*").eq("id", user_id).maybe_single().execute()
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User profile not found",
        )

    profile: dict = result.data
    if not profile.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled. Contact administrator.",
        )
    return profile


# ---------------------------------------------------------------------------
# Role-based access control
# ---------------------------------------------------------------------------

class RoleChecker:
    """Callable dependency that enforces role restrictions."""

    def __init__(self, allowed_roles: set[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: dict = Depends(get_current_user)) -> dict:
        if current_user.get("role") not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Operation not permitted for your role",
            )
        return current_user


# Pre-built role guards
require_admin = RoleChecker({ROLE_ADMIN})
require_admin_or_purchase = RoleChecker({ROLE_ADMIN, ROLE_PURCHASE_DEPT})
require_admin_or_lab = RoleChecker({ROLE_ADMIN, ROLE_LAB_TECHNICIAN})
require_admin_or_service = RoleChecker({ROLE_ADMIN, ROLE_SERVICE_STAFF})
require_any_role = RoleChecker(ALL_ROLES)

