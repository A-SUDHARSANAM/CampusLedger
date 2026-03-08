from typing import List, Optional
from datetime import datetime, timezone
import logging

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from pydantic import BaseModel
from supabase import Client

from app.routers.auth_routes import require_role
from app.db.supabase import get_admin_client
from app.services.qr_service import generate_qr_b64, decode_qr_payload, generate_maintenance_qr
from app.services.storage_service import upload_file, Bucket
from app.services.notification_service import (
    notify_issue_raised, notify_staff_assigned, notify_maintenance_completed,
)

_logger = logging.getLogger(__name__)

router = APIRouter(prefix="/maintenance", tags=["Maintenance"])

_require_admin        = require_role("admin")
_require_lab_tech     = require_role("lab_technician")
_require_service      = require_role("service_staff")
_require_admin_or_svc = require_role("admin", "service_staff")
_require_any          = require_role("admin", "lab_technician", "service_staff", "purchase_dept")

VALID_STATUSES   = {"pending", "assigned", "in_progress", "completed"}
VALID_PRIORITIES = {"low", "medium", "high", "critical"}

# ---------------------------------------------------------------------------
# Keyword → specialisation mapping (used by staff recommendation scoring)
# ---------------------------------------------------------------------------
_CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "Networking":     ["network", "switch", "router", "wifi", "ethernet", "cable", "internet", "lan", "port", "modem"],
    "IT / Computers": ["computer", "pc", "laptop", "boot", "cpu", "monitor", "display", "screen", "not booting",
                       "keyboard", "bios", "hard drive", "ram", "memory", "os", "windows", "system"],
    "AV / Projector": ["projector", "bulb", "hdmi", "av", "audio", "video", "sound", "speaker", "flickering",
                       "presentation", "lamp", "lens"],
    "Electrical":     ["electrical", "power", "socket", "wiring", "circuit", "fuse", "voltage",
                       "breaker", "short circuit", "supply", "outlet"],
    "HVAC":           ["ac", "air condition", "hvac", "cooling", "fan", "temperature", "heating", "ventilation"],
    "Lab Equipment":  ["microscope", "centrifuge", "incubator", "spectrometer", "oscilloscope",
                       "multimeter", "equipment", "instrument", "calibration"],
    "Furniture":      ["furniture", "chair", "table", "desk", "shelf", "cabinet", "door", "lock", "window"],
    "Printers":       ["printer", "scanner", "copier", "toner", "paper", "ink", "print", "jam"],
}


def _score_text(text: str) -> dict[str, int]:
    """Return category → keyword-hit-count for the given free text."""
    lower = text.lower()
    return {
        cat: sum(1 for kw in kws if kw in lower)
        for cat, kws in _CATEGORY_KEYWORDS.items()
        if any(kw in lower for kw in kws)
    }


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class MaintenanceOut(BaseModel):
    id: str
    asset_id: Optional[str] = None
    asset_name: Optional[str] = None      # enriched from assets
    lab_id: Optional[str] = None          # enriched from assets
    lab_name: Optional[str] = None        # enriched from labs
    # DB column names
    reported_by: Optional[str] = None
    assigned_staff: Optional[str] = None
    issue_description: Optional[str] = None
    issue_type: Optional[str] = None
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


def _enrich_maintenance_rows(sb: Client, rows: List[dict]) -> List[dict]:
    """Batch-fetch asset_name + lab_name and inject into each row."""
    asset_ids = list({r["asset_id"] for r in rows if r.get("asset_id")})
    if not asset_ids:
        return rows

    assets_res = sb.table("assets").select("id, asset_name, lab_id").in_("id", asset_ids).execute()
    asset_map: dict = {a["id"]: a for a in (assets_res.data or [])}

    lab_ids = list({a.get("lab_id") for a in asset_map.values() if a.get("lab_id")})
    lab_map: dict = {}
    if lab_ids:
        labs_res = sb.table("labs").select("id, lab_name").in_("id", lab_ids).execute()
        lab_map = {l["id"]: l["lab_name"] for l in (labs_res.data or [])}

    for row in rows:
        asset = asset_map.get(row.get("asset_id", ""), {})
        row["asset_name"] = asset.get("asset_name")
        row["lab_id"]     = asset.get("lab_id")
        row["lab_name"]   = lab_map.get(asset.get("lab_id", ""))
    return rows


class ReportRequest(BaseModel):
    asset_id: str
    description: str
    priority: str = "medium"
    issue_type: str = "service_request"  # 'service_request' | 'purchase_request'
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


class StaffRecommendation(BaseModel):
    user_id: str
    name: str
    email: str
    completed_count: int
    active_count: int
    matched_keywords: List[str]
    score: float
    reason: str


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
        "issue_type":        payload.issue_type,
        "priority":          payload.priority,
        "image_url":         payload.image_url,
        "reported_by":       current_user["id"],     # correct DB column
        "status":            "pending",
    }
    row_data = {k: v for k, v in data.items() if v is not None}
    result = sb.table("maintenance_requests").insert(row_data).execute()
    # Graceful fallback: if issue_type column doesn't exist yet, retry without it
    if not result.data and "issue_type" in row_data:
        row_data.pop("issue_type")
        result = sb.table("maintenance_requests").insert(row_data).execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create maintenance request")
    row = _remap(result.data[0])
    _enrich_maintenance_rows(sb, [row])
    try:
        notify_issue_raised(sb, row["id"], payload.priority)
    except Exception:
        pass
    return row


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

    rows = [_remap(r) for r in q.execute().data or []]
    return _enrich_maintenance_rows(sb, rows)


# ---------------------------------------------------------------------------
# GET /maintenance/staff-recommendations
#   Admin gets ranked service-staff suggestions for a maintenance request.
#   Scoring: topic relevance (past history) + completion track record - workload
# ---------------------------------------------------------------------------
@router.get(
    "/staff-recommendations",
    response_model=List[StaffRecommendation],
    summary="Recommend service staff for a maintenance request (admin only)",
)
def staff_recommendations(
    issue: str = Query(..., description="Issue description text"),
    priority: str = Query("medium", description="Request priority"),
    asset_type: Optional[str] = Query(None, description="Asset category / type hint"),
    sb: Client = Depends(get_admin_client),
    _user: dict = Depends(_require_admin),
):
    """
    Scores every active ``service_staff`` user and returns up to 5 ranked
    suggestions.  Ranking factors:

    * **Topic match** — keyword overlap between current issue and each staff
      member's past completed request descriptions.
    * **Experience** — total completed assignments (capped at 20).
    * **Availability** — penalises staff with open tasks.
    * **Priority** — critical/high issues boost top-scoring candidates.
    """
    # ── 1. Resolve service_staff role id ──────────────────────────────────
    try:
        role_res = (
            sb.table("roles")
            .select("id")
            .eq("role_name", "service_staff")
            .maybe_single()
            .execute()
        )
        if not role_res.data:
            return []
        service_role_id = role_res.data["id"]
    except Exception as exc:
        _logger.warning("Could not resolve service_staff role id: %s", exc)
        return []

    # ── 2. Fetch active service_staff users ───────────────────────────────
    try:
        users_res = (
            sb.table("users")
            .select("id, name, email")
            .eq("role_id", service_role_id)
            .eq("status", "active")
            .execute()
        )
        staff_list: list[dict] = users_res.data or []
    except Exception as exc:
        _logger.warning("Could not fetch service_staff users: %s", exc)
        return []

    if not staff_list:
        return []

    # ── 3. Build issue category scores ───────────────────────────────────
    full_issue_text = f"{issue} {asset_type or ''}".strip()
    issue_cats      = _score_text(full_issue_text)

    priority_multiplier = {
        "critical": 1.4, "high": 1.2, "medium": 1.0, "low": 0.85
    }.get(priority.lower(), 1.0)

    # ── 4. Fetch history for all staff in two queries ─────────────────────
    staff_ids = [str(s["id"]) for s in staff_list]

    completed_map: dict[str, int] = {}   # sid → total completed
    past_text_map: dict[str, str] = {}   # sid → concatenated past descriptions
    workload_map:  dict[str, int] = {}   # sid → active assignments

    try:
        done_rows = (
            sb.table("maintenance_requests")
            .select("assigned_staff, issue_description")
            .eq("status", "completed")
            .in_("assigned_staff", staff_ids)
            .execute()
            .data or []
        )
        for row in done_rows:
            sid = str(row.get("assigned_staff", ""))
            if not sid:
                continue
            completed_map[sid] = completed_map.get(sid, 0) + 1
            past_text_map[sid] = (
                past_text_map.get(sid, "") + " " + (row.get("issue_description") or "")
            )
    except Exception as exc:
        _logger.debug("Could not query completed maintenance requests: %s", exc)

    try:
        active_rows = (
            sb.table("maintenance_requests")
            .select("assigned_staff")
            .in_("status", ["assigned", "in_progress"])
            .in_("assigned_staff", staff_ids)
            .execute()
            .data or []
        )
        for row in active_rows:
            sid = str(row.get("assigned_staff", ""))
            if sid:
                workload_map[sid] = workload_map.get(sid, 0) + 1
    except Exception as exc:
        _logger.debug("Could not query active maintenance requests: %s", exc)

    # ── 5. Score each staff member ────────────────────────────────────────
    results: list[StaffRecommendation] = []
    for s in staff_list:
        sid       = str(s["id"])
        completed = completed_map.get(sid, 0)
        active    = workload_map.get(sid, 0)
        past_text = past_text_map.get(sid, "")

        # Topic relevance: keyword categories shared with current issue
        past_cats = _score_text(past_text)
        matching_cats = [cat for cat in issue_cats if past_cats.get(cat, 0) > 0]
        topic_score   = sum(min(past_cats.get(cat, 0), 5) for cat in issue_cats)

        score = (
            topic_score * 4.0
            + min(completed, 20) * 2.0
            - active * 8.0
        ) * priority_multiplier

        # Build human-readable reason
        parts: list[str] = []
        if completed:
            parts.append(f"{completed} past repair{'s' if completed != 1 else ''}")
        if active == 0:
            parts.append("Available now")
        elif active == 1:
            parts.append("1 active task")
        else:
            parts.append(f"{active} active tasks")
        if matching_cats:
            parts.append(f"Experienced: {', '.join(matching_cats)}")

        results.append(StaffRecommendation(
            user_id=sid,
            name=str(s.get("name", "Unknown")),
            email=str(s.get("email", "")),
            completed_count=completed,
            active_count=active,
            matched_keywords=matching_cats,
            score=round(score, 2),
            reason=", ".join(parts) if parts else "Available service staff",
        ))

    results.sort(key=lambda r: r.score, reverse=True)
    return results[:5]


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
    existing = sb.table("maintenance_requests").select("id, status, asset_id").eq("id", request_id).maybe_single().execute()
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

    qr_b64 = generate_maintenance_qr(request_id, existing.data["asset_id"], payload.assigned_to_id)
    result = sb.table("maintenance_requests").update({
        "assigned_staff": payload.assigned_to_id,   # correct DB column
        "status": "assigned",
        "qr_code": qr_b64,
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
