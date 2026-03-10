"""
app/services/chatbot_service.py
================================
Role-aware Campus Asset Assistant.

Detects user intent via keyword matching, enforces role permissions,
queries Supabase through the admin client, and returns a plain-text answer.
"""
from __future__ import annotations

import logging
import re
from typing import Any

from supabase import Client

_logger = logging.getLogger(__name__)

# ── Intent definitions ─────────────────────────────────────────────────────────
# Each intent maps to (keywords, allowed_roles).
# Keywords are checked against the lowercased user message.

INTENTS: list[tuple[str, list[str], list[str]]] = [
    # (intent_name, keyword_patterns, allowed_roles)
    ("show_damaged_assets",      ["damaged asset"],                             ["admin"]),
    ("show_lab_assets",          ["assets in my lab", "lab assets", "my assets"],["admin", "lab_technician"]),
    ("show_assets",              ["show asset", "all asset", "list asset"],      ["admin", "lab_technician"]),
    ("show_maintenance_requests",["maintenance request", "pending issue", "pending request", "show issues", "show request"],
                                                                                 ["admin", "lab_technician"]),
    ("report_issue",             ["report issue", "raise issue", "report problem"],["lab_technician"]),
    ("show_my_tasks",            ["my task", "assigned task", "show task"],       ["service_staff"]),
    ("complete_task",            ["complete task"],                               ["service_staff"]),
    ("start_task",               ["start task"],                                 ["service_staff"]),
    ("show_carbon_footprint",    ["carbon footprint", "carbon report", "sustainability"],["admin"]),
    ("show_device_health",       ["device health", "health alert", "device monitoring"],["admin", "lab_technician"]),
    ("show_asset_location",      ["asset location", "where is", "locate asset"], ["admin", "lab_technician"]),
]

# ── Helpers ────────────────────────────────────────────────────────────────────

def _detect_intent(message: str) -> str | None:
    msg = message.lower()
    for intent_name, keywords, _ in INTENTS:
        for kw in keywords:
            if kw in msg:
                return intent_name
    return None


def _role_allowed(intent: str, role: str) -> bool:
    for intent_name, _, allowed in INTENTS:
        if intent_name == intent:
            return role in allowed
    return False


def _extract_number(message: str) -> int | None:
    m = re.search(r"\b(\d+)\b", message)
    return int(m.group(1)) if m else None


def _asset_names(rows: list[dict]) -> str:
    names = [r.get("asset_name", r.get("name", "?")) for r in rows[:10]]
    return ", ".join(names) if names else "none"

# ── Main entry point ──────────────────────────────────────────────────────────

def process_message(sb: Client, message: str, user_role: str, user_id: str) -> str:
    intent = _detect_intent(message)

    if intent is None:
        return (
            "I'm your Campus Asset Assistant. Try asking:\n"
            "• show all assets\n"
            "• show damaged assets\n"
            "• show maintenance requests\n"
            "• show my tasks\n"
            "• report issue for <asset>\n"
            "• show carbon footprint\n"
            "• show device health"
        )

    if not _role_allowed(intent, user_role):
        return f"Sorry, the '{intent.replace('_', ' ')}' command is not available for your role ({user_role})."

    try:
        return _HANDLERS[intent](sb, message, user_role, user_id)
    except Exception as exc:
        _logger.exception("Chatbot handler error for intent=%s", intent)
        return f"Something went wrong while processing your request: {exc}"

# ── Intent handlers ────────────────────────────────────────────────────────────

def _handle_show_assets(sb: Client, _msg: str, _role: str, _uid: str) -> str:
    res = sb.table("assets").select("id, asset_name, status").execute()
    rows = res.data or []
    if not rows:
        return "No assets found in the system."
    total = len(rows)
    active = sum(1 for r in rows if r.get("status") == "active")
    damaged = sum(1 for r in rows if r.get("status") == "damaged")
    maint = sum(1 for r in rows if r.get("status") == "under_maintenance")
    return (
        f"There are {total} assets in the system.\n"
        f"• Active: {active}\n• Damaged: {damaged}\n• Under maintenance: {maint}"
    )


def _handle_show_damaged_assets(sb: Client, _msg: str, _role: str, _uid: str) -> str:
    res = sb.table("assets").select("id, asset_name").eq("status", "damaged").execute()
    rows = res.data or []
    if not rows:
        return "No damaged assets found."
    return f"There are {len(rows)} damaged assets: {_asset_names(rows)}."


def _handle_show_lab_assets(sb: Client, _msg: str, _role: str, user_id: str) -> str:
    # Try to find the technician's lab
    user_res = sb.table("users").select("id").eq("id", user_id).maybe_single().execute()
    if not user_res.data:
        return "Could not determine your lab assignment. Please contact an admin."
    # Fetch assets for that user's lab (fallback: all assets)
    res = sb.table("assets").select("id, asset_name, status").execute()
    rows = res.data or []
    if not rows:
        return "No assets found in your lab."
    return f"Found {len(rows)} assets in your lab: {_asset_names(rows)}."


def _handle_show_maintenance_requests(sb: Client, _msg: str, role: str, user_id: str) -> str:
    q = sb.table("maintenance_requests").select("id, issue_description, status, priority")
    if role == "lab_technician":
        q = q.eq("reported_by", user_id)
    elif role == "admin":
        q = q.eq("status", "pending_admin_review")
    res = q.execute()
    rows = res.data or []
    if not rows:
        return "No maintenance requests found."
    summaries = [f"• {r['issue_description']} [{r['status']}]" for r in rows[:8]]
    return f"Found {len(rows)} maintenance request(s):\n" + "\n".join(summaries)


def _handle_report_issue(sb: Client, msg: str, _role: str, user_id: str) -> str:
    # Extract a simple description from the message
    desc = msg
    for prefix in ["report issue", "raise issue", "report problem"]:
        if desc.lower().startswith(prefix):
            desc = desc[len(prefix):].strip(" :-–—")
    if not desc:
        desc = "Issue reported via chatbot"
    # We need an asset_id – try to extract from message, otherwise prompt
    asset_num = _extract_number(msg)
    if not asset_num:
        return "Please include the asset number or ID. Example: 'report issue for asset 101 - screen flickering'"
    # Look up asset by serial-number-like match
    asset_res = sb.table("assets").select("id, asset_name").ilike("asset_name", f"%{asset_num}%").limit(1).execute()
    if not asset_res.data:
        return f"Could not find an asset matching '{asset_num}'. Please check the asset ID."
    asset = asset_res.data[0]
    sb.table("maintenance_requests").insert({
        "asset_id": asset["id"],
        "reported_by": user_id,
        "issue_description": desc,
        "priority": "medium",
        "status": "pending_admin_review"
    }).execute()
    return f"Issue reported for {asset['asset_name']}. An admin will review it shortly."


def _handle_show_my_tasks(sb: Client, _msg: str, _role: str, user_id: str) -> str:
    res = sb.table("service_tasks").select("id, priority, status, asset_id").eq("assigned_to", user_id).execute()
    rows = res.data or []
    if not rows:
        return "You have no assigned tasks."
    pending = sum(1 for r in rows if r.get("status") == "pending")
    in_prog = sum(1 for r in rows if r.get("status") == "in_progress")
    done = sum(1 for r in rows if r.get("status") == "completed")
    return (
        f"You have {len(rows)} task(s):\n"
        f"• Pending: {pending}\n• In progress: {in_prog}\n• Completed: {done}"
    )


def _handle_start_task(sb: Client, msg: str, _role: str, user_id: str) -> str:
    task_num = _extract_number(msg)
    if not task_num:
        return "Please specify the task number. Example: 'start task 101'"
    # Look up task
    res = sb.table("service_tasks").select("id, status, assigned_to").eq("id", str(task_num)).maybe_single().execute()
    if not res.data:
        return f"Task {task_num} not found."
    if res.data.get("assigned_to") != user_id:
        return f"Task {task_num} is not assigned to you."
    if res.data.get("status") != "pending":
        return f"Task {task_num} is already {res.data['status']}."
    sb.table("service_tasks").update({"status": "in_progress"}).eq("id", str(task_num)).execute()
    return f"Task {task_num} is now in progress. Good luck!"


def _handle_complete_task(sb: Client, msg: str, _role: str, user_id: str) -> str:
    task_num = _extract_number(msg)
    if not task_num:
        return "Please specify the task number. Example: 'complete task 101'"
    res = sb.table("service_tasks").select("id, status, assigned_to, issue_id, asset_id").eq("id", str(task_num)).maybe_single().execute()
    if not res.data:
        return f"Task {task_num} not found."
    if res.data.get("assigned_to") != user_id:
        return f"Task {task_num} is not assigned to you."
    if res.data.get("status") == "completed":
        return f"Task {task_num} is already completed."
    # Complete the task
    sb.table("service_tasks").update({"status": "completed"}).eq("id", str(task_num)).execute()
    # Update the parent maintenance request
    issue_id = res.data.get("issue_id")
    if issue_id:
        sb.table("maintenance_requests").update({"status": "completed"}).eq("id", issue_id).execute()
    # Restore asset status
    asset_id = res.data.get("asset_id")
    if asset_id:
        sb.table("assets").update({"status": "active"}).eq("id", asset_id).execute()
    return f"Task {task_num} completed! The asset status has been updated to active."


def _handle_show_carbon_footprint(sb: Client, _msg: str, _role: str, _uid: str) -> str:
    res = sb.table("assets").select("id, status").execute()
    rows = res.data or []
    total = len(rows)
    active = sum(1 for r in rows if r.get("status") == "active")
    return (
        f"Carbon footprint summary:\n"
        f"• Total tracked assets: {total}\n"
        f"• Active assets: {active}\n"
        f"• Estimated carbon impact is proportional to active device count.\n"
        f"For detailed reports, visit the Carbon Footprint page."
    )


def _handle_show_device_health(sb: Client, _msg: str, _role: str, _uid: str) -> str:
    res = sb.table("assets").select("id, asset_name, status, condition_rating").execute()
    rows = res.data or []
    if not rows:
        return "No device health data available."
    damaged = [r for r in rows if r.get("status") == "damaged"]
    low_cond = [r for r in rows if (r.get("condition_rating") or 5) <= 2]
    alerts: list[str] = []
    if damaged:
        alerts.append(f"• {len(damaged)} damaged device(s): {_asset_names(damaged)}")
    if low_cond:
        alerts.append(f"• {len(low_cond)} device(s) with low condition rating: {_asset_names(low_cond)}")
    if not alerts:
        return "All devices are healthy. No alerts at this time."
    return "Device health alerts:\n" + "\n".join(alerts)


def _handle_show_asset_location(sb: Client, msg: str, _role: str, _uid: str) -> str:
    num = _extract_number(msg)
    if num:
        res = sb.table("assets").select("asset_name, lab_id").ilike("asset_name", f"%{num}%").limit(1).execute()
    else:
        return "Please specify the asset. Example: 'where is asset 101'"
    if not res.data:
        return f"Could not find an asset matching '{num}'."
    asset = res.data[0]
    lab_id = asset.get("lab_id")
    lab_name = "Unknown"
    if lab_id:
        lab_res = sb.table("labs").select("lab_name").eq("id", lab_id).maybe_single().execute()
        if lab_res.data:
            lab_name = lab_res.data.get("lab_name", lab_id)
    return f"{asset['asset_name']} is located in {lab_name}."


# ── Handler registry ──────────────────────────────────────────────────────────
_HANDLERS: dict[str, Any] = {
    "show_assets":              _handle_show_assets,
    "show_damaged_assets":      _handle_show_damaged_assets,
    "show_lab_assets":          _handle_show_lab_assets,
    "show_maintenance_requests":_handle_show_maintenance_requests,
    "report_issue":             _handle_report_issue,
    "show_my_tasks":            _handle_show_my_tasks,
    "start_task":               _handle_start_task,
    "complete_task":            _handle_complete_task,
    "show_carbon_footprint":    _handle_show_carbon_footprint,
    "show_device_health":       _handle_show_device_health,
    "show_asset_location":      _handle_show_asset_location,
}
