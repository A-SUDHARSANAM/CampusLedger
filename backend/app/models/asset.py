import enum
from sqlalchemy import Column, String, Text, ForeignKey, Integer, Date, Numeric, Enum
from sqlalchemy.orm import relationship
from app.db.base import Base


class AssetStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    under_maintenance = "under_maintenance"
    disposed = "disposed"
    lost = "lost"


class AssetCategory(str, enum.Enum):
    electronics = "electronics"
    furniture = "furniture"
    lab_equipment = "lab_equipment"
    computers = "computers"
    networking = "networking"
    software = "software"
    other = "other"


class Asset(Base):
    __tablename__ = "assets"

    name = Column(String(255), nullable=False)
    asset_tag = Column(String(100), unique=True, index=True, nullable=False)
    serial_number = Column(String(100), unique=True, nullable=True)
    category = Column(Enum(AssetCategory), nullable=False, default=AssetCategory.other)
    status = Column(Enum(AssetStatus), nullable=False, default=AssetStatus.active)
    description = Column(Text, nullable=True)
    model = Column(String(200), nullable=True)
    manufacturer = Column(String(200), nullable=True)
    purchase_date = Column(Date, nullable=True)
    warranty_expiry = Column(Date, nullable=True)
    purchase_price = Column(Numeric(12, 2), nullable=True)
    lifecycle_years = Column(Integer, nullable=True, default=5)
    location_detail = Column(String(255), nullable=True)
    qr_code = Column(String(500), nullable=True)
    image_url = Column(String(500), nullable=True)

    lab_id = Column(Integer, ForeignKey("labs.id", ondelete="SET NULL"), nullable=True)
    purchase_order_id = Column(Integer, ForeignKey("purchase_orders.id", ondelete="SET NULL"), nullable=True)
    assigned_to_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    lab = relationship("Lab", back_populates="assets", lazy="select")
    assigned_to = relationship("User", foreign_keys=[assigned_to_id], lazy="select")
    maintenance_requests = relationship("MaintenanceRequest", back_populates="asset", lazy="dynamic")
