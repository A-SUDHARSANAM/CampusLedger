from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from supabase import Client

from app.routers.auth_routes import require_role
from app.db.supabase import get_admin_client

router = APIRouter(prefix="/notifications", tags=["Notifications"])

_require_any   = require_role("admin", "lab_technician", "service_staff", "purchase_dept")
_require_admin = require_role("admin")


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class NotificationOut(BaseModel):
    id: str
    user_id: str
    message: str
    status: str = "unread"   # 'unread' | 'read'
    created_at: Optional[str] = None


class NotificationCreate(BaseModel):
    user_id: str
    message: str


# ---------------------------------------------------------------------------
# GET /notifications
#   Returns the current user's notifications (newest first)
# ---------------------------------------------------------------------------
@router.get("/", response_model=List[NotificationOut], summary="List my notifications")
def list_notifications(
    unread_only: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    sb: Client = Depends(get_admin_client),
    current_user: dict = Depends(_require_any),
):
    q = (
        sb.table("notifications")
        .select("*")
        .eq("user_id", current_user["id"])
        .range(skip, skip + limit - 1)
        .order("created_at", desc=True)
    )
    if unread_only:
        q = q.eq("status", "unread")
    return q.execute().data or []


# ---------------------------------------------------------------------------
# GET /notifications/unread-count
# ---------------------------------------------------------------------------
@router.get("/unread-count", summary="Get unread notification count")
def unread_count(
    sb: Client = Depends(get_admin_client),
    current_user: dict = Depends(_require_any),
):
    result = (
        sb.table("notifications")
        .select("id", count="exact")
        .eq("user_id", current_user["id"])
        .eq("status", "unread")
        .execute()
    )
    return {"unread_count": result.count or 0}


# ---------------------------------------------------------------------------
# PATCH /notifications/{id}/read
# ---------------------------------------------------------------------------
@router.patch("/{notif_id}/read", response_model=NotificationOut, summary="Mark a notification as read")
def mark_read(
    notif_id: str,
    sb: Client = Depends(get_admin_client),
    current_user: dict = Depends(_require_any),
):
    existing = (
        sb.table("notifications")
        .select("id")
        .eq("id", notif_id)
        .eq("user_id", current_user["id"])
        .maybe_single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    result = sb.table("notifications").update({"status": "read"}).eq("id", notif_id).execute()
    return result.data[0]


# ---------------------------------------------------------------------------
# POST /notifications/mark-all-read
# ---------------------------------------------------------------------------
@router.post("/mark-all-read", summary="Mark all notifications as read")
def mark_all_read(
    sb: Client = Depends(get_admin_client),
    current_user: dict = Depends(_require_any),
):
    sb.table("notifications").update({"status": "read"}).eq("user_id", current_user["id"]).eq("status", "unread").execute()
    return {"message": "All notifications marked as read"}


# ---------------------------------------------------------------------------
# DELETE /notifications/{id}
# ---------------------------------------------------------------------------
@router.delete("/{notif_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a notification")
def delete_notification(
    notif_id: str,
    sb: Client = Depends(get_admin_client),
    current_user: dict = Depends(_require_any),
):
    existing = (
        sb.table("notifications")
        .select("id")
        .eq("id", notif_id)
        .eq("user_id", current_user["id"])
        .maybe_single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    sb.table("notifications").delete().eq("id", notif_id).execute()


# ---------------------------------------------------------------------------
# POST /notifications  (admin only — manual send)
# ---------------------------------------------------------------------------
@router.post(
    "/",
    response_model=NotificationOut,
    status_code=status.HTTP_201_CREATED,
    summary="Send a manual notification (admin only)",
)
def send_notification(
    payload: NotificationCreate,
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_admin),
):
    result = sb.table("notifications").insert(payload.model_dump()).execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to send notification")
    return result.data[0]
