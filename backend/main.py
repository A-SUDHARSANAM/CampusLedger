from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.routers import (
    asset_utilization_router,
    auth_routes_router,
    users_router,
    labs_router,
    assets_router,
    locations_router,
    maintenance_router,
    purchase_router,
    analytics_router,
    notifications_router,
    reports_router,
    borrow_router,
    qr_router,
    student_queries_router,
    technician_router,
    inventory_predictions_router,
    ocr_router,
    digital_twin_router,
    device_health_router,
    blockchain_router,
    qr_tracking_router,
    rfid_router,
    tasks_router,
    chatbot_router,
    finance_router,
)

API_PREFIX = "/api/v1"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: verify Supabase connectivity + auto-migrate + start ML scheduler."""
    from app.db.supabase import supabase_admin

    try:
        supabase_admin.table("users").select("id").limit(1).execute()
    except Exception as exc:  # pragma: no cover
        import logging
        logging.getLogger("campusledger").warning("Supabase connectivity check failed: %s", exc)

    # Auto-apply pending SQL migrations (uses psycopg2 if DATABASE_URL is set)
    try:
        from migrate import run_migrations
        run_migrations()
    except Exception as exc:
        import logging
        logging.getLogger("campusledger").warning("Auto-migration skipped (non-fatal): %s", exc)

    # Start background scheduler for monthly model retraining (non-blocking)
    try:
        from ml.retrain_model import start_background_scheduler
        start_background_scheduler()
    except Exception as exc:
        import logging
        logging.getLogger("campusledger").warning("ML scheduler startup failed (non-fatal): %s", exc)

    yield


app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "CampusLedger — Campus Asset Lifecycle & Inventory Management Platform REST API. "
        "Roles: admin · lab_technician · service_staff · purchase_dept"
    ),
    version=settings.APP_VERSION,
    docs_url=f"{API_PREFIX}/docs",
    redoc_url=f"{API_PREFIX}/redoc",
    openapi_url=f"{API_PREFIX}/openapi.json",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers  (/api/v1/...)
# ---------------------------------------------------------------------------
app.include_router(auth_routes_router,   prefix=API_PREFIX)
app.include_router(users_router,         prefix=API_PREFIX)
app.include_router(labs_router,          prefix=API_PREFIX)
app.include_router(assets_router,        prefix=API_PREFIX)
app.include_router(locations_router,     prefix=API_PREFIX)
app.include_router(maintenance_router,   prefix=API_PREFIX)
app.include_router(purchase_router,      prefix=API_PREFIX)
app.include_router(analytics_router,     prefix=API_PREFIX)
app.include_router(notifications_router, prefix=API_PREFIX)
app.include_router(reports_router,       prefix=API_PREFIX)
app.include_router(borrow_router,           prefix=API_PREFIX)
app.include_router(qr_router,               prefix=API_PREFIX)
app.include_router(inventory_predictions_router, prefix=API_PREFIX)
app.include_router(student_queries_router,  prefix=API_PREFIX)
app.include_router(technician_router,        prefix=API_PREFIX)
app.include_router(ocr_router,               prefix=API_PREFIX)
app.include_router(digital_twin_router,      prefix=API_PREFIX)
app.include_router(device_health_router,     prefix=API_PREFIX)
app.include_router(blockchain_router,        prefix=API_PREFIX)
app.include_router(qr_tracking_router,       prefix=API_PREFIX)
app.include_router(rfid_router,              prefix=API_PREFIX)
app.include_router(tasks_router,             prefix=API_PREFIX)
app.include_router(chatbot_router,           prefix=API_PREFIX)
app.include_router(finance_router,               prefix=API_PREFIX)
app.include_router(asset_utilization_router,     prefix=API_PREFIX)

# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get(f"{API_PREFIX}/health", tags=["Health"], summary="Service health check")
def health_check():
    return JSONResponse({"status": "ok", "version": settings.APP_VERSION, "app": settings.APP_NAME})


@app.get("/", include_in_schema=False)
def root():
    return {"message": f"Welcome to {settings.APP_NAME} API", "docs": f"{API_PREFIX}/docs"}

