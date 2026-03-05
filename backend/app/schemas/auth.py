from pydantic import BaseModel, EmailStr


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: str
    role: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class SignUpRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str = "lab_technician"
    phone: str | None = None
    department: str | None = None
