from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class _UserRef(BaseModel):
    id: str
    full_name: str
    email: str


class _AssetRef(BaseModel):
    id: str
    name: str
    asset_tag: str


class MaintenanceBase(BaseModel):
    title: str
    description: Optional[str] = None
    priority: str = "medium"


class MaintenanceCreate(MaintenanceBase):
    asset_id: str


class MaintenanceUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to_id: Optional[str] = None
    resolution_notes: Optional[str] = None
    estimated_cost: Optional[str] = None


class MaintenanceResponse(MaintenanceBase):
    id: str
    status: str
    asset_id: str
    reported_by_id: Optional[str] = None
    assigned_to_id: Optional[str] = None
    resolution_notes: Optional[str] = None
    resolved_at: Optional[datetime] = None
    estimated_cost: Optional[str] = None
    asset: Optional[_AssetRef] = None
    reported_by: Optional[_UserRef] = None
    assigned_to: Optional[_UserRef] = None

    model_config = {"from_attributes": True}
