from typing import Optional, List
from datetime import date
from decimal import Decimal
from pydantic import BaseModel


class _UserRef(BaseModel):
    id: str
    full_name: str
    email: str


class PurchaseOrderItemBase(BaseModel):
    item_name: str
    description: Optional[str] = None
    quantity: int = 1
    unit_price: Optional[Decimal] = None
    total_price: Optional[Decimal] = None
    specifications: Optional[str] = None


class PurchaseOrderItemCreate(PurchaseOrderItemBase):
    pass


class PurchaseOrderItemUpdate(BaseModel):
    item_name: Optional[str] = None
    description: Optional[str] = None
    quantity: Optional[int] = None
    unit_price: Optional[Decimal] = None
    total_price: Optional[Decimal] = None
    received_quantity: Optional[int] = None
    specifications: Optional[str] = None


class PurchaseOrderItemResponse(PurchaseOrderItemBase):
    id: str
    purchase_order_id: str
    received_quantity: int

    model_config = {"from_attributes": True}


class PurchaseOrderBase(BaseModel):
    title: str
    description: Optional[str] = None
    vendor_name: Optional[str] = None
    vendor_contact: Optional[str] = None
    expected_delivery_date: Optional[date] = None
    total_amount: Optional[Decimal] = None


class PurchaseOrderCreate(PurchaseOrderBase):
    items: List[PurchaseOrderItemCreate] = []


class PurchaseOrderUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    vendor_name: Optional[str] = None
    vendor_contact: Optional[str] = None
    expected_delivery_date: Optional[date] = None
    actual_delivery_date: Optional[date] = None
    total_amount: Optional[Decimal] = None
    status: Optional[PurchaseOrderStatus] = None
    rejection_reason: Optional[str] = None


class PurchaseOrderResponse(PurchaseOrderBase):
    id: str
    po_number: str
    status: str
    actual_delivery_date: Optional[date] = None
    rejection_reason: Optional[str] = None
    requested_by_id: Optional[str] = None
    approved_by_id: Optional[str] = None
    requested_by: Optional[_UserRef] = None
    approved_by: Optional[_UserRef] = None
    items: List[PurchaseOrderItemResponse] = []

    model_config = {"from_attributes": True}
