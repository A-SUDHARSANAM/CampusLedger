"""
app/routers/inventory_predictions.py
=====================================
ML-powered inventory demand prediction endpoints.

Endpoints
---------
GET /predict-demand
    Single-item prediction. Requires month, item_id, current_stock query params.

GET /inventory/predictions
    Bulk predictions for every item recorded in inventory_usage_history.

Both endpoints are accessible to admin, purchase_dept, and lab_technician roles.
"""

from __future__ import annotations

import logging
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from supabase import Client

from app.db.supabase import get_admin_client
from app.routers.auth_routes import require_role

_logger = logging.getLogger(__name__)

router = APIRouter(tags=["Inventory ML Predictions"])

_require_any = require_role("admin", "purchase_dept", "lab_technician")

# ---------------------------------------------------------------------------
# Seed items — mirrors migration 005 seed data so the API works before the
# DB migration has been applied.  Used as a fallback in bulk_predictions.
# ---------------------------------------------------------------------------
_SEED_ITEMS: list[tuple[int, str, int]] = [
    # (item_id, item_name, current_stock)
    # Stock values chosen to show all three risk levels in the UI:
    #   HDMI Cable & Network Switch  → Reorder Required  (stock < reorder_level * 0.5)
    #   Mouse & USB Hub              → Low Stock         (stock in [reorder*0.5, reorder))
    #   Keyboard & Projector Bulb    → Safe              (stock >= reorder_level)
    (1, "HDMI Cable",      15),   # Reorder
    (2, "Keyboard",        30),   # Safe
    (3, "Mouse",           14),   # Low
    (4, "Network Switch",   5),   # Reorder
    (5, "Projector Bulb",  20),   # Safe
    (6, "USB Hub",         12),   # Low
]

SAFETY_STOCK = 10  # fixed buffer added to predicted demand to get reorder level


# ---------------------------------------------------------------------------
# Pydantic response models
# ---------------------------------------------------------------------------

class PredictDemandResponse(BaseModel):
    item_id: int
    predicted_demand: float = Field(description="ML forecast for the requested month")
    reorder_level: float    = Field(description="predicted_demand + safety_stock (10)")
    reorder_alert: bool     = Field(description="True when current_stock < reorder_level")
    suggested_order: int    = Field(description="Units to order; 0 when fully stocked")


class InventoryPredictionItem(BaseModel):
    item_id: int
    item_name: str
    current_stock: int
    predicted_demand: float
    reorder_level: float
    reorder_alert: bool
    suggested_order: int


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _next_month() -> int:
    """Return the 1-indexed number of the month following today."""
    m = date.today().month
    return (m % 12) + 1


def _predict(month: int, item_id: int) -> float:
    """
    Thin wrapper around the ML module so the router stays import-error-safe.
    If scikit-learn / joblib aren't installed yet the heuristic fallback kicks in.
    """
    try:
        from ml.predict_demand import predict_demand
        return predict_demand(month, item_id)
    except Exception as exc:
        _logger.warning("predict_demand import/call failed (item=%s): %s", item_id, exc)
        # last-resort numeric heuristic
        base = 12 + (item_id % 8) * 3
        return round(base * (1.2 if month in (3, 6, 9, 12) else 1.0), 1)


def _build_row(
    item_id: int,
    item_name: str,
    current_stock: int,
    month: int,
) -> InventoryPredictionItem:
    predicted     = _predict(month, item_id)
    reorder_level = predicted + SAFETY_STOCK
    reorder_alert = current_stock < reorder_level
    suggested     = max(0, int(reorder_level) - current_stock) if reorder_alert else 0
    return InventoryPredictionItem(
        item_id=item_id,
        item_name=item_name,
        current_stock=current_stock,
        predicted_demand=round(predicted, 1),
        reorder_level=round(reorder_level, 1),
        reorder_alert=reorder_alert,
        suggested_order=suggested,
    )


# ---------------------------------------------------------------------------
# GET /predict-demand  — single item
# ---------------------------------------------------------------------------

@router.get(
    "/predict-demand",
    response_model=PredictDemandResponse,
    summary="Predict demand for a single inventory item",
)
def predict_demand_endpoint(
    month: int = Query(..., ge=1, le=12, description="Target month (1–12)"),
    item_id: int = Query(..., ge=1, description="Inventory item ID"),
    current_stock: int = Query(..., ge=0, description="Current stock on hand"),
    _user: dict = Depends(_require_any),
):
    """
    Returns a demand forecast and reorder recommendation for one item.

    - **predicted_demand** — RandomForest forecast (or heuristic if model not trained)
    - **reorder_level** — `predicted_demand + 10` (safety stock)
    - **reorder_alert** — `true` when `current_stock < reorder_level`
    - **suggested_order** — units to procure to meet forecasted demand (0 if no alert)
    """
    predicted     = _predict(month, item_id)
    reorder_level = predicted + SAFETY_STOCK
    reorder_alert = current_stock < reorder_level
    suggested     = max(0, int(reorder_level) - current_stock) if reorder_alert else 0

    return PredictDemandResponse(
        item_id=item_id,
        predicted_demand=round(predicted, 1),
        reorder_level=round(reorder_level, 1),
        reorder_alert=reorder_alert,
        suggested_order=suggested,
    )


# ---------------------------------------------------------------------------
# GET /inventory/predictions  — bulk all items
# ---------------------------------------------------------------------------

@router.get(
    "/inventory/predictions",
    response_model=List[InventoryPredictionItem],
    summary="Bulk demand predictions for all inventory items",
)
def bulk_predictions(
    month: Optional[int] = Query(
        None, ge=1, le=12,
        description="Target month (defaults to next calendar month)",
    ),
    sb: Client = Depends(get_admin_client),
    _user: dict = Depends(_require_any),
):
    """
    Returns ML demand predictions for every asset category in the database.

    Strategy (in order):
    1. Query ``asset_categories`` for real categories, count active assets per
       category UUID from the ``assets`` table.
    2. Fall back to ``inventory_usage_history`` items if the categories query
       returns nothing.
    3. Last resort: use the built-in seed items with hardcoded stock values.
    """
    target_month = month or _next_month()
    results: List[InventoryPredictionItem] = []

    # ── Strategy 1: Real asset categories from DB ──────────────────────────
    try:
        cat_rows = (
            sb.table("asset_categories")
            .select("id, category_name")
            .order("category_name")
            .execute()
            .data or []
        )
        if cat_rows:
            # Count *active* assets per category using UUID category_id
            asset_rows = (
                sb.table("assets")
                .select("category_id")
                .eq("status", "active")
                .execute()
                .data or []
            )
            stock_per_cat: dict[str, int] = {}
            for ar in asset_rows:
                cid = str(ar.get("category_id") or "")
                if cid:
                    stock_per_cat[cid] = stock_per_cat.get(cid, 0) + 1

            for idx, cat in enumerate(cat_rows, start=1):
                cid      = str(cat["id"])
                # Convert snake_case / underscores to Title Case for display
                raw_name = str(cat.get("category_name") or f"Category {idx}")
                cname    = raw_name.replace("_", " ").replace("-", " ").title()
                current_stock = stock_per_cat.get(cid, 0)
                results.append(_build_row(idx, cname, current_stock, target_month))

            _logger.info(
                "bulk_predictions: %d categories from DB, %d with stock",
                len(cat_rows),
                sum(1 for r in results if r.current_stock > 0),
            )
    except Exception as exc:
        _logger.warning("Could not fetch asset categories from DB: %s", exc)

    # ── Strategy 2: inventory_usage_history ────────────────────────────────
    if not results:
        try:
            hist_rows = (
                sb.table("inventory_usage_history")
                .select("item_id, item_name")
                .execute()
                .data or []
            )
            seen: dict[int, str] = {}
            for r in hist_rows:
                iid = int(r["item_id"])
                if iid not in seen:
                    seen[iid] = str(r["item_name"])
            if seen:
                seed_stock = {iid: istock for iid, _, istock in _SEED_ITEMS}
                for item_id, item_name in seen.items():
                    results.append(_build_row(item_id, item_name,
                                              seed_stock.get(item_id, 20),
                                              target_month))
        except Exception as exc:
            _logger.debug("Could not fetch inventory_usage_history: %s", exc)

    # ── Strategy 3: built-in seed fallback ────────────────────────────────
    if not results:
        _logger.info("bulk_predictions: using seed item fallback")
        for iid, iname, istock in _SEED_ITEMS:
            results.append(_build_row(iid, iname, istock, target_month))

    # Sort: items needing reorder first, then by largest suggested order
    results.sort(key=lambda r: (not r.reorder_alert, -r.suggested_order))
    return results
