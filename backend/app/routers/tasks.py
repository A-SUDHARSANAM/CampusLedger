"""
app/routers/tasks.py
====================
Service Task workflow endpoints for CampusLedger.

Endpoints
---------
POST /tasks/assign              — Admin assigns a maintenance request to service staff
GET  /tasks/my/{staff_id}       — Service staff fetches their own task list
PUT  /tasks/update/{task_id}    — Service staff updates task status

On task completion the handler automatically:
  1. Updates maintenance_requests → status = "completed"
  2. Updates assets               → status = "active"
  3. Records a blockchain audit event  (MAINTENANCE_DONE)
  4. Sends a notification to the original issue reporter
"""
from __future__ import annotations

import logging
from typing import List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from supabase import Client

from app.db.supabase import get_admin_client
from app.routers.auth_routes import require_role
from app.services.blockchain_service import record_event
from app.services.notification_service import notify_staff_assigned, notify_maintenance_completed

_logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tasks", tags=["Service Tasks"])

_require_admin   = require_role("admin")
_require_service = require_role("service_staff")
_require_any     = require_role("admin", "service_staff", "lab_technician")

VALID_STATUSES   = {"pending", "in_progress", "completed"}
VALID_PRIORITIES = {"low", "medium", "high", "critical"}


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class AssignTaskRequest(BaseModel):
    issue_id:    str
    asset_id:    str
    assigned_to: str
    assigned_by: str
    priority:    str = "medium"


class UpdateTaskRequest(BaseModel):
    status: str


class ServiceTaskOut(BaseModel):
    task_id:    int
    issue_id:   str
    asset:      str
    lab:        str
    issue:      str
    priority:   str
    status:     str
    asset_id:   str
    assigned_to: str
    assigned_by: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


# ---------------------------------------------------------------------------
# Helper: enrich a service_tasks row with asset/lab/issue details
# ---------------------------------------------------------------------------

def _enrich_task(sb: Client, task: dict) -> dict:
    """Inject asset_name, lab_name, and issue_description into a task row."""
    task = dict(task)

    # Asset + lab
    asset_id = task.get("asset_id")
    if asset_id:
        try:
            res = sb.table("assets").select("asset_name, lab_id").eq("id", asset_id).maybe_single().execute()
            if res.data:
                task["asset_name"] = res.data.get("asset_name", asset_id)
                lab_id = res.data.get("lab_id")
                if lab_id:
                    lab_res = sb.table("labs").select("lab_name").eq("id", lab_id).maybe_single().execute()
                    task["lab_name"] = lab_res.data.get("lab_name", lab_id) if lab_res.data else lab_id
                else:
                    task["lab_name"] = ""
        except Exception as exc:
            _logger.warning("Failed to enrich task asset info: %s", exc)
            task.setdefault("asset_name", asset_id)
            task.setdefault("lab_name", "")

    # Issue description from maintenance_requests
    issue_id = task.get("issue_id")
    if issue_id:
        try:
            res = sb.table("maintenance_requests").select("issue_description").eq("id", issue_id).maybe_single().execute()
            if res.data:
                task["issue_description"] = res.data.get("issue_description", "")
        except Exception as exc:
            _logger.warning("Failed to enrich task issue description: %s", exc)
            task.setdefault("issue_description", "")

    return task


def _task_to_out(task: dict) -> ServiceTaskOut:
    return ServiceTaskOut(
        task_id     = int(task.get("id", 0)),
        issue_id    = str(task.get("issue_id", "")),
        asset       = str(task.get("asset_name", task.get("asset_id", ""))),
        lab         = str(task.get("lab_name", "")),
        issue       = str(task.get("issue_description", "")),
        priority    = str(task.get("priority", "medium")),
        status      = str(task.get("status", "pending")),
        asset_id    = str(task.get("asset_id", "")),
        assigned_to = str(task.get("assigned_to", "")),
        assigned_by = str(task.get("assigned_by", "")),
        created_at  = str(task.get("created_at", "")) or None,
        updated_at  = str(task.get("updated_at", "")) or None,
    )


# ---------------------------------------------------------------------------
# POST /tasks/assign
# ---------------------------------------------------------------------------

@router.post(
    "/assign",
    response_model=ServiceTaskOut,
    status_code=status.HTTP_201_CREATED,
    summary="Admin assigns a maintenance request to service staff",
)
def assign_task(
    payload: AssignTaskRequest,
    sb: Client = Depends(get_admin_client),
    current_user: dict = Depends(_require_admin),
):
    if payload.priority not in VALID_PRIORITIES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"priority must be one of: {', '.join(sorted(VALID_PRIORITIES))}",
        )

    # 1. Verify the maintenance request exists
    req_res = sb.table("maintenance_requests").select("id, status, asset_id").eq("id", payload.issue_id).maybe_single().execute()
    if not req_res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Maintenance request not found.")

    # 2. Insert into service_tasks
    now = datetime.now(timezone.utc).isoformat()
    task_data = {
        "issue_id":    payload.issue_id,
        "asset_id":    payload.asset_id,
        "assigned_to": payload.assigned_to,
        "assigned_by": payload.assigned_by,
        "priority":    payload.priority,
        "status":      "pending",
        "created_at":  now,
        "updated_at":  now,
    }
    insert_res = sb.table("service_tasks").insert(task_data).execute()
    if not insert_res.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create service task.")

    task = insert_res.data[0]

    # 3. Update maintenance_requests status → "assigned"
    sb.table("maintenance_requests").update({
        "status":        "assigned",
        "assigned_staff": payload.assigned_to,
        "updated_at":    now,
    }).eq("id", payload.issue_id).execute()

    # 4. Notify assigned staff (non-fatal)
    try:
        notify_staff_assigned(sb, payload.issue_id, payload.assigned_to)
    except Exception:
        pass

    # 5. Insert history into maintenance_logs
    sb.table("maintenance_logs").insert({
        "request_id": payload.issue_id,
        "action": "assigned",
        "performed_by": payload.assigned_by,
        "notes": f"Assigned to {payload.assigned_to}",
        "created_at": now
    }).execute()

    task = _enrich_task(sb, task)
    return _task_to_out(task)


# ---------------------------------------------------------------------------
# GET /tasks/my/{staff_id}
# ---------------------------------------------------------------------------

@router.get(
    "/my/{staff_id}",
    response_model=List[ServiceTaskOut],
    summary="Service staff fetches their assigned tasks",
)
def get_my_tasks(
    staff_id: str,
    sb: Client = Depends(get_admin_client),
    current_user: dict = Depends(_require_any),
):
    # Service staff may only view their own tasks; admins may view any
    role = current_user.get("role", "")
    if role == "service_staff" and current_user.get("id") != staff_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot view another staff member's tasks.")

    res = (
        sb.table("service_tasks")
        .select("*")
        .eq("assigned_to", staff_id)
        .order("created_at", desc=True)
        .execute()
    )
    rows = res.data or []
    enriched = [_enrich_task(sb, row) for row in rows]
    return [_task_to_out(t) for t in enriched]


# ---------------------------------------------------------------------------
# PUT /tasks/update/{task_id}
# ---------------------------------------------------------------------------

@router.put(
    "/update/{task_id}",
    response_model=ServiceTaskOut,
    summary="Service staff updates their task status",
)
def update_task(
    task_id: int,
    payload: UpdateTaskRequest,
    sb: Client = Depends(get_admin_client),
    current_user: dict = Depends(_require_service),
):
    if payload.status not in VALID_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"status must be one of: {', '.join(sorted(VALID_STATUSES))}",
        )

    # Fetch the task
    task_res = sb.table("service_tasks").select("*").eq("id", task_id).maybe_single().execute()
    if not task_res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service task not found.")

    task = task_res.data

    # Only the assigned staff member may update
    if current_user.get("id") != task.get("assigned_to"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your task.")

    now = datetime.now(timezone.utc).isoformat()

    # Update service_tasks
    upd_res = sb.table("service_tasks").update({
        "status":     payload.status,
        "updated_at": now,
    }).eq("id", task_id).execute()

    if not upd_res.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update task.")

    updated_task = upd_res.data[0]
    issue_id = task.get("issue_id")

    if issue_id:
        sb.table("maintenance_logs").insert({
            "request_id": issue_id,
            "action": payload.status,
            "performed_by": current_user.get("id"),
            "notes": f"Task status updated to {payload.status}",
            "created_at": now
        }).execute()

    # ── System integration on completion ─────────────────────────────────────
    if payload.status == "completed":
        issue_id = task.get("issue_id")
        asset_id = task.get("asset_id")

        # 1. Update maintenance_requests → completed
        if issue_id:
            sb.table("maintenance_requests").update({
                "status":     "completed",
                "updated_at": now,
            }).eq("id", issue_id).execute()

        # 2. Update asset → active
        if asset_id:
            sb.table("assets").update({
                "status":     "active",
                "updated_at": now,
            }).eq("id", asset_id).execute()

        # 3. Record blockchain event (MAINTENANCE_DONE)
        try:
            asset_name = asset_id  # fallback
            asset_res = sb.table("assets").select("asset_name").eq("id", asset_id).maybe_single().execute()
            if asset_res.data:
                asset_name = asset_res.data.get("asset_name", asset_id)

            record_event(
                sb,
                asset_id   = asset_id or "unknown",
                asset_name = asset_name,
                action     = "MAINTENANCE_DONE",
                performed_by = current_user.get("email", current_user.get("id", "service_staff")),
                extra_data   = {
                    "task_id":  task_id,
                    "issue_id": issue_id,
                    "completed_by": current_user.get("id"),
                },
            )
        except Exception as exc:
            _logger.warning("Blockchain record failed (non-fatal): %s", exc)

        # 4. Notify issue reporter
        try:
            if issue_id:
                notify_maintenance_completed(sb, issue_id, current_user.get("id", ""))
        except Exception:
            pass

    updated_task = _enrich_task(sb, updated_task)
    return _task_to_out(updated_task)
