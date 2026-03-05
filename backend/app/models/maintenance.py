import enum
from sqlalchemy import Column, String, Text, ForeignKey, Integer, DateTime, Enum
from sqlalchemy.orm import relationship
from app.db.base import Base


class MaintenanceStatus(str, enum.Enum):
    pending = "pending"
    assigned = "assigned"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"


class MaintenancePriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class MaintenanceRequest(Base):
    __tablename__ = "maintenance_requests"

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Enum(MaintenanceStatus), nullable=False, default=MaintenanceStatus.pending)
    priority = Column(Enum(MaintenancePriority), nullable=False, default=MaintenancePriority.medium)
    resolution_notes = Column(Text, nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    estimated_cost = Column(String(50), nullable=True)

    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)
    reported_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigned_to_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    asset = relationship("Asset", back_populates="maintenance_requests", lazy="select")
    reported_by = relationship("User", foreign_keys=[reported_by_id], lazy="select")
    assigned_to = relationship("User", foreign_keys=[assigned_to_id], lazy="select")
