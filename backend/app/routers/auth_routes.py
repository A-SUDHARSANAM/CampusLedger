"""
auth_routes.py
==============
Authentication endpoints for CampusLedger.

Endpoints
---------
POST /auth/register   – create a new user (admin only)
POST /auth/login      – sign in and receive JWT tokens
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
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr, field_validator
from supabase import Client, create_client

load_dotenv()

# ---------------------------------------------------------------------------
# Supabase clients
#   - anon_client  → used for sign-in / sign-up (respects RLS)
#   - admin_client → service-role, bypasses RLS; used for profile reads/writes
# ---------------------------------------------------------------------------
_SUPABASE_URL: str = os.environ["SUPABASE_URL"]
_SUPABASE_KEY: str = os.environ["SUPABASE_KEY"]                       # anon key
_SERVICE_KEY: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", _SUPABASE_KEY)
_JWT_SECRET: str = os.environ.get("SUPABASE_JWT_SECRET", "")

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
    full_name: str
    role: str = "lab_technician"
    phone: Optional[str] = None
    department: Optional[str] = None

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in VALID_ROLES:
            raise ValueError(f"role must be one of {sorted(VALID_ROLES)}")
        return v

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("password must be at least 8 characters")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserProfile(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    phone: Optional[str] = None
    department: Optional[str] = None
    avatar_url: Optional[str] = None


# ===========================================================================
# Dependency: get_current_user
# ===========================================================================

def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
) -> dict:
    """
    FastAPI dependency.

    Decodes the Supabase Bearer JWT, then fetches and returns the matching
    row from the ``profiles`` table.

    Raises 401 for invalid / expired tokens and 403 for disabled accounts.

    Usage::

        @router.get("/protected")
        def protected(user: dict = Depends(get_current_user)):
            return {"hello": user["full_name"]}
    """
    token = credentials.credentials

    # ── Decode & verify the Supabase JWT ────────────────────────────────────
    try:
        payload: dict = jwt.decode(
            token,
            _JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user_id: Optional[str] = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: missing subject",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # ── Fetch profile from Supabase ──────────────────────────────────────────
    result = admin_client.table("profiles").select("*").eq("id", user_id).maybe_single().execute()
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User profile not found",
        )

    profile: dict = result.data
    if not profile.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled. Contact your administrator.",
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
    summary="Register a new user (admin only)",
    description=(
        "Creates a Supabase Auth user and the corresponding profile row. "
        "Only an authenticated **admin** may call this endpoint."
    ),
)
def register(
    payload: RegisterRequest,
    current_user: Annotated[dict, Depends(require_role("admin"))],
) -> dict:
    # ── Create the Supabase Auth user ────────────────────────────────────────
    try:
        auth_resp = admin_client.auth.admin.create_user(
            {
                "email": payload.email,
                "password": payload.password,
                "email_confirm": True,   # skip confirmation email in admin flow
            }
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Could not create auth user: {exc}",
        ) from exc

    new_id: str = auth_resp.user.id

    # ── Insert profile row ───────────────────────────────────────────────────
    profile_data = {
        "id": new_id,
        "email": payload.email,
        "full_name": payload.full_name,
        "role": payload.role,
        "is_active": True,
        "phone": payload.phone,
        "department": payload.department,
    }
    # Remove None values so DB defaults apply
    profile_data = {k: v for k, v in profile_data.items() if v is not None}

    result = admin_client.table("profiles").insert(profile_data).execute()
    if not result.data:
        # Roll back the auth user to keep both stores consistent
        try:
            admin_client.auth.admin.delete_user(new_id)
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user profile",
        )

    return result.data[0]


# ===========================================================================
# POST /auth/login
# ===========================================================================

@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login and receive JWT tokens",
    description="Authenticates with Supabase Auth and returns access + refresh tokens.",
)
def login(payload: LoginRequest) -> TokenResponse:
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

    # Enforce is_active check at login time
    user_id: str = session_resp.user.id
    profile = admin_client.table("profiles").select("is_active").eq("id", user_id).maybe_single().execute()
    if profile.data and not profile.data.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled. Contact your administrator.",
        )

    return TokenResponse(
        access_token=session_resp.session.access_token,
        refresh_token=session_resp.session.refresh_token,
    )


# ===========================================================================
# GET /auth/me
# ===========================================================================

@router.get(
    "/me",
    response_model=UserProfile,
    summary="Get the currently authenticated user",
    description="Returns the full profile of the user whose Bearer token is provided.",
)
def get_me(
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    return current_user
