from typing import Optional
from jose import JWTError, jwt
from app.core.config import settings


def decode_supabase_token(token: str) -> Optional[dict]:
    """
    Decode and verify a Supabase-issued JWT.
    The secret lives in: Supabase Dashboard → Settings → API → JWT Settings → JWT Secret.
    Supabase uses HS256.
    """
    try:
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},  # Supabase tokens have audience "authenticated"
        )
        return payload
    except JWTError:
        return None

