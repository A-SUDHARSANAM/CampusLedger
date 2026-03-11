"""
app/routers/blockchain.py
==========================
Blockchain audit trail endpoints for CampusLedger.

Endpoints
---------
GET  /blockchain/ledger            — Paginated full chain (all events)
GET  /blockchain/asset/{asset_id}  — All blocks for a single asset
GET  /blockchain/verify            — Verify chain integrity
POST /blockchain/record            — Manually record an event (admin only)
"""
from __future__ import annotations

import logging
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from supabase import Client

from app.db.supabase import get_admin_client
from app.routers.auth_routes import require_role
from app.services.blockchain_service import record_event, verify_chain

_logger = logging.getLogger(__name__)

router = APIRouter(prefix="/blockchain", tags=["Blockchain Audit"])

_require_admin     = require_role("admin")
_require_any       = require_role("admin", "lab_technician", "purchase_dept", "service_staff")

TABLE = "blockchain_ledger"


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class BlockOut(BaseModel):
    id: str
    block_index: int
    asset_id: str
    asset_name: str
    action: str
    performed_by: str
    block_hash: str
    prev_hash: str
    block_data: Any
    created_at: str


class RecordIn(BaseModel):
    asset_id: str
    asset_name: str
    action: str
    performed_by: str
    extra_data: Optional[dict] = None


class VerifyOut(BaseModel):
    intact: bool
    total_blocks: int
    first_broken_index: Optional[int] = None
    message: str


# ── Helper ─────────────────────────────────────────────────────────────────────

def _row_to_block(row: dict) -> BlockOut:
    return BlockOut(
        id=str(row.get("id", "")),
        block_index=int(row.get("block_index", 0)),
        asset_id=str(row.get("asset_id", "")),
        asset_name=str(row.get("asset_name", "")),
        action=str(row.get("action", "")),
        performed_by=str(row.get("performed_by", "")),
        block_hash=str(row.get("block_hash", "")),
        prev_hash=str(row.get("prev_hash", "")),
        block_data=row.get("block_data") or {},
        created_at=str(row.get("created_at", "")),
    )


# ── GET /blockchain/ledger ─────────────────────────────────────────────────────

@router.get(
    "/ledger",
    response_model=List[BlockOut],
    summary="Paginated blockchain ledger (newest first)",
)
def get_ledger(
    limit: int = Query(50, ge=1, le=200, description="Rows per page"),
    offset: int = Query(0, ge=0, description="Row offset"),
    action: Optional[str] = Query(None, description="Filter by action type (e.g. ASSET_CREATED)"),
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_any),
):
    try:
        q = (
            sb.table(TABLE)
            .select("*")
            .order("block_index", desc=True)
            .range(offset, offset + limit - 1)
        )
        if action:
            q = q.eq("action", action.upper())
        rows = q.execute().data or []
        return [_row_to_block(r) for r in rows]
    except Exception as exc:
        _logger.error("get_ledger failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ── GET /blockchain/asset/{asset_id} ──────────────────────────────────────────

@router.get(
    "/asset/{asset_id}",
    response_model=List[BlockOut],
    summary="Blockchain history for a single asset",
)
def get_asset_history(
    asset_id: str,
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_any),
):
    try:
        rows = (
            sb.table(TABLE)
            .select("*")
            .eq("asset_id", asset_id)
            .order("block_index")
            .execute()
            .data or []
        )
        return [_row_to_block(r) for r in rows]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── GET /blockchain/verify ─────────────────────────────────────────────────────

@router.get(
    "/verify",
    response_model=VerifyOut,
    summary="Verify the integrity of the entire chain",
)
def verify(
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_any),
):
    result = verify_chain(sb)
    intact = result.get("intact", False)
    return VerifyOut(
        intact=intact,
        total_blocks=result.get("total_blocks", 0),
        first_broken_index=result.get("first_broken_index"),
        message=(
            f"Chain verified — {result.get('total_blocks', 0)} blocks intact."
            if intact
            else f"Chain BROKEN at block {result.get('first_broken_index')}!"
        ),
    )


# ── POST /blockchain/record ────────────────────────────────────────────────────

@router.post(
    "/record",
    response_model=BlockOut,
    status_code=status.HTTP_201_CREATED,
    summary="Manually record a blockchain event (admin only)",
)
def manual_record(
    payload: RecordIn,
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_admin),
):
    block_hash = record_event(
        sb,
        asset_id=payload.asset_id,
        asset_name=payload.asset_name,
        action=payload.action.upper(),
        performed_by=payload.performed_by,
        extra_data=payload.extra_data,
    )
    if not block_hash:
        raise HTTPException(status_code=500, detail="Failed to record blockchain event")

    # Fetch the newly created block to return it
    row = (
        sb.table(TABLE)
        .select("*")
        .eq("block_hash", block_hash)
        .limit(1)
        .execute()
        .data
    )
    if not row:
        raise HTTPException(status_code=500, detail="Block recorded but not retrievable")
    return _row_to_block(row[0])


# ── GET /blockchain/stats ──────────────────────────────────────────────────────

class StatsOut(BaseModel):
    total_events: int
    assets_created: int
    transferred: int
    disposed: int
    maintenance_raised: int
    maintenance_done: int
    procurement: int


@router.get(
    "/stats",
    response_model=StatsOut,
    summary="Count of blockchain events per action type",
)
def get_stats(
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_any),
):
    """
    Returns aggregate counts for the most important action types.
    Computed server-side so the frontend dashboard is always accurate
    regardless of pagination.
    """
    try:
        rows = (
            sb.table(TABLE)
            .select("action")
            .execute()
            .data or []
        )
        total = len(rows)
        counts: dict[str, int] = {}
        for r in rows:
            a = str(r.get("action", ""))
            counts[a] = counts.get(a, 0) + 1
        return StatsOut(
            total_events=total,
            assets_created=counts.get("ASSET_CREATED", 0),
            transferred=counts.get("ASSET_TRANSFERRED", 0),
            disposed=counts.get("ASSET_DISPOSED", 0),
            maintenance_raised=counts.get("MAINTENANCE_RAISED", 0),
            maintenance_done=counts.get("MAINTENANCE_DONE", 0),
            procurement=counts.get("PROCUREMENT", 0),
        )
    except Exception as exc:
        _logger.error("get_stats failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ── POST /blockchain/seed-demo ─────────────────────────────────────────────────

_DEMO_EVENTS = [
    ("asset-001", "Dell Latitude 5540 Laptop",          "ASSET_CREATED",       "admin@campus.edu",    {"lab": "CS Electronics Lab",        "serial": "DL5540-001",    "value_inr": 72000}),
    ("asset-002", "Rigol DS1054Z Oscilloscope",         "ASSET_CREATED",       "admin@campus.edu",    {"lab": "Advanced Electronics Lab",  "serial": "RG-DS1054-007", "value_inr": 38500}),
    ("asset-003", "Raspberry Pi 4 Kit",                 "PROCUREMENT",         "purchase@campus.edu", {"quantity": 5, "supplier": "CoolComponents India", "po_number": "PO-2025-0042", "total_inr": 22000}),
    ("asset-004", "Epson EB-X51 Projector",             "ASSET_CREATED",       "admin@campus.edu",    {"lab": "Mechanical Workshop",        "serial": "EP-EB-X51-003", "value_inr": 55000}),
    ("asset-005", "Keysight U1241C Multimeter",         "ASSET_CREATED",       "admin@campus.edu",    {"lab": "Physics Optics Lab",         "serial": "KS-U1241-012",  "value_inr": 18500}),
    ("asset-001", "Dell Latitude 5540 Laptop",          "MAINTENANCE_RAISED",  "technician@campus.edu", {"issue": "Fan making loud noise, thermal throttling observed", "priority": "High"}),
    ("asset-002", "Rigol DS1054Z Oscilloscope",         "ASSET_TRANSFERRED",   "lab_tech@campus.edu", {"from_lab": "Advanced Electronics Lab", "to_lab": "CS Electronics Lab", "reason": "Student project requirement"}),
    ("asset-006", "HP LaserJet Pro M404n",              "PROCUREMENT",         "purchase@campus.edu", {"quantity": 2, "supplier": "HP Authorized Reseller", "po_number": "PO-2025-0051", "total_inr": 42000}),
    ("asset-001", "Dell Latitude 5540 Laptop",          "MAINTENANCE_DONE",    "service@campus.edu",  {"resolution": "Replaced thermal paste and cleaned fan.", "cost_inr": 850, "downtime_days": 3}),
    ("asset-004", "Epson EB-X51 Projector",             "ASSET_UPDATED",       "admin@campus.edu",    {"field": "status", "old_value": "Active", "new_value": "Under Repair"}),
    ("asset-007", "Rohde & Schwarz Spectrum Analyzer",  "PROCUREMENT",         "purchase@campus.edu", {"quantity": 1, "supplier": "Rohde & Schwarz India", "po_number": "PO-2025-0063", "total_inr": 485000}),
    ("asset-007", "Rohde & Schwarz Spectrum Analyzer",  "ASSET_CREATED",       "admin@campus.edu",    {"lab": "Network & Security Lab", "serial": "RS-SA-4007", "value_inr": 485000}),
    ("asset-003", "Raspberry Pi 4 Kit",                 "MAINTENANCE_RAISED",  "lab_tech@campus.edu", {"issue": "Two units not booting — SD card corruption", "priority": "Medium"}),
    ("asset-008", "IBM ThinkCentre M720q Desktop",      "ASSET_DISPOSED",      "admin@campus.edu",    {"reason": "End of life", "disposal_method": "e-Waste recycling", "book_value_inr": 0}),
    ("asset-003", "Raspberry Pi 4 Kit",                 "MAINTENANCE_DONE",    "service@campus.edu",  {"resolution": "Replaced SD cards, re-flashed OS.", "cost_inr": 400, "units_repaired": 2}),
    ("asset-007", "Rohde & Schwarz Spectrum Analyzer",  "ASSET_TRANSFERRED",   "lab_tech@campus.edu", {"from_lab": "Network & Security Lab", "to_lab": "Advanced Electronics Lab", "reason": "Semester reassignment"}),
]


class SeedDemoOut(BaseModel):
    seeded: bool
    blocks_added: int
    message: str


@router.post(
    "/seed-demo",
    response_model=SeedDemoOut,
    status_code=status.HTTP_200_OK,
    summary="Insert demo blockchain events (authenticated users only)",
)
def seed_demo(
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_any),
):
    """
    Inserts 16 realistic demo blockchain events so the audit page has
    something to display in development / demo environments.
    Idempotent: if the chain already has more than 1 block (beyond the
    genesis) the endpoint does nothing and returns seeded=False.
    """
    try:
        count_res = sb.table(TABLE).select("id", count="exact").execute()
        total = count_res.count if count_res.count is not None else len(count_res.data or [])
        if total >= 17:
            return SeedDemoOut(seeded=False, blocks_added=0, message="Demo data already exists — seed skipped.")

        added = 0
        for asset_id, asset_name, action, performed_by, extra_data in _DEMO_EVENTS:
            h = record_event(sb, asset_id, asset_name, action, performed_by, extra_data)
            if h:
                added += 1

        return SeedDemoOut(seeded=True, blocks_added=added, message=f"Seeded {added} demo blocks successfully.")
    except Exception as exc:
        _logger.error("seed_demo failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
