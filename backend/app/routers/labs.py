from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from supabase import Client

from app.routers.auth_routes import get_current_user, require_role
from app.db.supabase import get_admin_client

router = APIRouter(prefix="/labs", tags=["Labs"])

_require_admin = require_role("admin")
_require_admin_or_tech = require_role("admin", "lab_technician")


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class LabOut(BaseModel):
    id: str
    lab_name: str
    department: str
    location: str


class LabCreate(BaseModel):
    lab_name: str
    department: str
    location: str


class LabUpdate(BaseModel):
    lab_name: Optional[str] = None
    department: Optional[str] = None
    location: Optional[str] = None


# ---------------------------------------------------------------------------
# GET /labs
#   admin       -> all labs
#   lab_tech    -> only labs where technician_id matches their user id
# ---------------------------------------------------------------------------
@router.get("/", response_model=List[LabOut], summary="List labs")
def list_labs(
    sb: Client = Depends(get_admin_client),
    current_user: dict = Depends(_require_admin_or_tech),
):
    q = sb.table("labs").select("id, lab_name, department, location")
    if current_user["role"] == "lab_technician":
        q = q.eq("technician_id", current_user["id"])
    result = q.execute()
    return result.data or []


# ---------------------------------------------------------------------------
# POST /labs
# ---------------------------------------------------------------------------
@router.post("/", response_model=LabOut, status_code=status.HTTP_201_CREATED, summary="Create a lab (admin only)")
def create_lab(
    payload: LabCreate,
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_admin),
):
    result = sb.table("labs").insert(payload.model_dump()).execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create lab")
    return result.data[0]


# ---------------------------------------------------------------------------
# PUT /labs/{lab_id}
# ---------------------------------------------------------------------------
@router.put("/{lab_id}", response_model=LabOut, summary="Update a lab (admin only)")
def update_lab(
    lab_id: str,
    payload: LabUpdate,
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_admin),
):
    update_data = payload.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    existing = sb.table("labs").select("id").eq("id", lab_id).maybe_single().execute()
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lab not found")
    result = sb.table("labs").update(update_data).eq("id", lab_id).execute()
    return result.data[0]


# ---------------------------------------------------------------------------
# DELETE /labs/{lab_id}
# ---------------------------------------------------------------------------
@router.delete("/{lab_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a lab (admin only)")
def delete_lab(
    lab_id: str,
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_admin),
):
    existing = sb.table("labs").select("id").eq("id", lab_id).maybe_single().execute()
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lab not found")
    sb.table("labs").delete().eq("id", lab_id).execute()
