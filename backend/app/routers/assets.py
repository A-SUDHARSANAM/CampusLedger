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
    lab_name: Optional[str] = None
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
# Helper: resolve category name → category_id (creates if missing)
# ---------------------------------------------------------------------------
def _resolve_category_id(sb: Client, category_name: str) -> Optional[str]:
    """Look up asset_categories by name (case-insensitive). Auto-creates if absent."""
    norm = category_name.strip().lower().replace(" ", "_").replace("-", "_")
    res = sb.table("asset_categories").select("id").ilike("category_name", norm).limit(1).execute()
    if res.data:
        return res.data[0]["id"]
    # Auto-create
    new_cat = sb.table("asset_categories").insert({"category_name": norm}).execute()
    return new_cat.data[0]["id"] if new_cat.data else None


# Helper: build a full AssetOut dict from a raw DB row + lookups
def _enrich_asset(a: dict, lab_map: dict, cat_map: dict) -> dict:
    cat_id = a.get("category_id")
    lab_id = a.get("lab_id")
    return {
        **a,
        "category": cat_map.get(cat_id) if cat_id else None,
        "lab_name": lab_map.get(lab_id) if lab_id else None,
    }


# ---------------------------------------------------------------------------
# GET /assets/categories  (admin + lab_tech)
# ---------------------------------------------------------------------------
@router.get("/categories", summary="List asset categories")
def list_categories(
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_admin_or_tech),
):
    result = sb.table("asset_categories").select("id, category_name").order("category_name").execute()
    return result.data or []


# ---------------------------------------------------------------------------
# GET /assets
#   admin    -> all assets (filterable by lab, category, status, search)
#   lab_tech -> assets filtered by optional lab_id param
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

    if lab_id:
        q = q.eq("lab_id", lab_id)
    if asset_status:
        q = q.eq("status", asset_status)
    if search:
        q = q.or_(f"asset_name.ilike.%{search}%,serial_number.ilike.%{search}%")

    # Filter by category name → look up category_id first
    if category:
        norm = category.strip().lower().replace(" ", "_")
        cat_res = sb.table("asset_categories").select("id").ilike("category_name", norm).limit(1).execute()
        if cat_res.data:
            q = q.eq("category_id", cat_res.data[0]["id"])
        else:
            return []  # unknown category → empty result

    result = q.execute()
    assets_data = result.data or []

    # Batch-resolve lab names
    lab_ids = list({a["lab_id"] for a in assets_data if a.get("lab_id")})
    lab_map: dict = {}
    if lab_ids:
        labs_res = sb.table("labs").select("id, lab_name").in_("id", lab_ids).execute()
        lab_map = {lab["id"]: lab["lab_name"] for lab in (labs_res.data or [])}

    # Batch-resolve category names
    cat_ids = list({a["category_id"] for a in assets_data if a.get("category_id")})
    cat_map: dict = {}
    if cat_ids:
        cats_res = sb.table("asset_categories").select("id, category_name").in_("id", cat_ids).execute()
        cat_map = {c["id"]: c["category_name"] for c in (cats_res.data or [])}

    return [_enrich_asset(a, lab_map, cat_map) for a in assets_data]


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
        existing = sb.table("assets").select("id").eq("serial_number", payload.serial_number).limit(1).execute()
        if existing.data:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Serial number already exists")

    # Build insert dict — exclude the text `category` field; use category_id instead
    insert_data = payload.model_dump(exclude_none=True, exclude={"category"})
    if payload.category:
        cat_id = _resolve_category_id(sb, payload.category)
        if cat_id:
            insert_data["category_id"] = cat_id

    result = sb.table("assets").insert(insert_data).execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create asset")

    asset = result.data[0]
    # Resolve names for response
    lab_map = {}
    if asset.get("lab_id"):
        lr = sb.table("labs").select("id, lab_name").eq("id", asset["lab_id"]).limit(1).execute()
        lab_map = {r["id"]: r["lab_name"] for r in (lr.data or [])}
    cat_map = {}
    if asset.get("category_id"):
        cr = sb.table("asset_categories").select("id, category_name").eq("id", asset["category_id"]).limit(1).execute()
        cat_map = {r["id"]: r["category_name"] for r in (cr.data or [])}
    return _enrich_asset(asset, lab_map, cat_map)


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
    existing = sb.table("assets").select("*").eq("id", asset_id).limit(1).execute()
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

    # Resolve category name → category_id
    if "category" in update_data:
        cat_name = update_data.pop("category")
        if cat_name:
            cat_id = _resolve_category_id(sb, cat_name)
            if cat_id:
                update_data["category_id"] = cat_id

    if not update_data:
        return existing.data[0]

    result = sb.table("assets").update(update_data).eq("id", asset_id).execute()
    asset = result.data[0]
    lab_map = {}
    if asset.get("lab_id"):
        lr = sb.table("labs").select("id, lab_name").eq("id", asset["lab_id"]).limit(1).execute()
        lab_map = {r["id"]: r["lab_name"] for r in (lr.data or [])}
    cat_map = {}
    if asset.get("category_id"):
        cr = sb.table("asset_categories").select("id, category_name").eq("id", asset["category_id"]).limit(1).execute()
        cat_map = {r["id"]: r["category_name"] for r in (cr.data or [])}
    return _enrich_asset(asset, lab_map, cat_map)


# ---------------------------------------------------------------------------
# DELETE /assets/{asset_id}  (admin only)
# ---------------------------------------------------------------------------
@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete an asset (admin only)")
def delete_asset(
    asset_id: str,
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_admin),
):
    existing = sb.table("assets").select("id").eq("id", asset_id).limit(1).execute()
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    sb.table("assets").delete().eq("id", asset_id).execute()
