from supabase import create_client, Client
from app.core.config import settings

# ── Public (anon) client ──────────────────────────────────────────────────────
# Used for auth operations (sign-in, sign-up, token refresh).
supabase_anon: Client = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_ANON_KEY,
)

# ── Admin (service-role) client ───────────────────────────────────────────────
# Bypasses Row Level Security — use ONLY on the server, never expose to clients.
supabase_admin: Client = create_client(
    settings.SUPABASE_URL,
    settings.SUPABASE_SERVICE_ROLE_KEY,
)


def get_admin_client() -> Client:
    """FastAPI dependency — yields the service-role Supabase client."""
    return supabase_admin
