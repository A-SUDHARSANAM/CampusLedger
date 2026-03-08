"""
app/services/notification_service.py
-------------------------------------
Central notification service for CampusLedger.

All public functions are non-fatal: they catch and silently log any
Supabase errors so a notification failure never breaks a main operation.

Triggers
--------
- notify_issue_raised        → maintenance issue created   → notifies all admins
- notify_staff_assigned      → service staff assigned      → notifies assigned staff
- notify_maintenance_completed → repair completed          → notifies issue reporter
- notify_purchase_decision   → request approved/rejected   → notifies requester
- check_delivery_delays      → scheduled check             → notifies purchase dept + admins
- check_warranty_expiry      → scheduled check             → notifies admins
"""

import logging
from datetime import date
from typing import Optional

from supabase import Client

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Low-level primitives
# ---------------------------------------------------------------------------

def _insert(sb: Client, records: list[dict]) -> None:
    """Insert notification records; silently swallows errors."""
    if not records:
        return
    try:
        sb.table("notifications").insert(records).execute()
    except Exception as exc:
        logger.warning("Notification insert failed: %s", exc)


def notify(
    sb: Client,
    user_id: str,
    title: str,
    message: str,
    notif_type: str = "info",
) -> None:
    """Send a single notification to one user."""
    _insert(sb, [{
        "user_id":  user_id,
        "message":  f"{title}: {message}" if title else message,
    }])


def notify_many(
    sb: Client,
    user_ids: list[str],
    title: str,
    message: str,
    notif_type: str = "info",
) -> None:
    """Send the same notification to multiple users."""
    combined = f"{title}: {message}" if title else message
    _insert(sb, [
        {"user_id": uid, "message": combined}
        for uid in user_ids
    ])


def _admin_ids(sb: Client) -> list[str]:
    """Return the IDs of all active admin users."""
    try:
        role_res = sb.table("roles").select("id").eq("role_name", "admin").limit(1).execute()
        if not role_res.data:
            return []
        role_id = role_res.data[0]["id"]
        rows = sb.table("users").select("id").eq("role_id", role_id).eq("status", "active").execute().data or []
        return [r["id"] for r in rows]
    except Exception as exc:
        logger.warning("Failed to fetch admin IDs: %s", exc)
        return []


def notify_admins(
    sb: Client,
    title: str,
    message: str,
    notif_type: str = "info",
) -> None:
    """Broadcast a notification to all active admins."""
    notify_many(sb, _admin_ids(sb), title, message, notif_type)


# ---------------------------------------------------------------------------
# Semantic event helpers
# ---------------------------------------------------------------------------

def notify_issue_raised(
    sb: Client,
    request_id: str,
    priority: str,
) -> None:
    """
    Triggered when a lab technician raises a maintenance issue.
    Notifies all admins so they can review and assign staff.
    """
    notify_admins(
        sb,
        title   = "New Maintenance Issue",
        message = f"A {priority.upper()} priority maintenance request (#{request_id[:8]}) has been raised and awaits assignment.",
        notif_type = "maintenance",
    )


def notify_staff_assigned(
    sb: Client,
    request_id: str,
    assigned_to_id: str,
) -> None:
    """
    Triggered when admin assigns service staff to a maintenance request.
    Notifies the assigned staff member with full task details.
    """
    # Fetch request details to build a rich notification message
    task_detail = ""
    try:
        req = (
            sb.table("maintenance_requests")
            .select("issue_description, priority, assets(asset_name, labs(lab_name))")
            .eq("id", request_id)
            .maybe_single()
            .execute()
        )
        if req.data:
            issue    = req.data.get("issue_description", "N/A")
            priority = (req.data.get("priority") or "medium").upper()
            asset    = (req.data.get("assets") or {}).get("asset_name", "N/A")
            lab      = ((req.data.get("assets") or {}).get("labs") or {}).get("lab_name", "N/A")
            task_detail = (
                f" Asset: {asset} | Lab: {lab} | Priority: {priority} | Issue: {issue}"
            )
    except Exception as exc:
        logger.warning("Could not fetch task details for notification: %s", exc)

    notify(
        sb,
        user_id    = assigned_to_id,
        title      = "New Maintenance Task Assigned",
        message    = (
            f"Admin has assigned you to maintenance request #{request_id[:8]}."
            f"{task_detail} Please review and begin work promptly."
        ),
        notif_type = "maintenance",
    )


def notify_maintenance_completed(
    sb: Client,
    request_id: str,
    reported_by_id: Optional[str],
) -> None:
    """
    Triggered when service staff marks a request as completed.
    Notifies the lab technician who raised the issue + all admins.
    """
    ids = _admin_ids(sb)
    if reported_by_id and reported_by_id not in ids:
        ids.append(reported_by_id)
    notify_many(
        sb,
        user_ids   = ids,
        title      = "Maintenance Completed",
        message    = f"Maintenance request #{request_id[:8]} has been marked as completed.",
        notif_type = "maintenance",
    )


def notify_purchase_decision(
    sb: Client,
    order_id: str,
    requested_by_id: Optional[str],
    approved: bool,
    notes: Optional[str] = None,
) -> None:
    """
    Triggered when an admin approves or rejects a purchase request.
    Notifies the requester.
    """
    if not requested_by_id:
        return
    verb = "approved" if approved else "rejected"
    note_suffix = f" Note: {notes}" if notes else ""
    notify(
        sb,
        user_id    = requested_by_id,
        title      = f"Purchase Request {verb.capitalize()}",
        message    = f"Your purchase request #{order_id[:8]} has been {verb}.{note_suffix}",
        notif_type = "purchase",
    )


# ---------------------------------------------------------------------------
# Scheduled / on-demand checks
# ---------------------------------------------------------------------------

def check_delivery_delays(sb: Client) -> int:
    """
    Find all active orders whose expected_delivery_date has passed.
    Send a notification to all admins + the purchase dept.
    Returns the number of delayed orders found.
    """
    try:
        today = date.today().isoformat()
        rows = (
            sb.table("purchase_orders")
            .select("id, expected_delivery_date, ordered_by_id")
            .in_("status", ["ordered", "payment_confirmed"])
            .lt("expected_delivery_date", today)
            .execute()
            .data or []
        )
    except Exception as exc:
        logger.warning("Delivery delay check failed: %s", exc)
        return 0

    for order in rows:
        oid = order["id"]
        exp = order.get("expected_delivery_date", "unknown")
        title   = "Delivery Delayed"
        message = f"Order #{oid[:8]} expected by {exp} has not been marked as delivered. Consider reordering."

        recipients = set(_admin_ids(sb))
        if order.get("ordered_by_id"):
            recipients.add(order["ordered_by_id"])

        notify_many(sb, list(recipients), title, message, "warning")

    return len(rows)


def check_warranty_expiry(sb: Client, days_ahead: int = 30) -> int:
    """
    Find assets whose warranty_expiry falls within the next *days_ahead* days.
    Notifies all admins.
    Returns the number of assets flagged.
    """
    from datetime import timedelta

    today     = date.today()
    threshold = (today + timedelta(days=days_ahead)).isoformat()
    today_str = today.isoformat()

    try:
        rows = (
            sb.table("assets")
            .select("id, asset_name, warranty_expiry, lab_id")
            .gte("warranty_expiry", today_str)
            .lte("warranty_expiry", threshold)
            .execute()
            .data or []
        )
    except Exception as exc:
        logger.warning("Warranty expiry check failed: %s", exc)
        return 0

    admin_ids = _admin_ids(sb)
    for asset in rows:
        aid  = asset["id"]
        name = asset.get("asset_name", aid[:8])
        exp  = asset.get("warranty_expiry", "unknown")
        notify_many(
            sb,
            user_ids   = admin_ids,
            title      = "Warranty Expiring Soon",
            message    = f"Asset '{name}' (#{aid[:8]}) warranty expires on {exp}.",
            notif_type = "warning",
        )

    return len(rows)
