from collections import Counter
from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from supabase import Client

from app.db.supabase import get_admin_client
from app.routers.auth_routes import require_role

router = APIRouter(prefix="/reports", tags=["Reports"])
_require_admin = require_role("admin")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _count(rows: list, key: str, value: str) -> int:
    return sum(1 for r in rows if r.get(key) == value)


# ---------------------------------------------------------------------------
# GET /reports/dashboard
# ---------------------------------------------------------------------------

@router.get("/dashboard", summary="Full dashboard report (admin only)")
def get_dashboard_report(
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_admin),
) -> Dict[str, Any]:
    assets = sb.table("assets").select("id, status, category_id, lab_id").execute().data or []
    maintenance = sb.table("maintenance_requests").select("id, status, priority").execute().data or []
    orders = sb.table("purchase_orders").select("id, order_status, payment_status").execute().data or []
    labs_count   = len(sb.table("labs").select("id").execute().data or [])
    users_count  = len(sb.table("users").select("id").eq("status", "active").execute().data or [])

    asset_statuses = Counter(r.get("status") for r in assets)
    maint_statuses = Counter(r.get("status") for r in maintenance)
    order_statuses = Counter(r.get("order_status") for r in orders)

    return {
        "dashboard": {
            "assets": {
                "total":             len(assets),
                "active":            asset_statuses.get("active", 0),
                "under_maintenance": asset_statuses.get("under_maintenance", 0),
                "damaged":           asset_statuses.get("damaged", 0),
            },
            "maintenance": {
                "total":       len(maintenance),
                "pending":     maint_statuses.get("pending", 0),
                "assigned":    maint_statuses.get("assigned", 0),
                "in_progress": maint_statuses.get("in_progress", 0),
                "completed":   maint_statuses.get("completed", 0),
            },
            "purchase": {
                "total":    len(orders),
                "pending":  order_statuses.get("pending", 0),
                "approved": order_statuses.get("approved", 0),
                "rejected": order_statuses.get("rejected", 0),
                "received": order_statuses.get("received", 0),
            },
            "labs_count":  labs_count,
            "users_count": users_count,
        },
    }


# ---------------------------------------------------------------------------
# GET /reports/assets/by-status
# ---------------------------------------------------------------------------

@router.get("/assets/by-status", summary="Asset counts grouped by status (admin only)")
def assets_by_status(
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_admin),
) -> List[Dict[str, Any]]:
    assets = sb.table("assets").select("status").execute().data or []
    counts = Counter(r.get("status") for r in assets)
    return [{"status": s, "count": c} for s, c in sorted(counts.items())]


# ---------------------------------------------------------------------------
# GET /reports/assets/by-lab
# ---------------------------------------------------------------------------

@router.get("/assets/by-lab", summary="Asset counts grouped by lab (admin only)")
def assets_by_lab(
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_admin),
) -> List[Dict[str, Any]]:
    assets = sb.table("assets").select("lab_id, labs(lab_name)").execute().data or []
    counts: Dict[str, Dict[str, Any]] = {}
    for row in assets:
        lab_id   = row.get("lab_id") or "unassigned"
        lab_name = (row.get("labs") or {}).get("lab_name", "Unassigned")
        if lab_id not in counts:
            counts[lab_id] = {"lab_id": lab_id, "lab_name": lab_name, "count": 0}
        counts[lab_id]["count"] += 1
    return list(counts.values())


# ---------------------------------------------------------------------------
# GET /reports/maintenance/by-status
# ---------------------------------------------------------------------------

@router.get("/maintenance/by-status", summary="Maintenance request counts grouped by status (admin only)")
def maintenance_by_status(
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_admin),
) -> List[Dict[str, Any]]:
    rows = sb.table("maintenance_requests").select("status").execute().data or []
    counts = Counter(r.get("status") for r in rows)
    return [{"status": s, "count": c} for s, c in sorted(counts.items())]


# ---------------------------------------------------------------------------
# GET /reports/maintenance/by-priority
# ---------------------------------------------------------------------------

@router.get("/maintenance/by-priority", summary="Maintenance request counts grouped by priority (admin only)")
def maintenance_by_priority(
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_admin),
) -> List[Dict[str, Any]]:
    rows = sb.table("maintenance_requests").select("priority").execute().data or []
    counts = Counter(r.get("priority") for r in rows)
    return [{"priority": p, "count": c} for p, c in sorted(counts.items())]
