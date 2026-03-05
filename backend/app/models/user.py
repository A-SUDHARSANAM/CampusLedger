import enum
from sqlalchemy import Column, String, Boolean, Enum
from app.db.base import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    lab_technician = "lab_technician"
    service_staff = "service_staff"
    purchase_dept = "purchase_dept"


class User(Base):
    __tablename__ = "users"

    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.lab_technician)
    is_active = Column(Boolean, default=True, nullable=False)
    phone = Column(String(20), nullable=True)
    department = Column(String(100), nullable=True)
    avatar_url = Column(String(500), nullable=True)
