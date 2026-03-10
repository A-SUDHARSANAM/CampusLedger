"""
services/finance_forecast.py
=============================
Financial Planning & Budget Forecast engine.

Computes asset replacement schedules by:
  1. Fetching all assets with purchase_date, lifecycle_years, purchase_price.
  2. Calculating expiry_year = purchase_year + lifecycle_years.
  3. Filtering assets expiring within FORECAST_WINDOW years from now.
  4. Applying inflation-adjusted replacement cost:
       future_cost = purchase_price × (1 + INFLATION_RATE) ^ years_until_expiry

Constants
---------
INFLATION_RATE   = 0.06  (6 % per year)
FORECAST_WINDOW  = 3     (3 years ahead)
DEFAULT_COST     = 50000 (₹ fallback when purchase_price is NULL)
DEFAULT_LIFECYCLE = 5    (years fallback when lifecycle_years is NULL)
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date
from typing import Any, Dict, List

from supabase import Client

# ── Constants ─────────────────────────────────────────────────────────────────
INFLATION_RATE    = 0.06
FORECAST_WINDOW   = 3       # years ahead to analyse
DEFAULT_COST      = 50_000  # ₹ fallback
DEFAULT_LIFECYCLE = 5       # years fallback


# ── Internal helpers ──────────────────────────────────────────────────────────

def _expiry_year(purchase_date_str: str | None, lifecycle: int) -> int | None:
    """Return the year when an asset ends its lifecycle, or None if unparseable."""
    if not purchase_date_str:
        return None
    try:
        yr = int(str(purchase_date_str)[:4])
        return yr + lifecycle
    except (ValueError, TypeError):
        return None


def _inflation_cost(purchase_cost: float, years_ahead: int) -> float:
    """Return inflation-adjusted replacement cost."""
    return round(purchase_cost * ((1 + INFLATION_RATE) ** years_ahead), 2)


def _safe_cost(row: dict) -> float:
    v = row.get("purchase_price") or row.get("purchase_cost")
    try:
        return float(v) if v is not None else DEFAULT_COST
    except (TypeError, ValueError):
        return DEFAULT_COST


def _safe_lifecycle(row: dict) -> int:
    v = row.get("lifecycle_years")
    try:
        return int(v) if v else DEFAULT_LIFECYCLE
    except (TypeError, ValueError):
        return DEFAULT_LIFECYCLE


# ── Public API ────────────────────────────────────────────────────────────────

def calculate_replacement_forecast(
    sb: Client,
    forecast_window: int = FORECAST_WINDOW,
) -> Dict[str, Any]:
    """
    Returns top-level forecast summary.

    {
        "current_year": 2026,
        "forecast_window": 3,
        "assets_expiring": 42,
        "estimated_replacement_cost": 4200000.0,
        "inflation_rate": 0.06,
    }
    """
    current_year = date.today().year
    rows = _fetch_assets(sb)

    total_expiring = 0
    total_cost = 0.0

    for row in rows:
        lifecycle = _safe_lifecycle(row)
        exp_yr = _expiry_year(row.get("purchase_date"), lifecycle)
        if exp_yr is None:
            continue
        if current_year <= exp_yr < current_year + forecast_window:
            total_expiring += 1
            years_ahead = max(0, exp_yr - current_year)
            cost = _safe_cost(row)
            total_cost += _inflation_cost(cost, years_ahead)

    return {
        "current_year": current_year,
        "forecast_window": forecast_window,
        "assets_expiring": total_expiring,
        "estimated_replacement_cost": round(total_cost, 2),
        "inflation_rate": INFLATION_RATE,
    }


def calculate_forecast_by_category(
    sb: Client,
    forecast_window: int = FORECAST_WINDOW,
) -> List[Dict[str, Any]]:
    """
    Returns replacement forecast grouped by asset category.

    [
        {"category": "computers", "assets_expiring": 12, "estimated_cost": 1800000.0},
        ...
    ]
    """
    current_year = date.today().year
    rows = _fetch_assets(sb)

    by_cat: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"assets_expiring": 0, "estimated_cost": 0.0})

    for row in rows:
        lifecycle = _safe_lifecycle(row)
        exp_yr = _expiry_year(row.get("purchase_date"), lifecycle)
        if exp_yr is None:
            continue
        if current_year <= exp_yr < current_year + forecast_window:
            cat = (row.get("category") or "other").lower()
            years_ahead = max(0, exp_yr - current_year)
            cost = _inflation_cost(_safe_cost(row), years_ahead)
            by_cat[cat]["assets_expiring"] += 1
            by_cat[cat]["estimated_cost"] = round(by_cat[cat]["estimated_cost"] + cost, 2)

    return [
        {"category": cat, **data}
        for cat, data in sorted(by_cat.items(), key=lambda x: -x[1]["estimated_cost"])
    ]


def calculate_forecast_timeline(
    sb: Client,
    forecast_window: int = FORECAST_WINDOW,
) -> List[Dict[str, Any]]:
    """
    Returns year-by-year replacement cost forecast.

    [
        {"year": 2026, "assets_expiring": 10, "estimated_cost": 800000.0},
        {"year": 2027, "assets_expiring": 25, "estimated_cost": 1600000.0},
        ...
    ]
    """
    current_year = date.today().year
    rows = _fetch_assets(sb)

    by_year: Dict[int, Dict[str, Any]] = {
        yr: {"assets_expiring": 0, "estimated_cost": 0.0}
        for yr in range(current_year, current_year + forecast_window)
    }

    for row in rows:
        lifecycle = _safe_lifecycle(row)
        exp_yr = _expiry_year(row.get("purchase_date"), lifecycle)
        if exp_yr is None or exp_yr not in by_year:
            continue
        years_ahead = max(0, exp_yr - current_year)
        cost = _inflation_cost(_safe_cost(row), years_ahead)
        by_year[exp_yr]["assets_expiring"] += 1
        by_year[exp_yr]["estimated_cost"] = round(by_year[exp_yr]["estimated_cost"] + cost, 2)

    return [{"year": yr, **data} for yr, data in sorted(by_year.items())]


def get_replacement_asset_details(
    sb: Client,
    forecast_window: int = FORECAST_WINDOW,
) -> List[Dict[str, Any]]:
    """
    Returns per-asset replacement details for assets expiring within the window.

    [
        {
            "id": "...", "asset_name": "Dell Optiplex",
            "category": "computers", "expiry_year": 2027,
            "replacement_cost": 90000.0
        },
        ...
    ]
    """
    current_year = date.today().year
    rows = _fetch_assets(sb)

    result = []
    for row in rows:
        lifecycle = _safe_lifecycle(row)
        exp_yr = _expiry_year(row.get("purchase_date"), lifecycle)
        if exp_yr is None:
            continue
        if current_year <= exp_yr < current_year + forecast_window:
            years_ahead = max(0, exp_yr - current_year)
            cost = _inflation_cost(_safe_cost(row), years_ahead)
            result.append({
                "id": row.get("id", ""),
                "asset_name": row.get("name", "Unknown"),
                "category": (row.get("category") or "other").lower(),
                "purchase_date": row.get("purchase_date"),
                "lifecycle_years": lifecycle,
                "expiry_year": exp_yr,
                "original_cost": _safe_cost(row),
                "replacement_cost": cost,
            })

    result.sort(key=lambda x: (x["expiry_year"], -x["replacement_cost"]))
    return result


# ── Private DB helper ──────────────────────────────────────────────────────────

def _fetch_assets(sb: Client) -> List[dict]:
    """Fetch all assets with lifecycle-relevant columns from Supabase."""
    resp = (
        sb.table("assets")
        .select("id, name, category, purchase_date, purchase_price, lifecycle_years")
        .execute()
    )
    return resp.data or []
