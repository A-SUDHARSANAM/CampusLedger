#!/usr/bin/env python
"""
ml/seed_and_train.py
====================
Trains the demand model using the hardcoded seed dataset (no database required).

Useful for local development or when DATABASE_URL is not yet configured.
The resulting model is saved to ml/demand_model.pkl and will be used by the
prediction API immediately.

Run from the backend/ directory:

    python -m ml.seed_and_train
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
_logger = logging.getLogger(__name__)

MODEL_OUT = Path(__file__).parent / "demand_model.pkl"

# ── Seed data mirrors migration 005 ──────────────────────────────────────────
_SEED_ROWS = [
    # (item_id, month_num, quantity_used)
    (1, 1, 18), (1, 2, 22), (1, 3, 27), (1, 4, 24), (1, 5, 20), (1, 6, 30),
    (1, 7, 28), (1, 8, 25), (1, 9, 32), (1,10, 35), (1,11, 38), (1,12, 42),
    (1, 1, 20), (1, 2, 26), (1, 3, 31), (1, 4, 29), (1, 5, 22), (1, 6, 33),

    (2, 1,  9), (2, 2, 11), (2, 3, 14), (2, 4, 12), (2, 5, 10), (2, 6, 16),
    (2, 7, 15), (2, 8, 13), (2, 9, 18), (2,10, 20), (2,11, 22), (2,12, 25),
    (2, 1, 10), (2, 2, 13), (2, 3, 16), (2, 4, 14), (2, 5, 11), (2, 6, 18),

    (3, 1,  8), (3, 2, 10), (3, 3, 13), (3, 4, 11), (3, 5,  9), (3, 6, 15),
    (3, 7, 14), (3, 8, 12), (3, 9, 17), (3,10, 19), (3,11, 21), (3,12, 23),
    (3, 1,  9), (3, 2, 12), (3, 3, 15), (3, 4, 13), (3, 5, 10), (3, 6, 17),

    (4, 1,  4), (4, 2,  5), (4, 3,  7), (4, 4,  6), (4, 5,  4), (4, 6,  8),
    (4, 7,  7), (4, 8,  6), (4, 9,  9), (4,10, 10), (4,11, 11), (4,12, 13),
    (4, 1,  5), (4, 2,  6), (4, 3,  8), (4, 4,  7), (4, 5,  5), (4, 6,  9),

    (5, 1,  2), (5, 2,  3), (5, 3,  4), (5, 4,  3), (5, 5,  2), (5, 6,  5),
    (5, 7,  4), (5, 8,  3), (5, 9,  6), (5,10,  7), (5,11,  8), (5,12,  9),
    (5, 1,  2), (5, 2,  3), (5, 3,  5), (5, 4,  4), (5, 5,  2), (5, 6,  6),

    (6, 1,  6), (6, 2,  8), (6, 3, 10), (6, 4,  9), (6, 5,  7), (6, 6, 12),
    (6, 7, 11), (6, 8,  9), (6, 9, 13), (6,10, 15), (6,11, 16), (6,12, 18),
    (6, 1,  7), (6, 2,  9), (6, 3, 11), (6, 4, 10), (6, 5,  8), (6, 6, 13),
]


def main() -> None:
    try:
        import pandas as pd
        from sklearn.ensemble import RandomForestRegressor
        import joblib
    except ImportError as e:
        _logger.error("Missing dependency: %s  — run: pip install scikit-learn pandas joblib", e)
        sys.exit(1)

    df = pd.DataFrame(_SEED_ROWS, columns=["item_id", "month_num", "quantity_used"])
    _logger.info("Training on %d seed rows…", len(df))

    X = df[["month_num", "item_id"]]
    y = df["quantity_used"]

    model = RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1)
    model.fit(X, y)

    MODEL_OUT.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_OUT)
    _logger.info("Model saved → %s", MODEL_OUT)

    # Bust cache so running API picks up the new model immediately
    try:
        from ml.predict_demand import reload_model
        reload_model()
    except Exception:
        pass

    # Quick sanity check
    _logger.info(
        "Sanity — predict item=1 month=4 (April): %.1f  |  item=2 month=12 (Dec): %.1f",
        float(model.predict([[4, 1]])[0]),
        float(model.predict([[12, 2]])[0]),
    )
    _logger.info("Done. ✓  The /predict-demand and /inventory/predictions APIs will now use the trained model.")


if __name__ == "__main__":
    main()
