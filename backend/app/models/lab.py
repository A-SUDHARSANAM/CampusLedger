from sqlalchemy import Column, String, Text, ForeignKey, Integer, Boolean
from sqlalchemy.orm import relationship
from app.db.base import Base


class Lab(Base):
    __tablename__ = "labs"

    name = Column(String(200), nullable=False)
    lab_code = Column(String(50), unique=True, index=True, nullable=False)
    location = Column(String(255), nullable=True)
    building = Column(String(100), nullable=True)
    floor = Column(String(50), nullable=True)
    description = Column(Text, nullable=True)
    capacity = Column(Integer, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)

    technician_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    technician = relationship("User", foreign_keys=[technician_id], lazy="select")
    assets = relationship("Asset", back_populates="lab", lazy="dynamic")

    technician_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    technician = relationship("User", foreign_keys=[technician_id], lazy="select")
    assets = relationship("Asset", back_populates="lab", lazy="dynamic")
