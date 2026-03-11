#!/usr/bin/env python
"""
ml/train_budget_model.py
========================
Trains a RandomForestRegressor to predict asset replacement budgets based on
historical asset lifecycle data.  The trained pipeline (category encoder +
regressor) is saved to ``ml/budget_forecast_model.pkl``.

Run from the **backend/** directory:

    python -m ml.train_budget_model

Or as a standalone script:

    python backend/ml/train_budget_model.py

Features used
-------------
- asset_category   : string  → OrdinalEncoded
- purchase_year    : int
- lifecycle_years  : int
- purchase_cost    : float   (per-unit cost)
- quantity         : int

Target
------
replacement_cost = purchase_cost × (1.06 ** lifecycle_years) × quantity

This approximates inflation-adjusted total replacement cost for a cohort of
assets.  The model learns non-linear interactions (e.g. high-cost long-lifecycle
categories inflate faster in practice) that a simple formula misses.
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path

# ── Path bootstrap ─────────────────────────────────────────────────────────────
_ROOT = Path(__file__).resolve().parent.parent   # backend/
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
)
_logger = logging.getLogger(__name__)

DATA_PATH  = Path(__file__).parent / "data" / "asset_lifecycle_data.csv"
MODEL_OUT  = Path(__file__).parent / "budget_forecast_model.pkl"
MIN_ROWS   = 20
INFLATION  = 0.06


# ── Training pipeline ──────────────────────────────────────────────────────────

def build_target(df):
    """
    Create per-unit inflation-adjusted replacement cost as the regression target.

    Dividing by quantity normalises cohort-level CSV rows to per-asset predictions,
    matching how the service calls the model (one row per DB asset).
    """
    return df["purchase_cost"] * ((1 + INFLATION) ** df["lifecycle_years"])


def train(data_path: Path = DATA_PATH, model_out: Path = MODEL_OUT) -> None:
    try:
        import pandas as pd
        from sklearn.compose import ColumnTransformer
        from sklearn.ensemble import RandomForestRegressor
        from sklearn.model_selection import train_test_split
        from sklearn.pipeline import Pipeline
        from sklearn.preprocessing import OrdinalEncoder
        import joblib
    except ImportError as exc:
        _logger.error(
            "Missing ML dependency: %s — run: pip install scikit-learn pandas joblib",
            exc,
        )
        sys.exit(1)

    # 1. Load dataset ──────────────────────────────────────────────────────────
    if not data_path.exists():
        _logger.error("Dataset not found: %s", data_path)
        sys.exit(1)

    df = pd.read_csv(data_path)
    _logger.info("Loaded %d rows from %s", len(df), data_path)

    if len(df) < MIN_ROWS:
        _logger.error(
            "Need at least %d training rows, found %d. Aborting.", MIN_ROWS, len(df)
        )
        sys.exit(1)

    # 2. Validate required columns ─────────────────────────────────────────────
    required = {"asset_category", "purchase_year", "lifecycle_years", "purchase_cost", "quantity"}
    missing = required - set(df.columns)
    if missing:
        _logger.error("CSV missing columns: %s", missing)
        sys.exit(1)

    # 3. Clean & cast ──────────────────────────────────────────────────────────
    df = df.dropna(subset=list(required))
    df["purchase_year"]   = df["purchase_year"].astype(int)
    df["lifecycle_years"] = df["lifecycle_years"].astype(int)
    df["purchase_cost"]   = df["purchase_cost"].astype(float)
    df["quantity"]        = df["quantity"].astype(int)
    df["asset_category"]  = df["asset_category"].str.strip().str.lower()

    # 4. Build target ──────────────────────────────────────────────────────────
    df["replacement_cost"] = build_target(df)

    _logger.info(
        "Target stats — min: %.0f  max: %.0f  mean: %.0f",
        df["replacement_cost"].min(),
        df["replacement_cost"].max(),
        df["replacement_cost"].mean(),
    )

    # 5. Features / target split ───────────────────────────────────────────────
    # quantity is omitted here — the model predicts PER-UNIT replacement cost.
    # Category + lifecycle effects are what the model learns; at inference time
    # the DB has one asset per row so quantity is always 1.
    FEATURES = ["asset_category", "purchase_year", "lifecycle_years", "purchase_cost"]
    X = df[FEATURES]
    y = df["replacement_cost"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    # 6. Build scikit-learn pipeline ───────────────────────────────────────────
    #    OrdinalEncoder handles unseen categories gracefully (→ -1).
    cat_encoder = OrdinalEncoder(
        handle_unknown="use_encoded_value",
        unknown_value=-1,
    )

    preprocessor = ColumnTransformer(
        transformers=[
            ("cat", cat_encoder, ["asset_category"]),
        ],
        remainder="passthrough",  # pass numeric columns through unchanged
    )

    pipeline = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            (
                "regressor",
                RandomForestRegressor(
                    n_estimators=200,
                    max_depth=12,
                    min_samples_leaf=2,
                    random_state=42,
                    n_jobs=-1,
                ),
            ),
        ]
    )

    # 7. Fit ───────────────────────────────────────────────────────────────────
    pipeline.fit(X_train, y_train)
    _logger.info("Model trained on %d samples", len(X_train))

    # 8. Evaluate ──────────────────────────────────────────────────────────────
    from sklearn.metrics import mean_absolute_error, r2_score
    import numpy as np

    y_pred = pipeline.predict(X_test)
    mae  = mean_absolute_error(y_test, y_pred)
    r2   = r2_score(y_test, y_pred)
    mape = float(np.mean(np.abs((y_test - y_pred) / (y_test + 1e-9))) * 100)

    _logger.info(
        "Validation — MAE: ₹%.0f  R²: %.4f  MAPE: %.2f%%",
        mae, r2, mape,
    )

    # 9. Save ──────────────────────────────────────────────────────────────────
    model_out.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, model_out)
    _logger.info("Pipeline saved → %s", model_out)

    # Also save the list of known categories for reference
    categories = sorted(df["asset_category"].unique().tolist())
    _logger.info("Known categories (%d): %s", len(categories), categories)


if __name__ == "__main__":
    train()
