"""
app/routers/finance.py
========================
Financial Planning & Budget Forecast API.

Endpoints
---------
GET /finance/replacement-forecast
    Top-level summary: total assets expiring + estimated replacement budget.

GET /finance/replacement-forecast/category
    Replacement forecast broken down by asset category.

GET /finance/replacement-forecast/timeline
    Year-by-year replacement cost timeline.

GET /finance/replacement-assets
    Per-asset replacement details for assets expiring in the forecast window.

Access: admin, purchase_dept
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from supabase import Client

from app.db.supabase import get_admin_client
from app.routers.auth_routes import require_role
from app.services.finance_forecast import (
    calculate_forecast_by_category,
    calculate_forecast_timeline,
    calculate_replacement_forecast,
    get_replacement_asset_details,
    FORECAST_WINDOW,
    INFLATION_RATE,
)

router = APIRouter(prefix="/finance", tags=["Finance Forecast"])

_require_finance = require_role("admin", "purchase_dept")


# ── Response models ───────────────────────────────────────────────────────────

class ForecastSummary(BaseModel):
    current_year: int
    forecast_window: int
    assets_expiring: int
    estimated_replacement_cost: float
    inflation_rate: float
    ml_powered: bool = False


class CategoryForecast(BaseModel):
    category: str
    assets_expiring: int
    estimated_cost: float


class TimelineForecast(BaseModel):
    year: int
    assets_expiring: int
    estimated_cost: float


class AssetForecastDetail(BaseModel):
    id: str
    asset_name: str
    category: str
    purchase_date: Optional[str]
    lifecycle_years: int
    expiry_year: int
    original_cost: float
    replacement_cost: float


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get(
    "/replacement-forecast",
    response_model=ForecastSummary,
    summary="Overall replacement budget forecast",
)
def get_replacement_forecast(
    window: int = Query(default=FORECAST_WINDOW, ge=1, le=10, description="Forecast horizon in years"),
    _user: dict = Depends(_require_finance),
    sb: Client = Depends(get_admin_client),
) -> Dict[str, Any]:
    return calculate_replacement_forecast(sb, forecast_window=window)


@router.get(
    "/replacement-forecast/category",
    response_model=List[CategoryForecast],
    summary="Replacement forecast by asset category",
)
def get_forecast_by_category(
    window: int = Query(default=FORECAST_WINDOW, ge=1, le=10),
    _user: dict = Depends(_require_finance),
    sb: Client = Depends(get_admin_client),
) -> List[Dict[str, Any]]:
    return calculate_forecast_by_category(sb, forecast_window=window)


@router.get(
    "/replacement-forecast/timeline",
    response_model=List[TimelineForecast],
    summary="Year-by-year replacement cost timeline",
)
def get_forecast_timeline(
    window: int = Query(default=FORECAST_WINDOW, ge=1, le=10),
    _user: dict = Depends(_require_finance),
    sb: Client = Depends(get_admin_client),
) -> List[Dict[str, Any]]:
    return calculate_forecast_timeline(sb, forecast_window=window)


@router.get(
    "/replacement-assets",
    response_model=List[AssetForecastDetail],
    summary="Per-asset replacement details within the forecast window",
)
def get_replacement_assets(
    window: int = Query(default=FORECAST_WINDOW, ge=1, le=10),
    category: Optional[str] = Query(default=None, description="Filter by category"),
    _user: dict = Depends(_require_finance),
    sb: Client = Depends(get_admin_client),
) -> List[Dict[str, Any]]:
    rows = get_replacement_asset_details(sb, forecast_window=window)
    if category:
        rows = [r for r in rows if r["category"] == category.lower()]
    return rows
