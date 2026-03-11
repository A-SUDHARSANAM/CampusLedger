"""
seed_blockchain.py
==================
Populate the blockchain_ledger table with realistic dummy audit events.

Usage
-----
  cd d:\\CampusLedger\\backend
  python seed_blockchain.py

The script is idempotent — it checks whether the chain already has events
beyond the genesis block and skips seeding if it does, so it is safe to
run multiple times without creating duplicate chains.
"""
from __future__ import annotations

import os
import sys
import time

from dotenv import load_dotenv

load_dotenv()

# ── Supabase client ────────────────────────────────────────────────────────────
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    sys.exit("ERROR: SUPABASE_URL and SUPABASE_KEY must be set in .env")

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Import blockchain service ──────────────────────────────────────────────────
sys.path.insert(0, os.path.dirname(__file__))
from app.services.blockchain_service import record_event

TABLE = "blockchain_ledger"


# ── Dummy events definition ────────────────────────────────────────────────────
EVENTS = [
    # (asset_id, asset_name, action, performed_by, extra_data)
    (
        "asset-001",
        "Dell Latitude 5540 Laptop",
        "ASSET_CREATED",
        "admin@campus.edu",
        {"lab": "CS Electronics Lab", "serial": "DL5540-001", "value_inr": 72000},
    ),
    (
        "asset-002",
        "Rigol DS1054Z Oscilloscope",
        "ASSET_CREATED",
        "admin@campus.edu",
        {"lab": "Advanced Electronics Lab", "serial": "RG-DS1054-007", "value_inr": 38500},
    ),
    (
        "asset-003",
        "Raspberry Pi 4 Kit",
        "PROCUREMENT",
        "purchase@campus.edu",
        {"quantity": 5, "supplier": "CoolComponents India", "po_number": "PO-2025-0042", "total_inr": 22000},
    ),
    (
        "asset-004",
        "Epson EB-X51 Projector",
        "ASSET_CREATED",
        "admin@campus.edu",
        {"lab": "Mechanical Workshop", "serial": "EP-EB-X51-003", "value_inr": 55000},
    ),
    (
        "asset-005",
        "Keysight U1241C Multimeter",
        "ASSET_CREATED",
        "admin@campus.edu",
        {"lab": "Physics Optics Lab", "serial": "KS-U1241-012", "value_inr": 18500},
    ),
    (
        "asset-001",
        "Dell Latitude 5540 Laptop",
        "MAINTENANCE_RAISED",
        "technician@campus.edu",
        {"issue": "Fan making loud noise, thermal throttling observed", "priority": "High"},
    ),
    (
        "asset-002",
        "Rigol DS1054Z Oscilloscope",
        "ASSET_TRANSFERRED",
        "lab_tech@campus.edu",
        {"from_lab": "Advanced Electronics Lab", "to_lab": "CS Electronics Lab", "reason": "Student project requirement"},
    ),
    (
        "asset-006",
        "HP LaserJet Pro M404n",
        "PROCUREMENT",
        "purchase@campus.edu",
        {"quantity": 2, "supplier": "HP Authorized Reseller", "po_number": "PO-2025-0051", "total_inr": 42000},
    ),
    (
        "asset-001",
        "Dell Latitude 5540 Laptop",
        "MAINTENANCE_DONE",
        "service@campus.edu",
        {"resolution": "Replaced thermal paste and cleaned fan. Boot time restored.", "cost_inr": 850, "downtime_days": 3},
    ),
    (
        "asset-004",
        "Epson EB-X51 Projector",
        "ASSET_UPDATED",
        "admin@campus.edu",
        {"field": "status", "old_value": "Active", "new_value": "Under Repair", "reason": "Lamp lifetime warning triggered"},
    ),
    (
        "asset-007",
        "Rohde & Schwarz Spectrum Analyzer",
        "PROCUREMENT",
        "purchase@campus.edu",
        {"quantity": 1, "supplier": "Rohde & Schwarz India", "po_number": "PO-2025-0063", "total_inr": 485000},
    ),
    (
        "asset-007",
        "Rohde & Schwarz Spectrum Analyzer",
        "ASSET_CREATED",
        "admin@campus.edu",
        {"lab": "Network & Security Lab", "serial": "RS-SA-4007", "value_inr": 485000},
    ),
    (
        "asset-003",
        "Raspberry Pi 4 Kit",
        "MAINTENANCE_RAISED",
        "lab_tech@campus.edu",
        {"issue": "Two units not booting — SD card corruption suspected", "priority": "Medium"},
    ),
    (
        "asset-008",
        "IBM ThinkCentre M720q Desktop",
        "ASSET_DISPOSED",
        "admin@campus.edu",
        {"reason": "End of life — hardware failure beyond economic repair", "disposal_method": "e-Waste recycling", "book_value_inr": 0},
    ),
    (
        "asset-003",
        "Raspberry Pi 4 Kit",
        "MAINTENANCE_DONE",
        "service@campus.edu",
        {"resolution": "Replaced SD cards on 2 units, re-flashed OS image.", "cost_inr": 400, "units_repaired": 2},
    ),
    (
        "asset-007",
        "Rohde & Schwarz Spectrum Analyzer",
        "ASSET_TRANSFERRED",
        "lab_tech@campus.edu",
        {"from_lab": "Network & Security Lab", "to_lab": "Advanced Electronics Lab", "reason": "Semester schedule reassignment"},
    ),
]


def already_seeded() -> bool:
    """Return True if the chain already has the full demo dataset (17+ blocks)."""
    try:
        count_res = sb.table(TABLE).select("id", count="exact").execute()
        total = count_res.count if count_res.count is not None else len(count_res.data or [])
        return total >= 17
    except Exception:
        return False


def main() -> None:
    if already_seeded():
        print("⚠  Chain already has data beyond genesis — skipping seed.")
        print("   Delete the blockchain_ledger rows first if you want to re-seed.")
        sys.exit(0)

    print(f"Seeding {len(EVENTS)} blockchain events …\n")
    for i, (asset_id, asset_name, action, performed_by, extra_data) in enumerate(EVENTS, 1):
        h = record_event(sb, asset_id, asset_name, action, performed_by, extra_data)
        status = "✓" if h else "✗ FAILED"
        print(f"  [{i:02d}/{len(EVENTS)}] {status}  {action:<22}  {asset_name}")
        time.sleep(0.05)  # tiny gap so created_at timestamps differ

    print(f"\nDone. {len(EVENTS)} blocks inserted.")


if __name__ == "__main__":
    main()
