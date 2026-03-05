from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator
import re


class UserRole:
    admin = "admin"
    lab_technician = "lab_technician"
    service_staff = "service_staff"
    purchase_dept = "purchase_dept"


class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: str = "lab_technician"
    phone: Optional[str] = None
    department: Optional[str] = None


class UserCreate(UserBase):
    password: str

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        return v


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: Optional[bool] = None
    role: Optional[str] = None


class UserChangePassword(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        return v


class UserResponse(UserBase):
    id: str
    is_active: bool
    avatar_url: Optional[str] = None

    model_config = {"from_attributes": True}


class UserListResponse(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    role: str
    is_active: bool
    department: Optional[str] = None

    model_config = {"from_attributes": True}
