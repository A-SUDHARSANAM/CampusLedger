from sqlalchemy import Column, String, Text, ForeignKey, Integer, Boolean, Enum
from sqlalchemy.orm import relationship
import enum
from app.db.base import Base


class NotificationType(str, enum.Enum):
    info = "info"
    warning = "warning"
    success = "success"
    error = "error"
    maintenance = "maintenance"
    purchase = "purchase"
    asset = "asset"


class Notification(Base):
    __tablename__ = "notifications"

    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(Enum(NotificationType), nullable=False, default=NotificationType.info)
    is_read = Column(Boolean, nullable=False, default=False)
    link = Column(String(500), nullable=True)

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    user = relationship("User", lazy="select")
