"""
auth_routes.py
==============
Authentication endpoints for CampusLedger.

Endpoints
---------
POST /auth/register   – self-register a new user
POST /auth/login      – sign in and receive JWT tokens + user profile
GET  /auth/me         – return the authenticated user's profile

Importable helpers
------------------
from app.routers.auth_routes import get_current_user, require_role
"""

from __future__ import annotations

import os
from typing import Annotated, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, field_validator
from supabase import Client, create_client

load_dotenv()

# ---------------------------------------------------------------------------
# Supabase clients
#   - anon_client  → used for sign-in / sign-up (respects RLS)
#   - admin_client → service-role, bypasses RLS; used for user reads/writes
# ---------------------------------------------------------------------------
_SUPABASE_URL: str = os.environ["SUPABASE_URL"]
_SUPABASE_KEY: str = os.environ["SUPABASE_KEY"]                       # anon key
_SERVICE_KEY: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", _SUPABASE_KEY)

anon_client: Client = create_client(_SUPABASE_URL, _SUPABASE_KEY)
admin_client: Client = create_client(_SUPABASE_URL, _SERVICE_KEY)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
VALID_ROLES = {"admin", "lab_technician", "service_staff", "purchase_dept"}

router = APIRouter(prefix="/auth", tags=["Authentication"])
_bearer = HTTPBearer()


# ===========================================================================
# Pydantic schemas
# ===========================================================================

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "lab_technician"
    dept_name: Optional[str] = None

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in VALID_ROLES:
            raise ValueError(f"role must be one of {sorted(VALID_ROLES)}")
        return v

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("password must be at least 6 characters")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginUser(BaseModel):
    id: str
    email: str
    name: str
    role: str
    dept_name: Optional[str] = None
    lab_id: Optional[str] = None


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: LoginUser


class RefreshRequest(BaseModel):
    refresh_token: str


class RefreshResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserProfile(BaseModel):
    id: str
    email: str
    name: str
    role: str
    dept_name: Optional[str] = None
    status: str


# ===========================================================================
# Internal helper: fetch user + role from DB
# ===========================================================================

def _fetch_user_profile(user_id: str) -> dict:
    """Query public.users joined with roles and departments."""
    result = (
        admin_client
        .table("users")
        .select("*, roles(role_name), departments(department_name)")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    if not result.data or len(result.data) == 0:
        return {}
    row: dict = dict(result.data[0])
    roles_obj = row.pop("roles", None) or {}
    depts_obj = row.pop("departments", None) or {}
    row["role"] = roles_obj.get("role_name", "")
    row["dept_name"] = depts_obj.get("department_name", "")

    # Fallback: if the FK join returned null (schema cache miss or stale FK),
    # look up the role directly using the stored role_id.
    if not row["role"] and row.get("role_id"):
        try:
            role_res = (
                admin_client
                .table("roles")
                .select("role_name")
                .eq("id", row["role_id"])
                .limit(1)
                .execute()
            )
            if role_res.data:
                row["role"] = role_res.data[0]["role_name"]
        except Exception:
            pass

    return row


# ===========================================================================
# Dependency: get_current_user
# ===========================================================================

def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
) -> dict:
    """
    FastAPI dependency.

    Validates the Supabase Bearer JWT by calling Supabase's own auth server,
    then fetches the matching row from ``public.users`` (joined with roles).

    Raises 401 for invalid/expired tokens and 403 for inactive accounts.
    """
    token = credentials.credentials

    # ── Validate token via Supabase (handles HS256 and ES256 alike) ──────────
    # Retry once on connection errors (HTTP/2 stream termination can cause
    # transient failures when many requests happen concurrently).
    user_id: Optional[str] = None
    last_exc: Optional[Exception] = None
    for _attempt in range(2):
        try:
            user_resp = admin_client.auth.get_user(token)
            user_id = user_resp.user.id if user_resp and user_resp.user else None
            break  # success – exit the retry loop
        except Exception as exc:
            last_exc = exc
            err_lower = str(exc).lower()
            # Retry only for transient connection / protocol errors
            if any(kw in err_lower for kw in ("connection", "protocol", "terminated", "stream")):
                import time
                time.sleep(0.05)
                continue
            break  # non-connection error – no point retrying

    if last_exc is not None and user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from last_exc

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: missing subject",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # ── Fetch user from public.users ─────────────────────────────────────────
    profile = _fetch_user_profile(user_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    if profile.get("status") != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is pending approval or disabled. Contact your administrator.",
        )

    return profile


# ===========================================================================
# Helper: require_role
# ===========================================================================

def require_role(*roles: str):
    """
    Returns a FastAPI dependency that enforces one or more allowed roles.

    Usage::

        @router.delete("/labs/{id}")
        def delete_lab(user: dict = Depends(require_role("admin"))):
            ...

        @router.get("/assets")
        def list_assets(user: dict = Depends(require_role("admin", "lab_technician"))):
            ...
    """
    allowed = set(roles)
    unknown = allowed - VALID_ROLES
    if unknown:
        raise ValueError(f"Unknown roles passed to require_role: {unknown}")

    def _checker(current_user: Annotated[dict, Depends(get_current_user)]) -> dict:
        if current_user.get("role") not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access restricted to: {', '.join(sorted(allowed))}",
            )
        return current_user

    return _checker


# ===========================================================================
# POST /auth/register
# ===========================================================================

@router.post(
    "/register",
    response_model=UserProfile,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
    description="Creates a Supabase Auth user and the corresponding row in public.users.",
)
def register(payload: RegisterRequest) -> dict:
    # ── Look up role_id from roles table ─────────────────────────────────────
    role_result = (
        admin_client
        .table("roles")
        .select("id")
        .eq("role_name", payload.role)
        .limit(1)
        .execute()
    )
    if not role_result.data or len(role_result.data) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role '{payload.role}' not found in database",
        )
    role_id: str = role_result.data[0]["id"]

    # ── Check if email already registered ────────────────────────────────────
    existing = (
        admin_client
        .table("users")
        .select("id")
        .eq("email", payload.email)
        .limit(1)
        .execute()
    )
    if existing.data and len(existing.data) > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    # ── Create the Supabase Auth user ────────────────────────────────────────
    try:
        auth_resp = admin_client.auth.admin.create_user(
            {
                "email": payload.email,
                "password": payload.password,
                "email_confirm": True,
            }
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Could not create auth user: {exc}",
        ) from exc

    new_id: str = auth_resp.user.id

    # ── Resolve department (create if new name given) ────────────────────────
    department_id: Optional[str] = None
    dept_name_stored: str = ""
    if payload.dept_name and payload.dept_name.strip():
        dept_name_clean = payload.dept_name.strip()
        dept_res = (
            admin_client
            .table("departments")
            .select("id, department_name")
            .ilike("department_name", dept_name_clean)
            .limit(1)
            .execute()
        )
        if dept_res.data and len(dept_res.data) > 0:
            department_id = dept_res.data[0]["id"]
            dept_name_stored = dept_res.data[0]["department_name"]
        else:
            new_dept = admin_client.table("departments").insert({"department_name": dept_name_clean}).execute()
            if new_dept.data:
                department_id = new_dept.data[0]["id"]
                dept_name_stored = dept_name_clean

    # ── Insert into public.users with matching UUID ───────────────────────────
    user_row: dict = {
        "id": new_id,
        "name": payload.name,
        "email": payload.email,
        "role_id": role_id,
        "status": "active",
    }
    if department_id:
        user_row["department_id"] = department_id

    result = admin_client.table("users").insert(user_row).execute()

    if not result.data:
        # Roll back the auth user to keep stores consistent
        try:
            admin_client.auth.admin.delete_user(new_id)
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user record",
        )

    row = result.data[0]
    return {
        "id": row["id"],
        "email": row["email"],
        "name": row["name"],
        "role": payload.role,
        "dept_name": dept_name_stored,
        "status": row["status"],
    }


# ===========================================================================
# POST /auth/login
# ===========================================================================

@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Login and receive JWT tokens with user profile",
    description="Authenticates with Supabase Auth and returns tokens plus the user's profile.",
)
def login(payload: LoginRequest) -> dict:
    try:
        session_resp = anon_client.auth.sign_in_with_password(
            {"email": payload.email, "password": payload.password}
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    if not session_resp or not session_resp.session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # ── Fetch user profile from public.users ─────────────────────────────────
    user_id: str = session_resp.user.id
    profile = _fetch_user_profile(user_id)

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found. Please register first.",
        )

    if profile.get("status") != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is pending approval or disabled. Contact your administrator.",
        )

    return {
        "access_token": session_resp.session.access_token,
        "refresh_token": session_resp.session.refresh_token,
        "token_type": "bearer",
        "user": {
            "id": profile["id"],
            "email": profile["email"],
            "name": profile["name"],
            "role": profile["role"],
            "dept_name": profile.get("dept_name"),
            "lab_id": profile.get("lab_id"),
        },
    }


# ===========================================================================
# POST /auth/refresh
# ===========================================================================

@router.post(
    "/refresh",
    response_model=RefreshResponse,
    summary="Refresh access token using a refresh token",
    description="Exchanges a valid Supabase refresh token for a new access/refresh token pair.",
)
def refresh_token(payload: RefreshRequest) -> dict:
    try:
        session_resp = anon_client.auth.refresh_session(payload.refresh_token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    if not session_resp or not session_resp.session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not refresh session",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return {
        "access_token": session_resp.session.access_token,
        "refresh_token": session_resp.session.refresh_token,
        "token_type": "bearer",
    }


# ===========================================================================
# GET /auth/me
# ===========================================================================
# ===========================================================================

@router.get(
    "/me",
    response_model=UserProfile,
    summary="Get the currently authenticated user",
    description="Returns the profile of the user whose Bearer token is provided.",
)
def get_me(
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    return current_user
