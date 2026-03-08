#!/usr/bin/env python
"""
ml/train_model.py
=================
Trains a RandomForestRegressor on ``inventory_usage_history`` and saves
the model to ``ml/demand_model.pkl``.

Run from the **backend/** directory:

    python -m ml.train_model

Or as a standalone script:

    python backend/ml/train_model.py
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path

# ── Path bootstrap ────────────────────────────────────────────────────────────
# Allows the script to be invoked directly without installing the package.
_ROOT = Path(__file__).resolve().parent.parent   # backend/
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
)
_logger = logging.getLogger(__name__)

MODEL_OUT = Path(__file__).parent / "demand_model.pkl"
MIN_ROWS  = 6   # refuse to train on fewer rows than this


# ── Database helpers ──────────────────────────────────────────────────────────

def _get_engine():
    """Return an SQLAlchemy engine using DATABASE_URL from .env / environment."""
    from dotenv import load_dotenv
    load_dotenv(_ROOT / ".env")
    from app.db.session import engine
    return engine


def get_training_data():
    """Fetch and pre-process historical usage data from PostgreSQL."""
    import pandas as pd

    engine = _get_engine()
    df = pd.read_sql_query(
        """
        SELECT
            item_id,
            EXTRACT(MONTH FROM month)::int  AS month_num,
            quantity_used
        FROM inventory_usage_history
        ORDER BY month
        """,
        engine,
    )
    _logger.info("Loaded %d rows from inventory_usage_history", len(df))
    return df


# ── Training ──────────────────────────────────────────────────────────────────

def train_and_save(df) -> object:
    """Fit a RandomForestRegressor and persist it to MODEL_OUT."""
    from sklearn.ensemble import RandomForestRegressor
    import joblib

    X = df[["month_num", "item_id"]]
    y = df["quantity_used"]

    model = RandomForestRegressor(
        n_estimators=100,
        max_depth=None,
        min_samples_leaf=1,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X, y)

    MODEL_OUT.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_OUT)
    _logger.info("Model saved → %s  (trained on %d rows)", MODEL_OUT, len(df))
    return model


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    _logger.info("=== CampusLedger — demand model training ===")
    df = get_training_data()

    if len(df) < MIN_ROWS:
        _logger.error(
            "Too few training rows (%d/%d).  "
            "Seed inventory_usage_history first (migration 005).",
            len(df), MIN_ROWS,
        )
        sys.exit(1)

    _logger.info("Training RandomForestRegressor on %d rows…", len(df))
    train_and_save(df)
    _logger.info("Done. ✓")


if __name__ == "__main__":
    main()
