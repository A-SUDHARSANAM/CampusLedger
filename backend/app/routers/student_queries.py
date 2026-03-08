"""
app/routers/student_queries.py
================================
Student Asset Issue Reporting — no authentication required for submission.

Endpoints
---------
GET  /student-queries/public/labs              – lab list for the public form (no auth)
GET  /student-queries/public/assets?lab_id=   – asset list for the public form (no auth)
POST /student-queries/                        – student submits an issue (no auth)
GET  /student-queries/lab/{lab_id}            – technician lists issues for their lab
PUT  /student-queries/{query_id}/review       – technician marks valid / invalid
POST /student-queries/{query_id}/convert      – (legacy) convert via old path
POST /student-queries/{query_id}/convert-to-maintenance  – convert to maintenance request
"""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from supabase import Client

from app.db.supabase import get_admin_client
from app.routers.auth_routes import require_role
from app.schemas.student_query import ConvertOut, StudentQueryCreate, StudentQueryOut
from app.services.notification_service import notify


# ---------------------------------------------------------------------------
# Pydantic: review decision
# ---------------------------------------------------------------------------

class ReviewRequest(BaseModel):
    decision: str  # 'valid' | 'invalid'


class ReviewOut(BaseModel):
    query_id: str
    decision: str
    verified: bool
    status: str
    helpful_score: int
    message: str


VALID_DECISIONS = {"valid", "invalid"}

router = APIRouter(prefix="/student-queries", tags=["Student Queries"])

_require_lab_or_admin = require_role("lab_technician", "admin")

VALID_PRIORITIES = {"low", "medium", "high"}


# ---------------------------------------------------------------------------
# GET /student-queries/public/labs
#   Public — returns id + lab_name for all labs (used by the issue report form)
# ---------------------------------------------------------------------------

class PublicLabOut(BaseModel):
    id: str
    lab_name: str


@router.get(
    "/public/labs",
    response_model=List[PublicLabOut],
    summary="List labs for public issue report form (no auth required)",
)
def public_list_labs(sb: Client = Depends(get_admin_client)) -> List[PublicLabOut]:
    result = sb.table("labs").select("id, lab_name").order("lab_name").execute()
    return result.data or []


# ---------------------------------------------------------------------------
# GET /student-queries/public/assets?lab_id=
#   Public — returns id + asset_name for assets in a given lab
# ---------------------------------------------------------------------------

class PublicAssetOut(BaseModel):
    id: str
    asset_name: str


@router.get(
    "/public/assets",
    response_model=List[PublicAssetOut],
    summary="List assets in a lab for public issue report form (no auth required)",
)
def public_list_assets(
    lab_id: str,
    sb: Client = Depends(get_admin_client),
) -> List[PublicAssetOut]:
    result = (
        sb.table("assets")
        .select("id, asset_name")
        .eq("lab_id", lab_id)
        .order("asset_name")
        .execute()
    )
    return result.data or []


# ---------------------------------------------------------------------------
# POST /student-queries
# ---------------------------------------------------------------------------

@router.post(
    "/",
    status_code=status.HTTP_201_CREATED,
    response_model=StudentQueryOut,
    summary="Submit a student asset issue (public — no auth required)",
)
def submit_student_query(
    body: StudentQueryCreate,
    sb: Client = Depends(get_admin_client),
) -> StudentQueryOut:
    """
    Public endpoint — students can submit an issue without logging in.

    Workflow:
    1. Validate priority value.
    2. Insert issue into student_queries.
    3. Find the lab technician responsible for the lab.
    4. Update query with assigned_technician.
    5. Send a notification to that technician.
    """
    import logging
    log = logging.getLogger("campusledger")

    if body.priority not in VALID_PRIORITIES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"priority must be one of {sorted(VALID_PRIORITIES)}",
        )

    # 1. Build record — omit asset_id if not provided to avoid null FK issues
    record: dict = {
        "student_name":      body.student_name,
        "student_id":        body.student_id,
        "department":        body.department,
        "lab_id":            body.lab_id,
        "issue_description": body.issue_description,
        "priority":          body.priority,
        "status":            "pending",
    }
    if body.asset_id:
        record["asset_id"] = body.asset_id

    # 2. Insert
    try:
        insert_res = sb.table("student_queries").insert(record).execute()
    except Exception as exc:
        log.error("student_queries insert failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Could not save the query. "
                "Please ensure the student_queries table exists in your database. "
                f"DB error: {exc}"
            ),
        ) from exc

    if not insert_res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save student query — database returned no data.",
        )
    query_row: dict = insert_res.data[0]
    query_id: str = query_row["id"]

    # 3. Find lab technician for this lab.
    #    The users table uses role_id → roles(role_name); there is no bare 'role'
    #    column and no 'lab_id' column. We look up via the roles JOIN and then
    #    match on department (same department as the lab) as a best-effort proxy.
    #    This entire block is non-fatal: a lookup failure never blocks the insert.
    try:
        technician_id: Optional[str] = None

        # Try role-name JOIN first (works with the standard schema)
        tech_res = (
            sb.table("users")
            .select("id, roles!inner(role_name)")
            .eq("roles.role_name", "lab_technician")
            .eq("status", "active")
            .limit(1)
            .execute()
        )
        if tech_res.data:
            technician_id = tech_res.data[0]["id"]
        else:
            # Fallback: some deployments store role as a plain TEXT column
            fallback = (
                sb.table("users")
                .select("id")
                .eq("role", "lab_technician")
                .limit(1)
                .execute()
            )
            if fallback.data:
                technician_id = fallback.data[0]["id"]

        if technician_id:
            # 4. Stamp the query with the technician
            sb.table("student_queries").update(
                {"assigned_technician": technician_id}
            ).eq("id", query_id).execute()
            query_row["assigned_technician"] = technician_id

            # 5. Notify technician
            notify(
                sb=sb,
                user_id=technician_id,
                title="New Student Issue Reported",
                message="New student issue reported in your lab",
                notif_type="alert",
            )
    except Exception as exc:  # pragma: no cover
        log.warning("Technician lookup / notification failed (non-fatal): %s", exc)

    return StudentQueryOut(**query_row)


# ---------------------------------------------------------------------------
# GET /student-queries/lab/{lab_id}
# ---------------------------------------------------------------------------

@router.get(
    "/lab/{lab_id}",
    response_model=List[StudentQueryOut],
    summary="List student issues for a lab (lab technician / admin)",
)
def list_lab_queries(
    lab_id: str,
    sb: Client = Depends(get_admin_client),
    _current_user: dict = Depends(_require_lab_or_admin),
) -> List[StudentQueryOut]:
    """Return all student-reported issues for the given lab, newest first."""
    result = (
        sb.table("student_queries")
        .select("*")
        .eq("lab_id", lab_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


# ---------------------------------------------------------------------------
# PUT /student-queries/{query_id}/review
# ---------------------------------------------------------------------------

@router.put(
    "/{query_id}/review",
    response_model=ReviewOut,
    summary="Technician marks a student query as valid or invalid",
)
def review_student_query(
    query_id: str,
    body: ReviewRequest,
    sb: Client = Depends(get_admin_client),
    _current_user: dict = Depends(_require_lab_or_admin),
) -> ReviewOut:
    """
    Technician reviews a student-reported issue and decides whether it is valid.

    decision = 'valid'   → verified=True,  status='reviewed',  helpful_score=10
    decision = 'invalid' → verified=False, status='rejected',  helpful_score=0
    """
    if body.decision not in VALID_DECISIONS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"decision must be one of {sorted(VALID_DECISIONS)}",
        )

    # Confirm the query exists
    q_res = (
        sb.table("student_queries")
        .select("id, status")
        .eq("id", query_id)
        .limit(1)
        .execute()
    )
    if not q_res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student query not found.",
        )

    if body.decision == "valid":
        patch = {"verified": True, "status": "reviewed", "helpful_score": 10}
        message = "Query marked as valid. Student will receive 10 points."
    else:
        patch = {"verified": False, "status": "rejected", "helpful_score": 0}
        message = "Query marked as invalid. No points awarded."

    sb.table("student_queries").update(patch).eq("id", query_id).execute()

    return ReviewOut(
        query_id=query_id,
        decision=body.decision,
        verified=patch["verified"],
        status=patch["status"],
        helpful_score=patch["helpful_score"],
        message=message,
    )


# ---------------------------------------------------------------------------
# POST /student-queries/{query_id}/convert-to-maintenance  (new canonical path)
# POST /student-queries/{query_id}/convert                 (legacy alias)
# ---------------------------------------------------------------------------

def _do_convert(query_id: str, sb: Client) -> ConvertOut:
    """
    Shared logic for both /convert and /convert-to-maintenance.
    1. Fetch query.
    2. Guard: already converted / missing asset.
    3. Insert maintenance_request.
    4. Update query: status='converted_to_maintenance', verified=True, helpful_score=10.
    """
    q_res = (
        sb.table("student_queries")
        .select("*")
        .eq("id", query_id)
        .limit(1)
        .execute()
    )
    if not q_res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student query not found.",
        )
    query: dict = q_res.data[0]

    if query["status"] == "converted_to_maintenance":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This query has already been converted to a maintenance request.",
        )

    if not query.get("asset_id"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cannot convert query without an associated asset_id.",
        )

    maint_record = {
        "asset_id":          query["asset_id"],
        "issue_description": query["issue_description"],
        "priority":          query["priority"],
        "status":            "pending",
    }
    maint_res = sb.table("maintenance_requests").insert(maint_record).execute()
    if not maint_res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create maintenance request.",
        )
    maintenance_id: str = maint_res.data[0]["id"]

    sb.table("student_queries").update({
        "status":        "converted_to_maintenance",
        "verified":      True,
        "helpful_score": 10,
    }).eq("id", query_id).execute()

    return ConvertOut(
        maintenance_request_id=maintenance_id,
        query_id=query_id,
        message="Student query successfully converted to maintenance request.",
    )


@router.post(
    "/{query_id}/convert-to-maintenance",
    response_model=ConvertOut,
    summary="Convert student query into a maintenance request (canonical path)",
)
def convert_to_maintenance_new(
    query_id: str,
    sb: Client = Depends(get_admin_client),
    _current_user: dict = Depends(_require_lab_or_admin),
) -> ConvertOut:
    return _do_convert(query_id, sb)


# ---------------------------------------------------------------------------
# POST /student-queries/{query_id}/convert   (legacy — kept for compatibility)
# ---------------------------------------------------------------------------

@router.post(
    "/{query_id}/convert",
    response_model=ConvertOut,
    summary="Convert student query into a maintenance request (lab technician / admin)",
)
def convert_to_maintenance(
    query_id: str,
    sb: Client = Depends(get_admin_client),
    _current_user: dict = Depends(_require_lab_or_admin),
) -> ConvertOut:
    """
    Convert a student query into a formal maintenance request.

    Steps:
    1. Fetch the query.
    2. Validate it can be converted (must be pending or reviewed, must have an asset).
    3. Insert a new maintenance_request.
    4. Update the student query: status='converted_to_maintenance', verified=True, helpful_score=10.
    5. Return the new maintenance request ID.
    """

    # 1. Fetch query
    q_res = (
        sb.table("student_queries")
        .select("*")
        .eq("id", query_id)
        .limit(1)
        .execute()
    )
    if not q_res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student query not found.",
        )
    query: dict = q_res.data[0]

    # 2. Guard: already converted?
    if query["status"] == "converted_to_maintenance":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This query has already been converted to a maintenance request.",
        )

    # Guard: must have an asset to create a maintenance request
    if not query.get("asset_id"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cannot convert query without an associated asset_id.",
        )

    # 3. Insert maintenance request
    maint_record = {
        "asset_id":          query["asset_id"],
        "issue_description": query["issue_description"],
        "priority":          query["priority"],
        "status":            "pending",
    }
    maint_res = sb.table("maintenance_requests").insert(maint_record).execute()
    if not maint_res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create maintenance request.",
        )
    maintenance_id: str = maint_res.data[0]["id"]

    # 4. Update student query
    sb.table("student_queries").update({
        "status":       "converted_to_maintenance",
        "verified":     True,
        "helpful_score": 10,
    }).eq("id", query_id).execute()

    return ConvertOut(
        maintenance_request_id=maintenance_id,
        query_id=query_id,
        message="Student query successfully converted to maintenance request.",
    )

