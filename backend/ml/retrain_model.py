#!/usr/bin/env python
"""
ml/retrain_model.py
===================
Re-trains the demand model on the latest data and reloads it into memory.

Can be run two ways:

1. **Standalone** (run once from the command line):

       python backend/ml/retrain_model.py

2. **Scheduled** (inside the FastAPI app via APScheduler):

       from ml.retrain_model import start_background_scheduler
       start_background_scheduler()   # fires on the 1st of every month at 02:00

APScheduler is optional — install with:

    pip install apscheduler
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
)
_logger = logging.getLogger(__name__)


# ── Core retrain function ─────────────────────────────────────────────────────

def retrain() -> None:
    """
    Fetch the latest inventory_usage_history rows, retrain the model, save it,
    and bust the in-process model cache so predictions immediately use the new file.
    """
    from ml.train_model import get_training_data, train_and_save, MIN_ROWS

    _logger.info("[retrain] Fetching latest training data…")
    try:
        df = get_training_data()
    except Exception as exc:
        _logger.error("[retrain] Could not fetch training data: %s", exc)
        return

    if len(df) < MIN_ROWS:
        _logger.warning(
            "[retrain] Not enough rows (%d/%d) — skipping retraining.",
            len(df), MIN_ROWS,
        )
        return

    _logger.info("[retrain] Training on %d rows…", len(df))
    try:
        train_and_save(df)
    except Exception as exc:
        _logger.error("[retrain] Training failed: %s", exc)
        return

    # Bust the in-process model cache so predictions pick up the new file
    try:
        from ml.predict_demand import reload_model
        reload_model()
        _logger.info("[retrain] In-process model cache refreshed. ✓")
    except Exception as exc:
        _logger.warning("[retrain] Cache reload failed (non-fatal): %s", exc)

    _logger.info("[retrain] Complete.")


# ── APScheduler integration ───────────────────────────────────────────────────

def start_background_scheduler() -> None:
    """
    Start an APScheduler ``BackgroundScheduler`` that calls ``retrain()``
    on the 1st of every month at 02:00.

    Safe to call from the FastAPI ``lifespan`` context.
    Silently skips scheduling if APScheduler is not installed.
    """
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
    except ImportError:
        _logger.warning(
            "APScheduler not installed — automatic monthly retraining is disabled. "
            "Install with: pip install apscheduler"
        )
        return

    scheduler = BackgroundScheduler(timezone="UTC")
    scheduler.add_job(
        retrain,
        trigger="cron",
        day=1,
        hour=2,
        minute=0,
        id="monthly_demand_retrain",
        replace_existing=True,
        misfire_grace_time=3600,   # tolerate up to 1 h of server downtime
    )
    scheduler.start()
    _logger.info("Monthly demand retrain scheduler started (fires 1st of each month 02:00 UTC).")


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    retrain()
