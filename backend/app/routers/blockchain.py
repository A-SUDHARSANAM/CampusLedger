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
