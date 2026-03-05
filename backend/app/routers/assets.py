from typing import List, Optional
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from supabase import Client

from app.routers.auth_routes import require_role
from app.db.supabase import get_admin_client

router = APIRouter(prefix="/assets", tags=["Assets"])

_require_admin = require_role("admin")
_require_admin_or_tech = require_role("admin", "lab_technician")

VALID_STATUSES = {"active", "damaged", "under_maintenance"}


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class AssetOut(BaseModel):
    id: str
    asset_name: str
    category: Optional[str] = None
    lab_id: Optional[str] = None
    serial_number: Optional[str] = None
    purchase_date: Optional[str] = None
    warranty_expiry: Optional[str] = None
    status: str
    condition_rating: Optional[int] = None
    qr_code: Optional[str] = None


class AssetCreate(BaseModel):
    asset_name: str
    category: Optional[str] = None
    lab_id: Optional[str] = None
    serial_number: Optional[str] = None
    purchase_date: Optional[str] = None
    warranty_expiry: Optional[str] = None
    status: str = "active"
    condition_rating: Optional[int] = None
    qr_code: Optional[str] = None

    def validate_status(self) -> None:
        if self.status not in VALID_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"status must be one of: {', '.join(sorted(VALID_STATUSES))}",
            )


class AssetUpdate(BaseModel):
    asset_name: Optional[str] = None
    category: Optional[str] = None
    lab_id: Optional[str] = None
    serial_number: Optional[str] = None
    purchase_date: Optional[str] = None
    warranty_expiry: Optional[str] = None
    status: Optional[str] = None
    condition_rating: Optional[int] = None
    qr_code: Optional[str] = None


# ---------------------------------------------------------------------------
# GET /assets
#   admin    -> all assets (filterable by lab, category, status, search)
#   lab_tech -> only assets in their assigned lab
# ---------------------------------------------------------------------------
@router.get("/", response_model=List[AssetOut], summary="List assets")
def list_assets(
    lab_id: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    asset_status: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None, description="Search by asset_name or serial_number"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    sb: Client = Depends(get_admin_client),
    current_user: dict = Depends(_require_admin_or_tech),
):
    if asset_status and asset_status not in VALID_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"status must be one of: {', '.join(sorted(VALID_STATUSES))}",
        )

    q = sb.table("assets").select("*").range(skip, skip + limit - 1).order("asset_name")

    # Lab technicians are scoped to their own lab
    if current_user["role"] == "lab_technician":
        # Fetch the lab this technician belongs to
        lab_result = sb.table("labs").select("id").eq("technician_id", current_user["id"]).maybe_single().execute()
        if not lab_result.data:
            return []
        q = q.eq("lab_id", lab_result.data["id"])
    elif lab_id:
        q = q.eq("lab_id", lab_id)

    if category:
        q = q.eq("category", category)
    if asset_status:
        q = q.eq("status", asset_status)
    if search:
        q = q.or_(f"asset_name.ilike.%{search}%,serial_number.ilike.%{search}%")

    result = q.execute()
    return result.data or []


# ---------------------------------------------------------------------------
# POST /assets  (admin only)
# ---------------------------------------------------------------------------
@router.post("/", response_model=AssetOut, status_code=status.HTTP_201_CREATED, summary="Create an asset (admin only)")
def create_asset(
    payload: AssetCreate,
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_admin),
):
    payload.validate_status()

    if payload.serial_number:
        existing = sb.table("assets").select("id").eq("serial_number", payload.serial_number).maybe_single().execute()
        if existing.data:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Serial number already exists")

    result = sb.table("assets").insert(payload.model_dump(exclude_none=True)).execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create asset")
    return result.data[0]


# ---------------------------------------------------------------------------
# PUT /assets/{asset_id}
#   admin    -> full update
#   lab_tech -> condition_rating and status only
# ---------------------------------------------------------------------------
@router.put("/{asset_id}", response_model=AssetOut, summary="Update an asset")
def update_asset(
    asset_id: str,
    payload: AssetUpdate,
    sb: Client = Depends(get_admin_client),
    current_user: dict = Depends(_require_admin_or_tech),
):
    existing = sb.table("assets").select("*").eq("id", asset_id).maybe_single().execute()
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

    update_data = payload.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    if payload.status and payload.status not in VALID_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"status must be one of: {', '.join(sorted(VALID_STATUSES))}",
        )

    # Lab technicians may only update condition_rating and status
    if current_user["role"] == "lab_technician":
        allowed = {"condition_rating", "status"}
        forbidden = set(update_data.keys()) - allowed
        if forbidden:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Lab technicians can only update: {', '.join(sorted(allowed))}",
            )

    result = sb.table("assets").update(update_data).eq("id", asset_id).execute()
    return result.data[0]


# ---------------------------------------------------------------------------
# DELETE /assets/{asset_id}  (admin only)
# ---------------------------------------------------------------------------
@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete an asset (admin only)")
def delete_asset(
    asset_id: str,
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_admin),
):
    existing = sb.table("assets").select("id").eq("id", asset_id).maybe_single().execute()
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    sb.table("assets").delete().eq("id", asset_id).execute()
