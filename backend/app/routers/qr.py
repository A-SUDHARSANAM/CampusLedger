"""
app/routers/qr.py
-----------------
QR-based maintenance verification endpoint.

POST /qr/scan
    Service staff scans the QR code after repairing an asset.
    The decoded QR payload (issue_id, asset_id, staff_id) is sent as the
    request body.  The backend verifies the caller's identity, confirms the
    assignment in the database, marks the maintenance request as completed,
    and inserts a record into maintenance_logs.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from supabase import Client

from app.db.supabase import get_admin_client
from app.routers.auth_routes import require_role
from app.services.notification_service import notify_maintenance_completed

router = APIRouter(prefix="/qr", tags=["QR"])

_require_service = require_role("service_staff")


class QRScanBody(BaseModel):
    issue_id: str
    asset_id: str
    staff_id: str


@router.post(
    "/scan",
    status_code=status.HTTP_200_OK,
    summary="Complete a maintenance request via QR scan (service staff only)",
)
def qr_scan(
    payload: QRScanBody,
    sb: Client = Depends(get_admin_client),
    current_user: dict = Depends(_require_service),
):
    """
    Verify a maintenance QR scan and mark the request as completed.

    Security checks
    ---------------
    1. JWT must belong to a ``service_staff`` user.
    2. ``staff_id`` in the request body must match the authenticated user's ``id``
       (prevents one staff member from submitting another's QR scan).
    3. ``assigned_staff`` in the database must match ``staff_id``.
    4. ``asset_id`` must match the asset on the maintenance request.
    """
    # ── 1. Authenticated user must be the staff member named in the payload ──
    if payload.staff_id != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="QR code is not assigned to you",
        )

    # ── 2. Fetch the maintenance request ─────────────────────────────────────
    req = (
        sb.table("maintenance_requests")
        .select("id, status, assigned_staff, asset_id, reported_by")
        .eq("id", payload.issue_id)
        .maybe_single()
        .execute()
    )
    if not req.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Maintenance request not found",
        )

    # ── 3. Verify the DB assignment matches the payload ───────────────────────
    if req.data.get("assigned_staff") != payload.staff_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not the assigned staff for this maintenance request",
        )

    # ── 4. Verify asset ID (prevents QR replay across different requests) ────
    if req.data.get("asset_id") != payload.asset_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Asset ID in QR payload does not match the maintenance request",
        )

    if req.data["status"] == "completed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Maintenance request is already completed",
        )

    # ── 5. Mark as completed (updated_at handled by DB trigger) ──────────────
    sb.table("maintenance_requests").update({
        "status": "completed",
    }).eq("id", payload.issue_id).execute()

    # ── 6. Insert activity record into maintenance_logs ──────────────────────
    sb.table("maintenance_logs").insert({
        "request_id":   payload.issue_id,
        "action":       "Repair Completed",
        "performed_by": payload.staff_id,
        "notes":        "Maintenance completed via QR scan",
    }).execute()

    # ── 7. Notify the reporter ────────────────────────────────────────────────
    try:
        notify_maintenance_completed(sb, payload.issue_id, req.data.get("reported_by"))
    except Exception:
        pass

    return {
        "message":    "Maintenance task completed successfully",
        "request_id": payload.issue_id,
    }
