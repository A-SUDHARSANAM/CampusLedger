"""
services/finance_forecast.py
=============================
Financial Planning & Budget Forecast engine.

Computes asset replacement schedules by:
  1. Fetching all assets joined with asset_categories for category name.
  2. Calculating expiry_year = purchase_year + lifecycle_years.
  3. Filtering assets expiring within FORECAST_WINDOW years from now.
  4. Estimating replacement cost via ML model (RandomForest) when available,
     falling back to the deterministic inflation formula:
       future_cost = purchase_price × (1 + INFLATION_RATE) ^ years_until_expiry

Schema notes
------------
assets table columns : id, asset_name, category_id, purchase_date,
                       purchase_price (nullable), lifecycle_years (nullable),
                       status, lab_id, serial_number
asset_categories     : id, category_name

When purchase_price / lifecycle_years are NULL the engine uses category-aware
defaults (e.g. servers → ₹1,50,000 / 8 yr; furniture → ₹15,000 / 8 yr).

Constants
---------
INFLATION_RATE   = 0.06  (6 % per year, used as fallback)
FORECAST_WINDOW  = 3     (3 years ahead)
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date
from typing import Any, Dict, List

from supabase import Client

# ── Constants ─────────────────────────────────────────────────────────────────
INFLATION_RATE    = 0.06
FORECAST_WINDOW   = 3       # years ahead to analyse

# ── Category-aware defaults ────────────────────────────────────────────────────
# (purchase_price ₹, lifecycle_years)
_CATEGORY_DEFAULTS: Dict[str, tuple[float, int]] = {
    "computers":        (75_000,  5),
    "computer":         (75_000,  5),
    "laptops":          (95_000,  4),
    "laptop":           (95_000,  4),
    "servers":          (1_50_000, 8),
    "server":           (1_50_000, 8),
    "projectors":       (90_000,  7),
    "projector":        (90_000,  7),
    "printers":         (45_000,  6),
    "printer":          (45_000,  6),
    "networking":       (28_000,  5),
    "routers":          (25_000,  4),
    "switches":         (55_000,  5),
    "furniture":        (15_000,  8),
    "lab_equipment":    (1_20_000, 8),
    "lab equipment":    (1_20_000, 8),
    "measurement_tools":(65_000,  8),
    "audio_visual":     (55_000,  6),
    "storage_devices":  (35_000,  5),
    "safety_equipment": (25_000,  5),
    "hvac":             (85_000, 10),
    "electrical":       (30_000,  7),
    "monitors":         (22_000,  6),
    "cameras":          (48_000,  5),
    "tablets":          (38_000,  4),
    "ups":              (30_000,  4),
    "scanners":         (36_000,  5),
    "workstations":     (1_25_000, 6),
    "oscilloscopes":    (68_000,  8),
    "microscopes":      (1_30_000, 10),
    "ac_units":         (85_000, 10),
}
_DEFAULT_COST      = 50_000
_DEFAULT_LIFECYCLE = 5


def _category_defaults(category: str) -> tuple[float, int]:
    """Return (price, lifecycle) defaults for a given category string."""
    key = (category or "").lower().strip()
    return _CATEGORY_DEFAULTS.get(key, (_DEFAULT_COST, _DEFAULT_LIFECYCLE))


# ── ML integration ────────────────────────────────────────────────────────────
try:
    from ml.predict_budget import predict_replacement_cost as _ml_predict, is_model_available
    _ML_AVAILABLE = True
except ImportError:
    _ML_AVAILABLE = False
    def is_model_available() -> bool:              # type: ignore[misc]
        return False
    def _ml_predict(*_, **__) -> float:            # type: ignore[misc]
        return 0.0


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
    """Return inflation-adjusted replacement cost (deterministic fallback)."""
    return round(purchase_cost * ((1 + INFLATION_RATE) ** years_ahead), 2)


def _safe_cost(row: dict) -> float:
    v = row.get("purchase_price") or row.get("purchase_cost")
    if v is not None:
        try:
            return float(v)
        except (TypeError, ValueError):
            pass
    # Category-aware fallback
    cat = (row.get("category") or "").lower()
    price, _ = _category_defaults(cat)
    return price


def _safe_lifecycle(row: dict) -> int:
    v = row.get("lifecycle_years")
    if v is not None:
        try:
            return int(v)
        except (TypeError, ValueError):
            pass
    # Category-aware fallback
    cat = (row.get("category") or "").lower()
    _, lifecycle = _category_defaults(cat)
    return lifecycle


def _estimate_cost(row: dict, years_ahead: int) -> float:
    """
    Estimate replacement cost for a single asset.
    Uses the ML model when available; falls back to the inflation formula.
    """
    cost      = _safe_cost(row)
    lifecycle = _safe_lifecycle(row)
    category  = (row.get("category") or "other").lower()

    if _ML_AVAILABLE and is_model_available():
        try:
            purchase_date_str = row.get("purchase_date")
            purchase_year = (
                int(str(purchase_date_str)[:4])
                if purchase_date_str
                else date.today().year - lifecycle
            )
            return _ml_predict(
                category=category,
                purchase_year=purchase_year,
                lifecycle_years=lifecycle,
                purchase_cost=cost,
                quantity=1,
            )
        except Exception:
            pass

    return _inflation_cost(cost, years_ahead)


# ── Public API ────────────────────────────────────────────────────────────────

def calculate_replacement_forecast(
    sb: Client,
    forecast_window: int = FORECAST_WINDOW,
) -> Dict[str, Any]:
    """
    Returns top-level forecast summary.
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
            total_cost += _estimate_cost(row, years_ahead)

    return {
        "current_year": current_year,
        "forecast_window": forecast_window,
        "assets_expiring": total_expiring,
        "estimated_replacement_cost": round(total_cost, 2),
        "inflation_rate": INFLATION_RATE,
        "ml_powered": _ML_AVAILABLE and is_model_available(),
    }


def calculate_forecast_by_category(
    sb: Client,
    forecast_window: int = FORECAST_WINDOW,
) -> List[Dict[str, Any]]:
    """
    Returns replacement forecast grouped by asset category.
    """
    current_year = date.today().year
    rows = _fetch_assets(sb)

    by_cat: Dict[str, Dict[str, Any]] = defaultdict(
        lambda: {"assets_expiring": 0, "estimated_cost": 0.0}
    )

    for row in rows:
        lifecycle = _safe_lifecycle(row)
        exp_yr = _expiry_year(row.get("purchase_date"), lifecycle)
        if exp_yr is None:
            continue
        if current_year <= exp_yr < current_year + forecast_window:
            cat = (row.get("category") or "other").lower()
            years_ahead = max(0, exp_yr - current_year)
            cost = _estimate_cost(row, years_ahead)
            by_cat[cat]["assets_expiring"] += 1
            by_cat[cat]["estimated_cost"] = round(
                by_cat[cat]["estimated_cost"] + cost, 2
            )

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
        cost = _estimate_cost(row, years_ahead)
        by_year[exp_yr]["assets_expiring"] += 1
        by_year[exp_yr]["estimated_cost"] = round(
            by_year[exp_yr]["estimated_cost"] + cost, 2
        )

    return [{"year": yr, **data} for yr, data in sorted(by_year.items())]


def get_replacement_asset_details(
    sb: Client,
    forecast_window: int = FORECAST_WINDOW,
) -> List[Dict[str, Any]]:
    """
    Returns per-asset replacement details for assets expiring within the window.
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
            orig_cost = _safe_cost(row)
            est_cost  = _estimate_cost(row, years_ahead)
            result.append({
                "id": row.get("id", ""),
                "asset_name": row.get("asset_name") or row.get("name") or "Unknown",
                "category": (row.get("category") or "other").lower(),
                "purchase_date": row.get("purchase_date"),
                "lifecycle_years": lifecycle,
                "expiry_year": exp_yr,
                "original_cost": orig_cost,
                "replacement_cost": est_cost,
            })

    result.sort(key=lambda x: (x["expiry_year"], -x["replacement_cost"]))
    return result


# ── Private DB helper ─────────────────────────────────────────────────────────

def _fetch_assets(sb: Client) -> List[dict]:
    """
    Fetch all assets joined with asset_categories.

    Selects only columns that exist in the current schema.
    purchase_price and lifecycle_years may not be present yet — the
    _safe_cost / _safe_lifecycle helpers apply category-based defaults.
    """
    try:
        # Try full select including optional cost/lifecycle columns
        resp = (
            sb.table("assets")
            .select(
                "id, asset_name, purchase_date, purchase_price, lifecycle_years, status,"
                " asset_categories(category_name)"
            )
            .execute()
        )
    except Exception:
        # Fallback: select only guaranteed-existing columns
        try:
            resp = (
                sb.table("assets")
                .select("id, asset_name, purchase_date, status, asset_categories(category_name)")
                .execute()
            )
        except Exception as exc:
            import logging
            logging.getLogger("campusledger").warning(
                "finance_forecast._fetch_assets fatal error: %s", exc
            )
            return []

    rows = resp.data or []
    normalised = []
    for r in rows:
        cat_obj  = r.get("asset_categories") or {}
        category = (
            cat_obj.get("category_name")
            if isinstance(cat_obj, dict)
            else None
        ) or "other"
        normalised.append({
            "id":              r.get("id", ""),
            "asset_name":      r.get("asset_name") or "Unknown",
            "category":        category,
            "purchase_date":   r.get("purchase_date"),
            "purchase_price":  r.get("purchase_price"),    # None if col missing
            "lifecycle_years": r.get("lifecycle_years"),   # None if col missing
            "status":          r.get("status", "active"),
        })
    return normalised

