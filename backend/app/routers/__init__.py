from app.routers.auth_routes import router as auth_routes_router
from app.routers.users import router as users_router
from app.routers.labs import router as labs_router
from app.routers.assets import router as assets_router
from app.routers.maintenance import router as maintenance_router
from app.routers.purchase import router as purchase_router
from app.routers.analytics import router as analytics_router
from app.routers.notifications import router as notifications_router
from app.routers.reports import router as reports_router

__all__ = [
    "auth_routes_router",
    "users_router",
    "labs_router",
    "assets_router",
    "maintenance_router",
    "purchase_router",
    "analytics_router",
    "notifications_router",
    "reports_router",
]
