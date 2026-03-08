"""
Locations router — manages physical locations (academic + non-academic).

GET /locations                      → all locations
GET /locations/{id}/assets          → assets at that location
POST /locations                     → create (admin only)
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from supabase import Client

from app.routers.auth_routes import require_role
from app.db.supabase import get_admin_client

router = APIRouter(prefix="/locations", tags=["Locations"])

_require_admin = require_role("admin")
_require_any   = require_role("admin", "lab_technician", "service_staff", "purchase_dept")


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class LocationOut(BaseModel):
    id: str
    name: str
    type: str           # 'academic' | 'non_academic'
    lab_id: Optional[str] = None
    created_at: Optional[str] = None


class LocationCreate(BaseModel):
    name: str
    type: str = "academic"
    lab_id: Optional[str] = None


class LocationAssetOut(BaseModel):
    id: str
    asset_name: str
    status: str
    serial_number: Optional[str] = None


# ---------------------------------------------------------------------------
# GET /locations
# ---------------------------------------------------------------------------
@router.get("/", response_model=List[LocationOut], summary="List all locations")
def list_locations(
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_any),
):
    result = (
        sb.table("locations")
        .select("*")
        .order("type")
        .order("name")
        .execute()
    )
    return result.data or []


# ---------------------------------------------------------------------------
# GET /locations/{location_id}/assets
#   Returns assets at this location.
#   For academic locations with lab_id: also returns assets linked via lab_id
#   (backward compatibility with pre-migration assets).
# ---------------------------------------------------------------------------
@router.get(
    "/{location_id}/assets",
    response_model=List[LocationAssetOut],
    summary="List assets at a location",
)
def list_location_assets(
    location_id: str,
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_any),
):
    # Resolve the location row
    loc_res = (
        sb.table("locations")
        .select("id, lab_id")
        .eq("id", location_id)
        .maybe_single()
        .execute()
    )
    if not loc_res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")

    linked_lab_id = loc_res.data.get("lab_id")

    if linked_lab_id:
        # Academic location with a lab link — return assets by lab_id OR location_id
        result = (
            sb.table("assets")
            .select("id, asset_name, status, serial_number")
            .or_(f"lab_id.eq.{linked_lab_id},location_id.eq.{location_id}")
            .order("asset_name")
            .execute()
        )
    else:
        # Non-academic or standalone — return by location_id only
        result = (
            sb.table("assets")
            .select("id, asset_name, status, serial_number")
            .eq("location_id", location_id)
            .order("asset_name")
            .execute()
        )

    return result.data or []


# ---------------------------------------------------------------------------
# POST /locations  (admin only)
# ---------------------------------------------------------------------------
@router.post(
    "/",
    response_model=LocationOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a location (admin only)",
)
def create_location(
    payload: LocationCreate,
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_admin),
):
    valid_types = {"academic", "non_academic"}
    if payload.type not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"type must be one of: {', '.join(sorted(valid_types))}",
        )
    insert_data = payload.model_dump(exclude_none=True)
    result = sb.table("locations").insert(insert_data).execute()
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create location",
        )
    return result.data[0]
