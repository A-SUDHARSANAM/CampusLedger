from typing import Optional
from datetime import date
from decimal import Decimal
from pydantic import BaseModel


class AssetStatus:
    active = "active"
    inactive = "inactive"
    under_maintenance = "under_maintenance"
    disposed = "disposed"
    lost = "lost"


class AssetCategory:
    electronics = "electronics"
    furniture = "furniture"
    lab_equipment = "lab_equipment"
    computers = "computers"
    networking = "networking"
    software = "software"
    other = "other"


class _UserListResponse(BaseModel):
    id: str
    full_name: str
    email: str
    role: str


class AssetBase(BaseModel):
    name: str
    asset_tag: str
    serial_number: Optional[str] = None
    category: str = "other"
    status: str = "active"
    description: Optional[str] = None
    model: Optional[str] = None
    manufacturer: Optional[str] = None
    purchase_date: Optional[date] = None
    warranty_expiry: Optional[date] = None
    purchase_price: Optional[Decimal] = None
    lifecycle_years: Optional[int] = 5
    location_detail: Optional[str] = None


class AssetCreate(AssetBase):
    lab_id: Optional[str] = None
    purchase_order_id: Optional[str] = None
    assigned_to_id: Optional[str] = None


class AssetUpdate(BaseModel):
    name: Optional[str] = None
    serial_number: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    description: Optional[str] = None
    model: Optional[str] = None
    manufacturer: Optional[str] = None
    purchase_date: Optional[date] = None
    warranty_expiry: Optional[date] = None
    purchase_price: Optional[Decimal] = None
    lifecycle_years: Optional[int] = None
    location_detail: Optional[str] = None
    lab_id: Optional[str] = None
    assigned_to_id: Optional[str] = None
    image_url: Optional[str] = None
    qr_code: Optional[str] = None


class AssetResponse(AssetBase):
    id: str
    lab_id: Optional[str] = None
    purchase_order_id: Optional[str] = None
    assigned_to_id: Optional[str] = None
    image_url: Optional[str] = None
    qr_code: Optional[str] = None
    assigned_to: Optional[_UserListResponse] = None

    model_config = {"from_attributes": True}


class AssetListResponse(BaseModel):
    id: str
    name: str
    asset_tag: str
    category: str
    status: str
    lab_id: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None

    model_config = {"from_attributes": True}
