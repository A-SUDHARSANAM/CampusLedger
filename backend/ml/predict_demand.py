"""
ml/predict_demand.py
====================
Loads the trained RandomForest demand model and exposes a single
``predict_demand(month, item_id)`` function.

Falls back to a deterministic seasonal heuristic when the model file has
not been trained yet so the API always returns a useful value.
"""

from __future__ import annotations

import logging
from pathlib import Path

import numpy as np

_logger = logging.getLogger(__name__)

# Path to the serialised model — sits alongside this file: backend/ml/demand_model.pkl
MODEL_PATH = Path(__file__).parent / "demand_model.pkl"

# In-process model cache (loaded once, reused for all requests)
_model = None


def _load_model():
    """Load the model from disk into the module-level cache."""
    global _model
    if _model is not None:
        return _model
    if not MODEL_PATH.exists():
        _logger.warning(
            "demand_model.pkl not found at %s — using heuristic fallback. "
            "Run `python -m ml.train_model` to train the model.",
            MODEL_PATH,
        )
        return None
    try:
        import joblib  # imported lazily so the module loads even without joblib
        _model = joblib.load(MODEL_PATH)
        _logger.info("Demand model loaded from %s", MODEL_PATH)
    except Exception as exc:
        _logger.warning("Failed to load demand model: %s", exc)
        _model = None
    return _model


def predict_demand(month: int, item_id: int) -> float:
    """
    Predict ``quantity_used`` for the given (month, item_id) pair.

    Parameters
    ----------
    month    : int  — target month (1–12)
    item_id  : int  — inventory item primary key

    Returns
    -------
    float — predicted demand units (always ≥ 0)

    Fallback
    --------
    When the model is absent or raises an error, a seasonal heuristic is
    used so the UI still shows meaningful data before the first training run.
    """
    model = _load_model()
    if model is not None:
        try:
            import pandas as pd
            features = pd.DataFrame([[month, item_id]], columns=["month_num", "item_id"])
            return max(0.0, float(model.predict(features)[0]))
        except Exception as exc:
            _logger.warning("Model prediction error (item=%s month=%s): %s", item_id, month, exc)

    # ── Heuristic fallback ────────────────────────────────────────────────────
    # Produces a repeatable, item-specific value with light seasonality.
    base = 12 + (item_id % 8) * 3          # 12 – 33 depending on item
    peak = month in (3, 6, 9, 12)          # quarter-end months are busier
    seasonal_mult = 1.20 if peak else 1.0
    return round(base * seasonal_mult, 1)


def reload_model() -> None:
    """
    Bust the in-process cache so the next call to ``predict_demand``
    reloads the model from disk.  Call this after retraining.
    """
    global _model
    _model = None
    _load_model()
