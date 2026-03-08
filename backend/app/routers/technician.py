"""
app/routers/technician.py
==========================
Lab technician–specific endpoints.

Endpoints
---------
GET /technician/student-queries/{technician_id}
    Return ALL student queries (newest first) for any authorised lab technician
    or admin.  The assigned_technician column is not used as a filter here
    because submissions leave it NULL when technician resolution fails.
"""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends
from supabase import Client

from app.db.supabase import get_admin_client
from app.routers.auth_routes import require_role
from app.schemas.student_query import StudentQueryOut

router = APIRouter(prefix="/technician", tags=["Technician"])

_require_lab_or_admin = require_role("lab_technician", "admin")


# ---------------------------------------------------------------------------
# GET /technician/student-queries/{technician_id}
# ---------------------------------------------------------------------------

@router.get(
    "/student-queries/{technician_id}",
    response_model=List[StudentQueryOut],
    summary="List all student queries (lab technician / admin view)",
)
def get_technician_queries(
    technician_id: str,  # kept in URL for backwards-compat; not used as a row filter
    sb: Client = Depends(get_admin_client),
    current_user: dict = Depends(_require_lab_or_admin),
) -> List[StudentQueryOut]:
    """
    Returns ALL student_queries rows ordered by created_at DESC.

    The ``assigned_technician`` column is not used as a filter here because
    new submissions may leave it NULL when no specific technician can be
    resolved at submission time.  Every authorised lab_technician or admin
    should be able to see and review all incoming student reports.
    """
    result = (
        sb.table("student_queries")
        .select("*")
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []
