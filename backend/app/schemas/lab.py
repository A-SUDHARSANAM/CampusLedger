from typing import Optional
from pydantic import BaseModel


class UserListResponse(BaseModel):
    id: str
    full_name: str
    email: str
    role: str


class LabBase(BaseModel):
    name: str
    lab_code: str
    location: Optional[str] = None
    building: Optional[str] = None
    floor: Optional[str] = None
    description: Optional[str] = None
    capacity: Optional[int] = None


class LabCreate(LabBase):
    technician_id: Optional[str] = None


class LabUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    building: Optional[str] = None
    floor: Optional[str] = None
    description: Optional[str] = None
    capacity: Optional[int] = None
    technician_id: Optional[str] = None
    is_active: Optional[bool] = None


class LabResponse(LabBase):
    id: str
    is_active: bool
    technician_id: Optional[str] = None
    technician: Optional[UserListResponse] = None

    model_config = {"from_attributes": True}
