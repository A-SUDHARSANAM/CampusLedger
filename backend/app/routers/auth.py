# NOTE: This file is NOT registered in main.py and is DEAD CODE.
# The active auth router is app/routers/auth_routes.py (auth_routes_router).
# This file references the legacy `profiles` table via app.core.dependencies
# and has duplicate /auth/login and /auth/refresh endpoints that conflict
# with auth_routes.py. Do NOT import or register this router.

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.core.dependencies import get_current_user
from app.db.supabase import get_admin_client, supabase_anon
from app.schemas.auth import Token, LoginRequest, RefreshTokenRequest, SignUpRequest
from app.schemas.user import UserResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=Token, summary="Login with email and password")
def login(payload: LoginRequest):
    try:
        session = supabase_anon.auth.sign_in_with_password(
            {"email": payload.email, "password": payload.password}
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        ) from exc

    if not session or not session.session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    return Token(
        access_token=session.session.access_token,
        refresh_token=session.session.refresh_token,
    )


@router.post("/refresh", response_model=Token, summary="Refresh access token")
def refresh_token(payload: RefreshTokenRequest):
    try:
        session = supabase_anon.auth.refresh_session(payload.refresh_token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        ) from exc

    if not session or not session.session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
    return Token(
        access_token=session.session.access_token,
        refresh_token=session.session.refresh_token,
    )


@router.post("/logout", summary="Sign out current session")
def logout(current_user: dict = Depends(get_current_user)):
    try:
        supabase_anon.auth.sign_out()
    except Exception:
        pass
    return {"message": "Logged out successfully"}


@router.post(
    "/signup",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user (admin-initiated via service role)",
)
def signup(
    payload: SignUpRequest,
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(get_current_user),  # must be authenticated (admin enforced in users router)
):
    """Creates a Supabase Auth user and the matching profile row."""
    try:
        auth_user = sb.auth.admin.create_user(
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

    user_id = auth_user.user.id
    profile_data = {
        "id": user_id,
        "email": payload.email,
        "full_name": payload.full_name,
        "role": payload.role,
        "phone": payload.phone,
        "department": payload.department,
        "is_active": True,
    }
    result = sb.table("profiles").insert(profile_data).execute()
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user profile",
        )
    return result.data[0]


@router.get("/me", response_model=UserResponse, summary="Get current authenticated user")
def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

