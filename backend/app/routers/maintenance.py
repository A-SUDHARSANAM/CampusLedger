from typing import List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from pydantic import BaseModel
from supabase import Client

from app.routers.auth_routes import require_role
from app.db.supabase import get_admin_client
from app.services.qr_service import generate_qr_b64, decode_qr_payload
from app.services.storage_service import upload_file, Bucket
from app.services.notification_service import (
    notify_issue_raised, notify_staff_assigned, notify_maintenance_completed,
)

router = APIRouter(prefix="/maintenance", tags=["Maintenance"])

_require_admin        = require_role("admin")
_require_lab_tech     = require_role("lab_technician")
_require_service      = require_role("service_staff")
_require_admin_or_svc = require_role("admin", "service_staff")
_require_any          = require_role("admin", "lab_technician", "service_staff", "purchase_dept")

VALID_STATUSES   = {"pending", "assigned", "in_progress", "completed"}
VALID_PRIORITIES = {"low", "medium", "high", "critical"}


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class MaintenanceOut(BaseModel):
    id: str
    asset_id: Optional[str] = None
    # DB column names
    reported_by: Optional[str] = None
    assigned_staff: Optional[str] = None
    issue_description: Optional[str] = None
    priority: Optional[str] = None
    status: str
    image_url: Optional[str] = None
    qr_code: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    # Aliased fields kept for frontend compatibility
    reported_by_id: Optional[str] = None
    assigned_to_id: Optional[str] = None
    description: Optional[str] = None


def _remap(row: dict) -> dict:
    """Enrich a DB row with alias fields the frontend expects."""
    row = dict(row)
    row["reported_by_id"] = row.get("reported_by")
    row["assigned_to_id"] = row.get("assigned_staff")
    row["description"]    = row.get("issue_description", "")
    return row


class ReportRequest(BaseModel):
    asset_id: str
    description: str
    priority: str = "medium"
    image_url: Optional[str] = None


class AssignRequest(BaseModel):
    assigned_to_id: str


class ProgressRequest(BaseModel):
    notes: str


class QRScanRequest(BaseModel):
    qr_data: str  # base64-encoded QR payload from client


class QRCodeOut(BaseModel):
    request_id: str
    qr_base64: str


# ---------------------------------------------------------------------------
# POST /maintenance/report
#   Lab technician raises a maintenance issue
# ---------------------------------------------------------------------------
@router.post(
    "/report",
    response_model=MaintenanceOut,
    status_code=status.HTTP_201_CREATED,
    summary="Report a maintenance issue (lab technician)",
)
def report_issue(
    payload: ReportRequest,
    sb: Client = Depends(get_admin_client),
    current_user: dict = Depends(_require_lab_tech),
):
    if payload.priority not in VALID_PRIORITIES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"priority must be one of: {', '.join(sorted(VALID_PRIORITIES))}",
        )
    data = {
        "asset_id":          payload.asset_id,
        "issue_description": payload.description,   # correct DB column
        "priority":          payload.priority,
        "image_url":         payload.image_url,
        "reported_by":       current_user["id"],     # correct DB column
        "status":            "pending",
    }
    result = sb.table("maintenance_requests").insert({k: v for k, v in data.items() if v is not None}).execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create maintenance request")
    row = result.data[0]
    try:
        notify_issue_raised(sb, row["id"], payload.priority)
    except Exception:
        pass
    return _remap(row)


# ---------------------------------------------------------------------------
# GET /maintenance
#   admin       -> all requests (filterable)
#   service     -> only assigned to them
#   lab_tech    -> only requests they reported
# ---------------------------------------------------------------------------
@router.get("/", response_model=List[MaintenanceOut], summary="List maintenance requests")
def list_maintenance(
    req_status: Optional[str] = Query(None, alias="status"),
    asset_id: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    sb: Client = Depends(get_admin_client),
    current_user: dict = Depends(_require_any),
):
    q = sb.table("maintenance_requests").select("*").range(skip, skip + limit - 1).order("created_at", desc=True)

    role = current_user["role"]
    if role == "service_staff":
        q = q.eq("assigned_staff", current_user["id"])   # correct DB column
    elif role == "lab_technician":
        q = q.eq("reported_by", current_user["id"])       # correct DB column

    if req_status:
        if req_status not in VALID_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"status must be one of: {', '.join(sorted(VALID_STATUSES))}",
            )
        q = q.eq("status", req_status)
    if asset_id:
        q = q.eq("asset_id", asset_id)
    if priority:
        q = q.eq("priority", priority)

    return [_remap(r) for r in q.execute().data or []]


# ---------------------------------------------------------------------------
# PUT /maintenance/{id}/assign
#   Admin assigns a service staff member
# ---------------------------------------------------------------------------
@router.put("/{request_id}/assign", response_model=MaintenanceOut, summary="Assign service staff (admin only)")
def assign_request(
    request_id: str,
    payload: AssignRequest,
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_admin),
):
    existing = sb.table("maintenance_requests").select("id, status").eq("id", request_id).maybe_single().execute()
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Maintenance request not found")
    if existing.data["status"] == "completed":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cannot reassign a completed request")

    # Verify assignee exists and is service_staff
    user_res = (
        sb.table("users")
        .select("id, roles(role_name)")
        .eq("id", payload.assigned_to_id)
        .maybe_single()
        .execute()
    )
    if not user_res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignee not found")
    assignee_role = (user_res.data.get("roles") or {}).get("role_name", "")
    if assignee_role != "service_staff":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assignee must be a service_staff member")

    result = sb.table("maintenance_requests").update({
        "assigned_staff": payload.assigned_to_id,   # correct DB column
        "status": "assigned",
    }).eq("id", request_id).execute()
    row = result.data[0]
    try:
        notify_staff_assigned(sb, request_id, payload.assigned_to_id)
    except Exception:
        pass
    return _remap(row)


# ---------------------------------------------------------------------------
# PUT /maintenance/{id}/progress
#   Service staff marks request as in_progress and adds notes
# ---------------------------------------------------------------------------
@router.put("/{request_id}/progress", response_model=MaintenanceOut, summary="Update progress (service staff)")
def update_progress(
    request_id: str,
    payload: ProgressRequest,
    sb: Client = Depends(get_admin_client),
    current_user: dict = Depends(_require_service),
):
    existing = sb.table("maintenance_requests").select("id, status, assigned_staff").eq("id", request_id).maybe_single().execute()
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Maintenance request not found")
    if existing.data.get("assigned_staff") != current_user["id"]:      # correct DB column
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not assigned to this request")
    if existing.data["status"] == "completed":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Request is already completed")

    result = sb.table("maintenance_requests").update({
        "status": "in_progress",
        # notes column does not exist in schema; log is handled via maintenance_logs
    }).eq("id", request_id).execute()
    return _remap(result.data[0])


# ---------------------------------------------------------------------------
# PUT /maintenance/{id}/complete
#   Service staff marks request as completed
# ---------------------------------------------------------------------------
@router.put("/{request_id}/complete", response_model=MaintenanceOut, summary="Complete a maintenance request (service staff)")
def complete_request(
    request_id: str,
    sb: Client = Depends(get_admin_client),
    current_user: dict = Depends(_require_service),
):
    existing = sb.table("maintenance_requests").select("id, status, assigned_staff, reported_by").eq("id", request_id).maybe_single().execute()
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Maintenance request not found")
    if existing.data.get("assigned_staff") != current_user["id"]:   # correct DB column
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not assigned to this request")
    if existing.data["status"] == "completed":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Request is already completed")

    # updated_at is auto-set by DB trigger; no need to set resolved_at
    result = sb.table("maintenance_requests").update({
        "status": "completed",
    }).eq("id", request_id).execute()
    row = result.data[0]
    try:
        notify_maintenance_completed(sb, request_id, existing.data.get("reported_by"))  # correct DB column
    except Exception:
        pass
    return _remap(row)


# ---------------------------------------------------------------------------
# GET /maintenance/{id}/qr
#   Admin generates a QR code after assigning service staff.
#   QR payload: { issue_id, asset_id, assigned_staff_id }
# ---------------------------------------------------------------------------
@router.get("/{request_id}/qr", response_model=QRCodeOut, summary="Generate QR code for a request (admin only)")
def generate_qr(
    request_id: str,
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_admin),
):
    req = sb.table("maintenance_requests").select("id, asset_id, assigned_staff, status").eq("id", request_id).maybe_single().execute()
    if not req.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Maintenance request not found")
    if not req.data.get("assigned_staff"):    # correct DB column
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request has not been assigned yet")

    payload = {
        "issue_id":          req.data["id"],
        "asset_id":          req.data["asset_id"],
        "assigned_staff_id": req.data["assigned_staff"],   # correct DB column
    }
    qr_b64 = generate_qr_b64(payload)
    return {"request_id": request_id, "qr_base64": qr_b64}


# ---------------------------------------------------------------------------
# POST /maintenance/scan
#   Service staff scans QR code after completing repair.
#   Decodes the payload and marks the request as completed.
# ---------------------------------------------------------------------------
@router.post("/scan", response_model=MaintenanceOut, summary="Scan QR code to complete a request (service staff)")
def scan_qr(
    payload: QRScanRequest,
    sb: Client = Depends(get_admin_client),
    current_user: dict = Depends(_require_service),
):
    try:
        data = decode_qr_payload(payload.qr_data)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or unreadable QR code")

    request_id       = data.get("issue_id")
    assigned_staff   = data.get("assigned_staff_id")

    if not request_id or not assigned_staff:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="QR payload is missing required fields")
    if assigned_staff != current_user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This QR code is not assigned to you")

    existing = sb.table("maintenance_requests").select("id, status, reported_by").eq("id", request_id).maybe_single().execute()
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Maintenance request not found")
    if existing.data["status"] == "completed":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Request is already completed")

    result = sb.table("maintenance_requests").update({
        "status": "completed",
    }).eq("id", request_id).execute()
    row = result.data[0]
    try:
        notify_maintenance_completed(sb, request_id, existing.data.get("reported_by"))  # correct DB column
    except Exception:
        pass
    return _remap(row)


# ---------------------------------------------------------------------------
# POST /maintenance/{id}/upload-image
#   Lab technician uploads an image for an existing maintenance request
# ---------------------------------------------------------------------------
@router.post(
    "/{request_id}/upload-image",
    response_model=MaintenanceOut,
    summary="Attach an image to a maintenance request (lab technician)",
)
def upload_image(
    request_id: str,
    image: UploadFile = File(..., description="Issue photo (JPEG / PNG / WebP)"),
    sb: Client = Depends(get_admin_client),
    current_user: dict = Depends(_require_lab_tech),
):
    existing = sb.table("maintenance_requests").select("id, reported_by").eq("id", request_id).maybe_single().execute()
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Maintenance request not found")
    if existing.data.get("reported_by") != current_user["id"]:    # correct DB column
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only attach images to your own requests")

    public_url = upload_file(sb, Bucket.MAINTENANCE_IMAGES, request_id, image)

    result = sb.table("maintenance_requests").update({"image_url": public_url}).eq("id", request_id).execute()
    return _remap(result.data[0])
