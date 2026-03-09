"""
app/routers/rfid.py
=====================
RFID-based asset tracking endpoints.

Endpoints
---------
POST /rfid/scan                  — RFID reader posts a tag read (movement detection)
GET  /rfid/movements             — List movement history
GET  /rfid/alerts                — List unauthorized movement alerts
POST /rfid/usage/start           — Begin a usage session
POST /rfid/usage/end             — End a usage session
GET  /rfid/usage                 — List / analytics for usage logs
GET  /rfid/tags                  — List registered RFID tags
POST /rfid/tags                  — Register a new RFID tag for an asset
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from supabase import Client

from app.db.supabase import get_admin_client
from app.routers.auth_routes import require_role
from app.services.blockchain_service import record_event as _bc_record
from app.services.notification_service import notify_reorder_alert  # reuse notification utility

_logger = logging.getLogger(__name__)

router = APIRouter(prefix="/rfid", tags=["RFID Tracking"])

_require_any       = require_role("admin", "lab_technician", "service_staff", "purchase_dept")
_require_admin     = require_role("admin")
_require_admin_or_tech = require_role("admin", "lab_technician")


# ── Authorized zones: asset_id → list of location strings ────────────────────
# In a real deployment this would be stored in the DB per-asset.
# For the demo it's computed as: an asset is "authorized" in its current lab_id.
# Movement outside its registered lab generates an alert.


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class TagRegisterIn(BaseModel):
    rfid_tag: str
    asset_id: str
    asset_name: Optional[str] = None


class TagOut(BaseModel):
    id: str
    rfid_tag: str
    asset_id: Optional[str] = None
    asset_name: str
    is_active: bool
    created_at: str


class RFIDScanIn(BaseModel):
    rfid_tag: str
    reader_location: str
    reader_id: Optional[str] = None


class MovementOut(BaseModel):
    id: str
    rfid_tag: str
    asset_id: Optional[str] = None
    asset_name: str
    from_location: Optional[str] = None
    to_location: str
    is_authorized: bool
    created_at: str


class UsageStartIn(BaseModel):
    asset_id: str
    location: str
    triggered_by: str = "rfid"


class UsageEndIn(BaseModel):
    usage_log_id: str


class UsageOut(BaseModel):
    id: str
    asset_id: str
    asset_name: str
    location: str
    start_time: str
    end_time: Optional[str] = None
    duration_minutes: Optional[int] = None
    triggered_by: str
    created_at: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _asset_by_rfid(sb: Client, rfid_tag: str) -> Optional[dict[str, Any]]:
    """Return the asset linked to this RFID tag, or None if unknown."""
    tag_row = (
        sb.table("rfid_tags")
        .select("asset_id, asset_name")
        .eq("rfid_tag", rfid_tag)
        .eq("is_active", True)
        .maybe_single()
        .execute()
    )
    if not tag_row.data:
        return None
    return tag_row.data


def _is_authorized_location(sb: Client, asset_id: str, location: str) -> bool:
    """
    An asset is authorized at 'location' when that string matches the
    lab_name of the lab it is currently registered under.
    Unknown assets / unregistered labs are considered authorized to avoid
    false alerts from incomplete data.
    """
    try:
        asset = (
            sb.table("assets")
            .select("lab_id")
            .eq("id", asset_id)
            .maybe_single()
            .execute()
        )
        if not (asset.data and asset.data.get("lab_id")):
            return True  # no registered lab → no constraint
        lab = (
            sb.table("labs")
            .select("lab_name")
            .eq("id", asset.data["lab_id"])
            .maybe_single()
            .execute()
        )
        if not lab.data:
            return True
        registered_lab = (lab.data.get("lab_name") or "").lower().strip()
        return registered_lab in location.lower()
    except Exception:
        return True  # fail-safe: don't block on DB errors


def _notify_unauthorized(sb: Client, asset_name: str, location: str) -> None:
    """Push an unauthorized movement notification to all admins."""
    try:
        admins = sb.table("users").select("id").eq("role", "admin").execute().data or []
        for adm in admins:
            sb.table("notifications").insert({
                "user_id": adm["id"],
                "title":   "⚠ Unauthorized Asset Movement",
                "message": f'Asset "{asset_name}" detected at unauthorized location: {location}',
                "type":    "alert",
                "is_read": False,
            }).execute()
    except Exception as exc:
        _logger.warning("Failed to send unauthorized movement notification: %s", exc)


# ── POST /rfid/scan — RFID Feature 1 & 2 ─────────────────────────────────────

@router.post(
    "/scan",
    response_model=MovementOut,
    status_code=status.HTTP_201_CREATED,
    summary="RFID reader reports a tag scan (movement tracking + unauthorized alert)",
)
def rfid_scan(
    payload: RFIDScanIn,
    sb: Client = Depends(get_admin_client),
    current_user: dict = Depends(_require_any),
):
    """
    Called by a physical RFID reader (or simulated from the admin panel).
    1. Looks up the tag → asset mapping.
    2. Finds the asset's last known location (latest movement log).
    3. Determines if the new location is an authorized zone.
    4. Logs the movement.
    5. If unauthorized: inserts a notification for all admins.
    6. Updates the asset's location_id hint if a matching location is found.
    """
    asset_info = _asset_by_rfid(sb, payload.rfid_tag)
    asset_id   = asset_info["asset_id"]   if asset_info else None
    asset_name = asset_info["asset_name"] if asset_info else f"Unknown tag {payload.rfid_tag}"

    # Last known location from movement log
    last_loc: Optional[str] = None
    if asset_id:
        prev = (
            sb.table("rfid_movement_logs")
            .select("to_location")
            .eq("asset_id", asset_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
            .data
        )
        if prev:
            last_loc = prev[0].get("to_location")

    # Skip if same location (no real movement)
    if last_loc and last_loc.strip().lower() == payload.reader_location.strip().lower():
        # Return last log without inserting a duplicate
        dup = (
            sb.table("rfid_movement_logs")
            .select("*")
            .eq("asset_id", asset_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
            .data or []
        )
        if dup:
            r = dup[0]
            return MovementOut(
                id=str(r["id"]), rfid_tag=payload.rfid_tag,
                asset_id=asset_id, asset_name=asset_name,
                from_location=r.get("from_location"), to_location=r["to_location"],
                is_authorized=r["is_authorized"], created_at=str(r["created_at"]),
            )

    authorized = _is_authorized_location(sb, asset_id or "", payload.reader_location) if asset_id else True

    row = {
        "rfid_tag":      payload.rfid_tag,
        "asset_id":      asset_id,
        "asset_name":    asset_name,
        "from_location": last_loc,
        "to_location":   payload.reader_location,
        "is_authorized": authorized,
        "reader_id":     payload.reader_id,
    }
    result = sb.table("rfid_movement_logs").insert(row).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to log RFID movement")

    rec = result.data[0]

    # Alert admins on unauthorized movement
    if not authorized:
        _notify_unauthorized(sb, asset_name, payload.reader_location)

    # Blockchain audit
    if asset_id:
        _bc_record(
            sb,
            asset_id=asset_id,
            asset_name=asset_name,
            action="ASSET_TRANSFERRED" if authorized else "ASSET_UPDATED",
            performed_by="rfid_reader",
            extra_data={"from": last_loc, "to": payload.reader_location, "authorized": authorized},
        )

    return MovementOut(
        id=str(rec["id"]),
        rfid_tag=payload.rfid_tag,
        asset_id=asset_id,
        asset_name=asset_name,
        from_location=last_loc,
        to_location=payload.reader_location,
        is_authorized=authorized,
        created_at=str(rec["created_at"]),
    )


# ── GET /rfid/movements ───────────────────────────────────────────────────────

@router.get(
    "/movements",
    response_model=List[MovementOut],
    summary="List RFID movement history",
)
def list_movements(
    asset_id: Optional[str] = Query(None),
    unauthorized_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_admin_or_tech),
):
    q = (
        sb.table("rfid_movement_logs")
        .select("*")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
    )
    if asset_id:
        q = q.eq("asset_id", asset_id)
    if unauthorized_only:
        q = q.eq("is_authorized", False)
    rows = q.execute().data or []
    return [
        MovementOut(
            id=str(r["id"]),
            rfid_tag=str(r.get("rfid_tag", "")),
            asset_id=r.get("asset_id"),
            asset_name=str(r.get("asset_name", "")),
            from_location=r.get("from_location"),
            to_location=str(r.get("to_location", "")),
            is_authorized=bool(r.get("is_authorized", True)),
            created_at=str(r["created_at"]),
        )
        for r in rows
    ]


# ── GET /rfid/alerts — unauthorized movements ─────────────────────────────────

@router.get(
    "/alerts",
    response_model=List[MovementOut],
    summary="List unauthorized RFID movement alerts",
)
def list_alerts(
    limit: int = Query(20, ge=1, le=100),
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_admin),
):
    rows = (
        sb.table("rfid_movement_logs")
        .select("*")
        .eq("is_authorized", False)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
        .data or []
    )
    return [
        MovementOut(
            id=str(r["id"]),
            rfid_tag=str(r.get("rfid_tag", "")),
            asset_id=r.get("asset_id"),
            asset_name=str(r.get("asset_name", "")),
            from_location=r.get("from_location"),
            to_location=str(r.get("to_location", "")),
            is_authorized=False,
            created_at=str(r["created_at"]),
        )
        for r in rows
    ]


# ── POST /rfid/usage/start — RFID Feature 3 ───────────────────────────────────

@router.post(
    "/usage/start",
    response_model=UsageOut,
    status_code=status.HTTP_201_CREATED,
    summary="Start an asset usage session (RFID Feature 3)",
)
def start_usage(
    payload: UsageStartIn,
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_any),
):
    asset = sb.table("assets").select("id, asset_name").eq("id", payload.asset_id).maybe_single().execute()
    if not asset.data:
        raise HTTPException(status_code=404, detail="Asset not found")

    asset_name = asset.data.get("asset_name", payload.asset_id)

    # Close any open session for this asset first
    open_sessions = (
        sb.table("asset_usage_logs")
        .select("id")
        .eq("asset_id", payload.asset_id)
        .is_("end_time", "null")
        .execute()
        .data or []
    )
    for s in open_sessions:
        sb.table("asset_usage_logs").update({"end_time": datetime.now(timezone.utc).isoformat()}).eq("id", s["id"]).execute()

    row = {
        "asset_id":    payload.asset_id,
        "asset_name":  asset_name,
        "location":    payload.location,
        "triggered_by": payload.triggered_by,
    }
    result = sb.table("asset_usage_logs").insert(row).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to start usage log")

    rec = result.data[0]
    return UsageOut(
        id=str(rec["id"]),
        asset_id=str(rec["asset_id"]),
        asset_name=str(rec["asset_name"]),
        location=str(rec["location"]),
        start_time=str(rec["start_time"]),
        end_time=rec.get("end_time"),
        duration_minutes=rec.get("duration_minutes"),
        triggered_by=str(rec["triggered_by"]),
        created_at=str(rec["created_at"]),
    )


# ── POST /rfid/usage/end ───────────────────────────────────────────────────────

@router.post(
    "/usage/end",
    response_model=UsageOut,
    summary="End an asset usage session",
)
def end_usage(
    payload: UsageEndIn,
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_any),
):
    result = sb.table("asset_usage_logs").update({
        "end_time": datetime.now(timezone.utc).isoformat(),
    }).eq("id", payload.usage_log_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Usage log not found")

    rec = result.data[0]
    return UsageOut(
        id=str(rec["id"]),
        asset_id=str(rec["asset_id"]),
        asset_name=str(rec.get("asset_name", "")),
        location=str(rec["location"]),
        start_time=str(rec["start_time"]),
        end_time=rec.get("end_time"),
        duration_minutes=rec.get("duration_minutes"),
        triggered_by=str(rec["triggered_by"]),
        created_at=str(rec["created_at"]),
    )


# ── GET /rfid/usage ────────────────────────────────────────────────────────────

@router.get(
    "/usage",
    response_model=List[UsageOut],
    summary="List asset usage sessions (admin analytics)",
)
def list_usage(
    asset_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_admin_or_tech),
):
    q = (
        sb.table("asset_usage_logs")
        .select("*")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
    )
    if asset_id:
        q = q.eq("asset_id", asset_id)
    rows = q.execute().data or []
    return [
        UsageOut(
            id=str(r["id"]),
            asset_id=str(r["asset_id"]),
            asset_name=str(r.get("asset_name", "")),
            location=str(r.get("location", "")),
            start_time=str(r["start_time"]),
            end_time=r.get("end_time"),
            duration_minutes=r.get("duration_minutes"),
            triggered_by=str(r.get("triggered_by", "rfid")),
            created_at=str(r["created_at"]),
        )
        for r in rows
    ]


# ── GET /rfid/tags — list registered tags ─────────────────────────────────────

@router.get(
    "/tags",
    response_model=List[TagOut],
    summary="List all registered RFID tags",
)
def list_tags(
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_admin_or_tech),
):
    rows = sb.table("rfid_tags").select("*").order("created_at", desc=True).execute().data or []
    return [
        TagOut(
            id=str(r["id"]),
            rfid_tag=str(r["rfid_tag"]),
            asset_id=r.get("asset_id"),
            asset_name=str(r.get("asset_name", "")),
            is_active=bool(r.get("is_active", True)),
            created_at=str(r["created_at"]),
        )
        for r in rows
    ]


# ── POST /rfid/tags — register new tag ────────────────────────────────────────

@router.post(
    "/tags",
    response_model=TagOut,
    status_code=status.HTTP_201_CREATED,
    summary="Register an RFID tag for an asset (admin only)",
)
def register_tag(
    payload: TagRegisterIn,
    sb: Client = Depends(get_admin_client),
    current_user: dict = Depends(_require_admin),
):
    asset = sb.table("assets").select("id, asset_name").eq("id", payload.asset_id).maybe_single().execute()
    if not asset.data:
        raise HTTPException(status_code=404, detail="Asset not found")

    asset_name = payload.asset_name or asset.data.get("asset_name", "")

    # Check uniqueness
    existing = sb.table("rfid_tags").select("id").eq("rfid_tag", payload.rfid_tag).limit(1).execute()
    if existing.data:
        raise HTTPException(status_code=409, detail="RFID tag already registered")

    row = {
        "rfid_tag":      payload.rfid_tag,
        "asset_id":      payload.asset_id,
        "asset_name":    asset_name,
        "registered_by": current_user.get("email", "admin"),
        "is_active":     True,
    }
    result = sb.table("rfid_tags").insert(row).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to register tag")

    rec = result.data[0]
    return TagOut(
        id=str(rec["id"]),
        rfid_tag=str(rec["rfid_tag"]),
        asset_id=rec.get("asset_id"),
        asset_name=str(rec.get("asset_name", "")),
        is_active=True,
        created_at=str(rec["created_at"]),
    )
