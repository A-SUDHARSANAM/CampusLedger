from app.routers.auth_routes import router as auth_routes_router
from app.routers.users import router as users_router
from app.routers.labs import router as labs_router
from app.routers.assets import router as assets_router
from app.routers.locations import router as locations_router
from app.routers.maintenance import router as maintenance_router
from app.routers.purchase import router as purchase_router
from app.routers.analytics import router as analytics_router
from app.routers.notifications import router as notifications_router
from app.routers.reports import router as reports_router
from app.routers.borrow import router as borrow_router
from app.routers.qr import router as qr_router
from app.routers.student_queries import router as student_queries_router
from app.routers.technician import router as technician_router
from app.routers.inventory_predictions import router as inventory_predictions_router
from app.routers.ocr import router as ocr_router
from app.routers.digital_twin import router as digital_twin_router
from app.routers.device_health import router as device_health_router
from app.routers.blockchain import router as blockchain_router
from app.routers.qr_tracking import router as qr_tracking_router
from app.routers.rfid import router as rfid_router

__all__ = [
    "auth_routes_router",
    "users_router",
    "labs_router",
    "assets_router",
    "locations_router",
    "maintenance_router",
    "purchase_router",
    "analytics_router",
    "notifications_router",
    "reports_router",
    "borrow_router",
    "qr_router",
    "student_queries_router",
    "technician_router",
    "inventory_predictions_router",
    "ocr_router",
    "digital_twin_router",
    "device_health_router",
    "blockchain_router",
    "qr_tracking_router",
    "rfid_router",
]
