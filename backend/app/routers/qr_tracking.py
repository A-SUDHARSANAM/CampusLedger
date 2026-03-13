"""
app/routers/qr_tracking.py
============================
QR-based asset tracking endpoints.

Endpoints
---------
GET  /qr/asset/{asset_id}        — QR Feature 1: Identify asset by scanning QR
POST /qr/verify                  — QR Feature 3: Audit verification scan (logs to asset_verification_logs)
GET  /qr/asset/{asset_id}/code   — Generate/return the QR code PNG (base64) for a given asset
GET  /qr/verifications           — List recent verification logs (admin / lab_tech)
"""
from __future__ import annotations

import json
import logging
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from supabase import Client

from app.db.supabase import get_admin_client
from app.routers.auth_routes import require_role
from app.services.qr_service import generate_qr_b64
from app.services.blockchain_service import record_event as _bc_record
from app.core.config import settings

_logger = logging.getLogger(__name__)

router = APIRouter(prefix="/qr-track", tags=["QR Tracking"])

_require_any   = require_role("admin", "lab_technician", "service_staff", "purchase_dept")
_require_admin = require_role("admin")
_require_admin_or_tech = require_role("admin", "lab_technician")


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class AssetIdentifyOut(BaseModel):
    id: str
    asset_name: str
    status: str
    category: Optional[str] = None
    lab_name: Optional[str] = None
    location_name: Optional[str] = None
    serial_number: Optional[str] = None
    condition_rating: Optional[int] = None
    qr_code_b64: Optional[str] = None          # base64 PNG for displaying the code


class VerifyIn(BaseModel):
    asset_id: str
    verified_by: str                            # user display name / email
    location: str
    notes: Optional[str] = None
    scan_method: str = "qr"


class VerifyOut(BaseModel):
    id: str
    asset_id: str
    asset_name: str
    verified_by: str
    location: str
    scan_method: str
    created_at: str


class VerificationLogOut(BaseModel):
    id: str
    asset_id: str
    asset_name: str
    verified_by: str
    location: str
    scan_method: str
    notes: Optional[str] = None
    created_at: str


# ── GET /qr/asset/{asset_id} — QR Feature 1: Identify ────────────────────────

@router.get(
    "/asset/{asset_id}",
    response_model=AssetIdentifyOut,
    summary="Identify an asset by its QR-encoded asset_id",
)
def identify_asset(
    asset_id: str,
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_any),
):
    """
    Called when a QR code is scanned.  The QR payload contains the asset UUID.
    Returns full asset details so the frontend can open the asset detail view.
    """
    asset_row = (
        sb.table("assets")
        .select("id, asset_name, status, category_id, lab_id, location_id, serial_number, condition_rating, qr_code")
        .eq("id", asset_id)
        .maybe_single()
        .execute()
    )
    if not asset_row.data:
        raise HTTPException(status_code=404, detail="Asset not found")

    a = asset_row.data

    # Enrich category
    cat_name: Optional[str] = None
    if a.get("category_id"):
        cr = sb.table("asset_categories").select("category_name").eq("id", a["category_id"]).maybe_single().execute()
        cat_name = cr.data["category_name"] if cr.data else None

    # Enrich lab
    lab_name: Optional[str] = None
    if a.get("lab_id"):
        lr = sb.table("labs").select("lab_name").eq("id", a["lab_id"]).maybe_single().execute()
        lab_name = lr.data["lab_name"] if lr.data else None

    # Enrich location
    loc_name: Optional[str] = None
    if a.get("location_id"):
        locr = sb.table("locations").select("name").eq("id", a["location_id"]).maybe_single().execute()
        loc_name = locr.data["name"] if locr.data else None

    # Generate QR code that encodes a public URL (scannable by any phone/browser)
    asset_url = f"{settings.FRONTEND_URL}/public/asset/{asset_id}"
    qr_b64 = a.get("qr_code") or generate_qr_b64(asset_url)

    return AssetIdentifyOut(
        id=str(a["id"]),
        asset_name=str(a.get("asset_name", "")),
        status=str(a.get("status", "active")),
        category=cat_name,
        lab_name=lab_name,
        location_name=loc_name,
        serial_number=a.get("serial_number"),
        condition_rating=a.get("condition_rating"),
        qr_code_b64=qr_b64,
    )


# ── GET /qr/asset/{asset_id}/code — Generate QR PNG ──────────────────────────

@router.get(
    "/asset/{asset_id}/code",
    summary="Get the QR code image (base64 PNG) for an asset",
)
def get_asset_qr_code(
    asset_id: str,
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_admin_or_tech),
):
    """Returns a base64 PNG of the QR code that encodes the public asset URL."""
    asset_row = sb.table("assets").select("id, asset_name, qr_code").eq("id", asset_id).maybe_single().execute()
    if not asset_row.data:
        raise HTTPException(status_code=404, detail="Asset not found")

    asset_url = f"{settings.FRONTEND_URL}/public/asset/{asset_id}"
    qr_b64 = generate_qr_b64(asset_url)

    # Persist back to assets.qr_code if column is empty
    if not asset_row.data.get("qr_code"):
        try:
            sb.table("assets").update({"qr_code": qr_b64}).eq("id", asset_id).execute()
        except Exception:
            pass  # column may not exist in older schema

    return {"asset_id": asset_id, "qr_code_b64": qr_b64}


# ── POST /qr/verify — QR Feature 3: Audit Verification ───────────────────────

@router.post(
    "/verify",
    response_model=VerifyOut,
    status_code=status.HTTP_201_CREATED,
    summary="Log a QR-based asset verification (audit scan)",
)
def verify_asset(
    payload: VerifyIn,
    sb: Client = Depends(get_admin_client),
    current_user: dict = Depends(_require_any),
):
    # Confirm asset exists
    asset_row = sb.table("assets").select("id, asset_name").eq("id", payload.asset_id).maybe_single().execute()
    if not asset_row.data:
        raise HTTPException(status_code=404, detail="Asset not found")

    asset_name = asset_row.data.get("asset_name", payload.asset_id)

    row = {
        "asset_id":    payload.asset_id,
        "asset_name":  asset_name,
        "verified_by": payload.verified_by or current_user.get("email", "unknown"),
        "location":    payload.location,
        "scan_method": payload.scan_method,
        "notes":       payload.notes,
    }
    result = sb.table("asset_verification_logs").insert(row).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to log verification")

    # Record on blockchain (non-fatal)
    _bc_record(
        sb,
        asset_id=payload.asset_id,
        asset_name=asset_name,
        action="ASSET_VERIFIED",
        performed_by=payload.verified_by or current_user.get("email", "system"),
        extra_data={"location": payload.location, "method": payload.scan_method},
    )

    rec = result.data[0]
    return VerifyOut(
        id=str(rec["id"]),
        asset_id=str(rec["asset_id"]),
        asset_name=str(rec["asset_name"]),
        verified_by=str(rec["verified_by"]),
        location=str(rec["location"]),
        scan_method=str(rec["scan_method"]),
        created_at=str(rec["created_at"]),
    )


# ── GET /qr-track/public/asset/{asset_id} — Public (no auth) ─────────────────

@router.get(
    "/public/asset/{asset_id}",
    summary="Public asset info (no auth — for QR scanning by phone/browser)",
)
def public_asset_info(
    asset_id: str,
    sb: Client = Depends(get_admin_client),
):
    """
    No authentication required.  Called when a QR code is scanned by any device.
    Returns basic asset info so anyone with a QR scanner can see what the asset is.
    """
    try:
        asset_row = (
            sb.table("assets")
            .select("id, asset_name, status, category_id, lab_id, location_id, serial_number, condition_rating, condition_notes")
            .eq("id", asset_id)
            .maybe_single()
            .execute()
        )
    except Exception:
        # Backward-compat fallback when optional columns (e.g. condition_notes) are absent.
        asset_row = (
            sb.table("assets")
            .select("id, asset_name, status, category_id, lab_id, location_id, serial_number, condition_rating")
            .eq("id", asset_id)
            .maybe_single()
            .execute()
        )
    if not asset_row.data:
        raise HTTPException(status_code=404, detail="Asset not found")

    a = asset_row.data

    cat_name: Optional[str] = None
    if a.get("category_id"):
        try:
            cr = sb.table("asset_categories").select("category_name").eq("id", a["category_id"]).maybe_single().execute()
            cat_name = cr.data["category_name"] if cr.data else None
        except Exception:
            cat_name = None

    lab_name: Optional[str] = None
    if a.get("lab_id"):
        try:
            lr = sb.table("labs").select("lab_name").eq("id", a["lab_id"]).maybe_single().execute()
            lab_name = lr.data["lab_name"] if lr.data else None
        except Exception:
            lab_name = None

    loc_name: Optional[str] = None
    if a.get("location_id"):
        try:
            locr = sb.table("locations").select("name").eq("id", a["location_id"]).maybe_single().execute()
            loc_name = locr.data["name"] if locr.data else None
        except Exception:
            loc_name = None

    # Log the public QR scan (non-fatal if table doesn't exist yet)
    try:
        sb.table("asset_verification_logs").insert({
            "asset_id":    asset_id,
            "asset_name":  a.get("asset_name", ""),
            "verified_by": "public_scan",
            "location":    loc_name or "unknown",
            "scan_method": "qr",
            "notes":       "Public QR scan",
        }).execute()
    except Exception:
        pass

    return {
        "id":              str(a["id"]),
        "asset_name":      a.get("asset_name", ""),
        "status":          a.get("status", "active"),
        "category":        cat_name,
        "lab_name":        lab_name,
        "location_name":   loc_name,
        "serial_number":   a.get("serial_number"),
        "condition_rating":a.get("condition_rating"),
        "condition_notes": a.get("condition_notes"),
    }


# ── GET /qr/verifications — list recent logs ──────────────────────────────────

@router.get(
    "/verifications",
    response_model=List[VerificationLogOut],
    summary="List asset verification audit logs",
)
def list_verifications(
    asset_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_admin_or_tech),
):
    q = (
        sb.table("asset_verification_logs")
        .select("*")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
    )
    if asset_id:
        q = q.eq("asset_id", asset_id)
    rows = q.execute().data or []
    return [
        VerificationLogOut(
            id=str(r["id"]),
            asset_id=str(r["asset_id"]),
            asset_name=str(r.get("asset_name", "")),
            verified_by=str(r.get("verified_by", "")),
            location=str(r.get("location", "")),
            scan_method=str(r.get("scan_method", "qr")),
            notes=r.get("notes"),
            created_at=str(r["created_at"]),
        )
        for r in rows
    ]
