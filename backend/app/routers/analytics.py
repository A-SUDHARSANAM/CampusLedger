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
    under_maintenance_assets: int


class DashboardResponse(BaseModel):
    # KPI cards
    asset_kpis: AssetKPIs

    # Pie / bar charts
    assets_by_location: List[ChartPoint]
    asset_category_distribution: List[ChartPoint]

    # Line charts
    monthly_procurement_trend: List[ChartPoint]   # last 12 months, spend per month
    maintenance_frequency: List[ChartPoint]        # last 12 months, request count per month

    # Analysis
    feedback_analysis: List[ChartPoint]            # avg condition_rating per category
    financial_status_prediction: List[ChartPoint]  # projected spend next 3 months (linear)


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
    # ── 1. Assets ──────────────────────────────────────────────────────────
    assets = sb.table("assets").select(
        "status, category, lab_id, condition_rating"
    ).execute().data or []

    status_counts: dict = defaultdict(int)
    category_counts: dict = defaultdict(int)
    category_ratings: dict = defaultdict(list)   # for feedback analysis

    for a in assets:
        status_counts[a.get("status") or "unknown"] += 1
        category_counts[a.get("category") or "uncategorised"] += 1
        if a.get("condition_rating") is not None:
            category_ratings[a.get("category") or "uncategorised"].append(
                float(a["condition_rating"])
            )

    asset_kpis = AssetKPIs(
        total_assets             = len(assets),
        active_assets            = status_counts.get("active", 0),
        damaged_assets           = status_counts.get("damaged", 0),
        under_maintenance_assets = status_counts.get("under_maintenance", 0),
    )

    # ── 2. Assets by location (lab_name) ───────────────────────────────────
    labs = sb.table("labs").select("id, lab_name, location").execute().data or []
    lab_map = {lab["id"]: lab.get("lab_name") or lab.get("location") or lab["id"] for lab in labs}

    lab_asset_counts: dict = defaultdict(int)
    for a in assets:
        if a.get("lab_id"):
            lbl = lab_map.get(a["lab_id"], a["lab_id"])
            lab_asset_counts[lbl] += 1

    assets_by_location = _chart(lab_asset_counts)

    # ── 3. Asset category distribution ────────────────────────────────────
    asset_category_distribution = _chart(category_counts)

    # ── 4. Monthly procurement trend (last 12 months) ─────────────────────
    purchases = sb.table("purchase_orders").select(
        "created_at, estimated_cost, status"
    ).execute().data or []

    months = _last_12_months()
    monthly_spend: dict = {m: 0.0 for m in months}
    for p in purchases:
        mk = _month_key(p.get("created_at"))
        if mk in monthly_spend:
            monthly_spend[mk] += float(p.get("estimated_cost") or 0)

    monthly_procurement_trend = [
        ChartPoint(label=m, value=monthly_spend[m]) for m in months
    ]

    # ── 5. Maintenance frequency (last 12 months) ─────────────────────────
    maint = sb.table("maintenance_requests").select(
        "created_at, status"
    ).execute().data or []

    monthly_maint: dict = {m: 0 for m in months}
    for req in maint:
        mk = _month_key(req.get("created_at"))
        if mk in monthly_maint:
            monthly_maint[mk] += 1

    maintenance_frequency = [
        ChartPoint(label=m, value=float(monthly_maint[m])) for m in months
    ]

    # ── 6. Feedback analysis (avg condition_rating per category) ───────────
    feedback: dict = {}
    for cat, ratings in category_ratings.items():
        feedback[cat] = round(sum(ratings) / len(ratings), 2) if ratings else 0.0

    feedback_analysis = _chart(feedback)

    # ── 7. Financial status prediction (next 3 months, linear forecast) ───
    spend_values = [monthly_spend[m] for m in months]
    forecast_vals   = _linear_forecast(spend_values, steps=3)
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
    assets = sb.table("assets").select("status").execute().data or []
    counts: dict = defaultdict(int)
    for a in assets:
        counts[a.get("status") or "unknown"] += 1

    return AssetKPIs(
        total_assets             = len(assets),
        active_assets            = counts.get("active", 0),
        damaged_assets           = counts.get("damaged", 0),
        under_maintenance_assets = counts.get("under_maintenance", 0),
    )


# ---------------------------------------------------------------------------
# POST /analytics/run-checks
#   Admin-triggered (or cron-triggered) check for:
#   - Delivery delays on active orders
#   - Assets with warranty expiring in the next 30 days
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
