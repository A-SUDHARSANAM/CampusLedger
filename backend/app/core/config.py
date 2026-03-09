from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "CampusLedger"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Supabase
    SUPABASE_URL: str = "https://your-project.supabase.co"
    SUPABASE_ANON_KEY: str = "your-anon-key"
    SUPABASE_SERVICE_ROLE_KEY: str = "your-service-role-key"
    SUPABASE_KEY: str = ""          # alias used by supabase_client.py
    # Supabase JWT secret — Project Settings → API → JWT Settings → JWT Secret
    SUPABASE_JWT_SECRET: str = "your-supabase-jwt-secret"

    # Direct PostgreSQL connection (via Supabase connection string)
    DATABASE_URL: str = ""

    # OpenAI
    OPENAI_API_KEY: str = ""

    # Frontend base URL (used for QR code URL generation)
    FRONTEND_URL: str = "http://localhost:5173"

    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8081",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8081",
    ]

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
