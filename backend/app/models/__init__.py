# Import all models here so that SQLAlchemy / Alembic can discover them
from app.models.user import User, UserRole
from app.models.lab import Lab
from app.models.asset import Asset, AssetStatus, AssetCategory
from app.models.maintenance import MaintenanceRequest, MaintenanceStatus, MaintenancePriority
from app.models.purchase import PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus
from app.models.notification import Notification, NotificationType

__all__ = [
    "User",
    "UserRole",
    "Lab",
    "Asset",
    "AssetStatus",
    "AssetCategory",
    "MaintenanceRequest",
    "MaintenanceStatus",
    "MaintenancePriority",
    "PurchaseOrder",
    "PurchaseOrderItem",
    "PurchaseOrderStatus",
    "Notification",
    "NotificationType",
]
