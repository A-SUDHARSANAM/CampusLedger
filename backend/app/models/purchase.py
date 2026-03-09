import enum
from sqlalchemy import Column, String, Text, ForeignKey, Integer, Date, Numeric, Enum
from sqlalchemy.orm import relationship
from app.db.base import Base


class PurchaseOrderStatus(str, enum.Enum):
    draft = "draft"
    pending_approval = "pending_approval"
    approved = "approved"
    ordered = "ordered"
    partially_received = "partially_received"
    received = "received"
    rejected = "rejected"
    cancelled = "cancelled"


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    po_number = Column(String(100), unique=True, index=True, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    purchase_department_name = Column(String(255), nullable=True)
    purchase_department_contact = Column(String(255), nullable=True)
    status = Column(Enum(PurchaseOrderStatus), nullable=False, default=PurchaseOrderStatus.draft)
    total_amount = Column(Numeric(14, 2), nullable=True)
    expected_delivery_date = Column(Date, nullable=True)
    actual_delivery_date = Column(Date, nullable=True)
    rejection_reason = Column(Text, nullable=True)

    requested_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    requested_by = relationship("User", foreign_keys=[requested_by_id], lazy="select")
    approved_by = relationship("User", foreign_keys=[approved_by_id], lazy="select")
    items = relationship("PurchaseOrderItem", back_populates="purchase_order", cascade="all, delete-orphan")


class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"

    purchase_order_id = Column(Integer, ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False)
    item_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    quantity = Column(Integer, nullable=False, default=1)
    unit_price = Column(Numeric(12, 2), nullable=True)
    total_price = Column(Numeric(12, 2), nullable=True)
    received_quantity = Column(Integer, nullable=False, default=0)
    specifications = Column(Text, nullable=True)

    purchase_order = relationship("PurchaseOrder", back_populates="items")
