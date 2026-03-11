"""
ml/predict_budget.py
====================
Budget forecast prediction service.

Loads the trained RandomForest pipeline (``budget_forecast_model.pkl``) and
exposes a single public function:

    predict_replacement_cost(category, purchase_year, lifecycle_years,
                             purchase_cost, quantity) -> float

If the model file is missing or fails to load the function falls back to the
deterministic inflation formula so the API never breaks.

Public helpers
--------------
predict_replacement_cost(...)
    Per-cohort cost prediction used by finance_forecast.py.

predict_budget_forecast(assets, forecast_window)
    High-level convenience wrapper: given a list of asset dicts (from DB),
    returns a structured summary matching the dashboard's expected shape.
"""

from __future__ import annotations

import logging
from datetime import date
from pathlib import Path
from typing import Any, Dict, List, Optional

_logger = logging.getLogger(__name__)

MODEL_PATH = Path(__file__).parent / "budget_forecast_model.pkl"
INFLATION   = 0.06   # fallback rate

# ── Lazy model loader ──────────────────────────────────────────────────────────

_pipeline = None
_model_loaded: bool = False
_model_attempted: bool = False


def _load_model() -> bool:
    """Load the sklearn pipeline once.  Returns True on success."""
    global _pipeline, _model_loaded, _model_attempted
    if _model_attempted:
        return _model_loaded

    _model_attempted = True
    if not MODEL_PATH.exists():
        _logger.warning(
            "Budget forecast model not found at %s. "
            "Run: python backend/ml/train_budget_model.py",
            MODEL_PATH,
        )
        return False

    try:
        import joblib
        _pipeline = joblib.load(MODEL_PATH)
        _model_loaded = True
        _logger.info("Budget forecast model loaded from %s", MODEL_PATH)
    except Exception as exc:
        _logger.error("Failed to load budget forecast model: %s", exc)

    return _model_loaded


def is_model_available() -> bool:
    """Return True if the ML model has been loaded successfully."""
    return _load_model()


# ── Core prediction ────────────────────────────────────────────────────────────

def _inflation_fallback(purchase_cost: float, lifecycle_years: int, quantity: int) -> float:
    """Rule-based replacement cost (inflation formula)."""
    return round(purchase_cost * ((1 + INFLATION) ** lifecycle_years) * quantity, 2)


def predict_replacement_cost(
    category: str,
    purchase_year: int,
    lifecycle_years: int,
    purchase_cost: float,
    quantity: int = 1,
) -> float:
    """
    Predict the inflation-adjusted replacement cost for a cohort of assets.

    The model predicts PER-UNIT cost; the result is then scaled by *quantity*.

    Parameters
    ----------
    category        : asset category string (e.g. "computers")
    purchase_year   : year asset was purchased
    lifecycle_years : expected useful-life span in years
    purchase_cost   : per-unit purchase price (₹)
    quantity        : number of units — applied as a post-prediction multiplier

    Returns
    -------
    Predicted total replacement cost (₹), always positive.
    Falls back to deterministic inflation formula if ML model unavailable.
    """
    if _load_model() and _pipeline is not None:
        try:
            import pandas as pd
            # Model was trained on per-unit features (no quantity column)
            X = pd.DataFrame(
                [{
                    "asset_category": str(category).strip().lower(),
                    "purchase_year":   int(purchase_year),
                    "lifecycle_years": int(lifecycle_years),
                    "purchase_cost":   float(purchase_cost),
                }]
            )
            per_unit = float(_pipeline.predict(X)[0])
            return round(max(per_unit, 0.0) * int(quantity), 2)
        except Exception as exc:
            _logger.warning("ML prediction failed (%s), using fallback.", exc)

    return _inflation_fallback(purchase_cost, lifecycle_years, quantity)


# ── High-level forecast helper ─────────────────────────────────────────────────

def predict_budget_forecast(
    assets: List[Dict[str, Any]],
    forecast_window: int = 3,
) -> Dict[str, Any]:
    """
    Given a list of asset dicts from the database, compute a budget forecast
    for the next *forecast_window* years using the ML model (or fallback).

    Each asset dict is expected to have:
        purchase_date  : str "YYYY-MM-DD" or "YYYY-…"
        lifecycle_years: int  (or None → default 5)
        purchase_price / purchase_cost : float (or None → default 50 000)
        category       : str

    Returns
    -------
    {
        "forecast_year":               int,
        "assets_expiring":             int,
        "estimated_replacement_cost":  float,
        "ml_powered":                  bool,
    }
    """
    current_year = date.today().year
    target_year  = current_year + forecast_window

    total_expiring = 0
    total_cost     = 0.0

    for row in assets:
        purchase_date_str = row.get("purchase_date")
        if not purchase_date_str:
            continue
        try:
            purchase_year = int(str(purchase_date_str)[:4])
        except (ValueError, TypeError):
            continue

        lifecycle = _safe_lifecycle(row)
        expiry    = purchase_year + lifecycle

        if current_year <= expiry < current_year + forecast_window:
            cost     = _safe_cost(row)
            category = (row.get("category") or "other").lower()
            total_expiring += 1
            total_cost += predict_replacement_cost(
                category=category,
                purchase_year=purchase_year,
                lifecycle_years=lifecycle,
                purchase_cost=cost,
                quantity=1,
            )

    return {
        "forecast_year":              target_year,
        "assets_expiring":            total_expiring,
        "estimated_replacement_cost": round(total_cost, 2),
        "ml_powered":                 is_model_available(),
    }


# ── Private helpers ────────────────────────────────────────────────────────────

_DEFAULT_COST      = 50_000
_DEFAULT_LIFECYCLE = 5


def _safe_cost(row: dict) -> float:
    v = row.get("purchase_price") or row.get("purchase_cost")
    try:
        return float(v) if v is not None else _DEFAULT_COST
    except (TypeError, ValueError):
        return _DEFAULT_COST


def _safe_lifecycle(row: dict) -> int:
    v = row.get("lifecycle_years")
    try:
        return int(v) if v else _DEFAULT_LIFECYCLE
    except (TypeError, ValueError):
        return _DEFAULT_LIFECYCLE
