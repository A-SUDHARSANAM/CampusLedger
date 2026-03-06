"""
Analytics routes — admin dashboard.

All chart data is returned as ``{ label, value }`` arrays so the frontend
can feed them directly into any charting library (Chart.js, Recharts, etc.).
"""

from collections import defaultdict
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from supabase import Client

from app.routers.auth_routes import require_role
from app.db.supabase import get_admin_client
from app.services.notification_service import check_delivery_delays, check_warranty_expiry

router = APIRouter(prefix="/analytics", tags=["Analytics"])

_require_admin = require_role("admin")
_require_any   = require_role("admin", "lab_technician", "service_staff", "purchase_dept")


# ---------------------------------------------------------------------------
# Shared chart primitives
# ---------------------------------------------------------------------------

class ChartPoint(BaseModel):
    label: str
    value: float


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class AssetKPIs(BaseModel):
    total_assets: int
    active_assets: int
    damaged_assets: int
    under_maintenance: int
    cancelled_assets: int
    pending_maintenance: int
    total_users: int
    labs_count: int


class DashboardResponse(BaseModel):
    # KPI cards
    asset_kpis: AssetKPIs

    # Charts
    assets_by_location: List[ChartPoint]
    asset_category_distribution: List[ChartPoint]
    monthly_procurement_trend: List[ChartPoint]
    maintenance_status_distribution: List[ChartPoint]
    feedback_ratings_distribution: List[ChartPoint]

    # Extra analytics
    maintenance_frequency: List[ChartPoint]
    feedback_analysis: List[ChartPoint]
    financial_status_prediction: List[ChartPoint]


# ---------------------------------------------------------------------------
# Helper: build { label, value } list from a dict
# ---------------------------------------------------------------------------

def _chart(d: dict) -> List[ChartPoint]:
    return [ChartPoint(label=str(k), value=float(v)) for k, v in sorted(d.items())]


def _month_key(iso_str: Optional[str]) -> Optional[str]:
    """Return 'YYYY-MM' from an ISO timestamp string, or None."""
    if not iso_str:
        return None
    try:
        return iso_str[:7]          # '2025-03-04T...' -> '2025-03'
    except Exception:
        return None


def _last_12_months() -> List[str]:
    """Return the last 12 'YYYY-MM' strings including the current month."""
    today = date.today()
    months = []
    y, m = today.year, today.month
    for _ in range(12):
        months.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    months.reverse()
    return months


def _linear_forecast(monthly_values: List[float], steps: int = 3) -> List[float]:
    """
    Simple least-squares linear regression over *monthly_values*,
    projected *steps* months into the future.
    Returns a list of *steps* floats.
    """
    n = len(monthly_values)
    if n < 2:
        last = monthly_values[-1] if monthly_values else 0.0
        return [max(0.0, last)] * steps

    xs = list(range(n))
    x_mean = sum(xs) / n
    y_mean = sum(monthly_values) / n

    num   = sum((xs[i] - x_mean) * (monthly_values[i] - y_mean) for i in range(n))
    denom = sum((xs[i] - x_mean) ** 2 for i in range(n))
    slope = num / denom if denom else 0.0
    intercept = y_mean - slope * x_mean

    return [max(0.0, intercept + slope * (n + i)) for i in range(steps)]


def _next_month_labels(steps: int = 3) -> List[str]:
    today = date.today()
    y, m  = today.year, today.month
    labels = []
    for _ in range(steps):
        m += 1
        if m > 12:
            m = 1
            y += 1
        labels.append(f"{y:04d}-{m:02d}")
    return labels


# ---------------------------------------------------------------------------
# GET /analytics/dashboard
#   Full dashboard payload — admin only
# ---------------------------------------------------------------------------
@router.get(
    "/dashboard",
    response_model=DashboardResponse,
    summary="Full analytics dashboard (admin only)",
)
def analytics_dashboard(
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_admin),
):
    # ── 1. Asset categories (build lookup, identify networking IDs) ────────
    cat_rows = sb.table("asset_categories").select("id, category_name").execute().data or []
    cat_name_map: dict = {row["id"]: (row.get("category_name") or "").lower() for row in cat_rows}
    networking_ids: set = {row["id"] for row in cat_rows
                           if (row.get("category_name") or "").lower() == "networking"}

    # ── 2. Assets (with category_id, status, lab_id) ──────────────────────
    assets = sb.table("assets").select(
        "id, status, category_id, lab_id, condition_rating"
    ).execute().data or []

    status_counts: dict = defaultdict(int)
    category_counts: dict = defaultdict(int)
    category_ratings: dict = defaultdict(list)

    for a in assets:
        cat_id = a.get("category_id")
        is_networking = cat_id in networking_ids

        status = (a.get("status") or "unknown").lower()
        if not is_networking:
            status_counts[status] += 1

        cat_label = cat_name_map.get(cat_id, "uncategorised") if cat_id else "uncategorised"
        if not is_networking:
            category_counts[cat_label] += 1
            if a.get("condition_rating") is not None:
                category_ratings[cat_label].append(float(a["condition_rating"]))

    # ── 3. Labs & users ───────────────────────────────────────────────────
    labs_list = sb.table("labs").select("id, lab_name").execute().data or []
    labs_count = len(labs_list)

    pending_maint_rows = (
        sb.table("maintenance_requests").select("id").eq("status", "pending").execute().data or []
    )
    pending_maintenance = len(pending_maint_rows)

    users_rows = sb.table("users").select("id").eq("status", "active").execute().data or []
    total_users = len(users_rows)

    # Non-networking totals
    total_assets       = sum(status_counts.values())
    active_assets      = status_counts.get("active", 0)
    damaged_assets     = status_counts.get("damaged", 0)
    under_maintenance  = status_counts.get("under_maintenance", 0)
    cancelled_assets   = status_counts.get("cancelled", 0)

    asset_kpis = AssetKPIs(
        total_assets       = total_assets,
        active_assets      = active_assets,
        damaged_assets     = damaged_assets,
        under_maintenance  = under_maintenance,
        cancelled_assets   = cancelled_assets,
        pending_maintenance= pending_maintenance,
        total_users        = total_users,
        labs_count         = labs_count,
    )

    # ── 4. Assets by lab location (exclude networking) ────────────────────
    lab_name_map = {lab["id"]: (lab.get("lab_name") or lab["id"]) for lab in labs_list}

    lab_asset_counts: dict = defaultdict(int)
    for a in assets:
        cat_id = a.get("category_id")
        if a.get("lab_id") and cat_id not in networking_ids:
            lbl = lab_name_map.get(a["lab_id"], a["lab_id"])
            lab_asset_counts[lbl] += 1

    assets_by_location = _chart(lab_asset_counts)

    # ── 5. Asset category distribution (exclude networking) ───────────────
    asset_category_distribution = [
        ChartPoint(label=k.replace("_", " ").title(), value=float(v))
        for k, v in sorted(category_counts.items())
    ]

    # ── 6. Monthly procurement trend — count of orders (all time last 12 months)
    purchases = sb.table("purchase_orders").select("created_at").execute().data or []
    months = _last_12_months()
    monthly_count: dict = {m: 0 for m in months}
    for p in purchases:
        mk = _month_key(p.get("created_at"))
        if mk in monthly_count:
            monthly_count[mk] += 1

    monthly_procurement_trend = [
        ChartPoint(label=m, value=float(monthly_count[m])) for m in months
    ]

    # ── 7. Maintenance status distribution ────────────────────────────────
    maint_rows = sb.table("maintenance_requests").select("status").execute().data or []
    maint_status_counts: dict = defaultdict(int)
    for row in maint_rows:
        s = (row.get("status") or "unknown").lower()
        maint_status_counts[s] += 1

    maintenance_status_distribution = [
        ChartPoint(label=k.replace("_", " ").title(), value=float(v))
        for k, v in sorted(maint_status_counts.items())
    ]

    # ── 8. Feedback ratings distribution ──────────────────────────────────
    feedback_ratings_distribution: List[ChartPoint] = []
    try:
        feedback_rows = sb.table("feedback").select("rating").execute().data or []
        rating_counts: dict = defaultdict(int)
        for f in feedback_rows:
            rating = f.get("rating")
            if rating is not None:
                try:
                    rating_counts[str(int(float(rating)))] += 1
                except (ValueError, TypeError):
                    pass
        feedback_ratings_distribution = [
            ChartPoint(label=f"★ {k}", value=float(v))
            for k, v in sorted(rating_counts.items())
        ]
    except Exception:
        feedback_ratings_distribution = []

    # ── 9. Maintenance frequency (last 12 months) ─────────────────────────
    monthly_maint: dict = {m: 0 for m in months}
    for row in maint_rows:
        mk = _month_key(row.get("created_at")) if row.get("created_at") else None
        if mk and mk in monthly_maint:
            monthly_maint[mk] += 1

    maintenance_frequency = [
        ChartPoint(label=m, value=float(monthly_maint.get(m, 0))) for m in months
    ]

    # ── 10. Feedback analysis (avg condition_rating per category) ──────────
    feedback_analysis_map: dict = {}
    for cat, ratings in category_ratings.items():
        feedback_analysis_map[cat] = round(sum(ratings) / len(ratings), 2) if ratings else 0.0
    feedback_analysis = _chart(feedback_analysis_map)

    # ── 11. Financial status prediction ───────────────────────────────────
    spend_values = [monthly_count[m] for m in months]   # use order counts
    forecast_vals   = _linear_forecast([float(v) for v in spend_values], steps=3)
    forecast_labels = _next_month_labels(steps=3)
    financial_status_prediction = [
        ChartPoint(label=forecast_labels[i], value=round(forecast_vals[i], 2))
        for i in range(3)
    ]

    return DashboardResponse(
        asset_kpis                   = asset_kpis,
        assets_by_location           = assets_by_location,
        asset_category_distribution  = asset_category_distribution,
        monthly_procurement_trend    = monthly_procurement_trend,
        maintenance_status_distribution = maintenance_status_distribution,
        feedback_ratings_distribution   = feedback_ratings_distribution,
        maintenance_frequency        = maintenance_frequency,
        feedback_analysis            = feedback_analysis,
        financial_status_prediction  = financial_status_prediction,
    )



# ---------------------------------------------------------------------------
# GET /analytics/summary
#   Lightweight KPI-only endpoint accessible to all authenticated roles
# ---------------------------------------------------------------------------
@router.get(
    "/summary",
    response_model=AssetKPIs,
    summary="Asset KPI summary (all authenticated users)",
)
def asset_summary(
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_any),
):
    cat_rows = sb.table("asset_categories").select("id, category_name").execute().data or []
    networking_ids: set = {row["id"] for row in cat_rows
                           if (row.get("category_name") or "").lower() == "networking"}

    assets = sb.table("assets").select("id, status, category_id").execute().data or []
    counts: dict = defaultdict(int)
    for a in assets:
        if a.get("category_id") not in networking_ids:
            counts[(a.get("status") or "unknown").lower()] += 1

    pending = sb.table("maintenance_requests").select("id").eq("status", "pending").execute().data or []
    labs    = sb.table("labs").select("id").execute().data or []
    users   = sb.table("users").select("id").eq("status", "active").execute().data or []

    return AssetKPIs(
        total_assets       = sum(counts.values()),
        active_assets      = counts.get("active", 0),
        damaged_assets     = counts.get("damaged", 0),
        under_maintenance  = counts.get("under_maintenance", 0),
        cancelled_assets   = counts.get("cancelled", 0),
        pending_maintenance= len(pending),
        total_users        = len(users),
        labs_count         = len(labs),
    )


# ---------------------------------------------------------------------------
# POST /analytics/run-checks
# ---------------------------------------------------------------------------
class RunChecksResponse(BaseModel):
    delayed_orders_notified: int
    expiring_warranties_notified: int


@router.post(
    "/run-checks",
    response_model=RunChecksResponse,
    summary="Run delivery delay and warranty expiry checks (admin only)",
)
def run_checks(
    warranty_days_ahead: int = 30,
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_admin),
):
    delayed    = check_delivery_delays(sb)
    expiring   = check_warranty_expiry(sb, days_ahead=warranty_days_ahead)
    return RunChecksResponse(
        delayed_orders_notified      = delayed,
        expiring_warranties_notified = expiring,
    )
