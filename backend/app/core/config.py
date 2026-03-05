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

    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8081",
    ]

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
