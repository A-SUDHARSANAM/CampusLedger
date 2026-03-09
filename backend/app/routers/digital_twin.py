from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from supabase import Client

from app.routers.auth_routes import require_role
from app.db.supabase import get_admin_client

router = APIRouter(prefix="/digital-twin", tags=["Digital Twin"])

_require_admin_or_tech = require_role("admin", "lab_technician")


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class RFIDScanIn(BaseModel):
    tag_id: str


class RFIDScanOut(BaseModel):
    id: str
    name: str
    status: str
    serial_number: Optional[str] = None
    location: Optional[str] = None


# ---------------------------------------------------------------------------
# POST /digital-twin/rfid/scan
#   Looks up an asset by its serial_number or qr_code (used as RFID tag).
#   Returns basic asset details for the digital twin overlay.
# ---------------------------------------------------------------------------
@router.post(
    "/rfid/scan",
    response_model=RFIDScanOut,
    summary="Look up an asset by RFID / barcode tag",
)
def rfid_scan(
    payload: RFIDScanIn,
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_admin_or_tech),
):
    tag = payload.tag_id.strip()
    if not tag:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="tag_id must not be empty.",
        )

    # Try matching serial_number or qr_code against the submitted tag.
    result = (
        sb.table("assets")
        .select("id, asset_name, status, serial_number, location_id, lab_id")
        .or_(f"serial_number.eq.{tag},qr_code.eq.{tag}")
        .limit(1)
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No asset found for RFID tag: {tag}",
        )

    a = result.data[0]

    # Resolve a human-readable location name
    location_name: Optional[str] = None
    if a.get("location_id"):
        loc_res = (
            sb.table("locations")
            .select("name")
            .eq("id", a["location_id"])
            .limit(1)
            .execute()
        )
        if loc_res.data:
            location_name = loc_res.data[0]["name"]
    if not location_name and a.get("lab_id"):
        lab_res = (
            sb.table("labs")
            .select("lab_name")
            .eq("id", a["lab_id"])
            .limit(1)
            .execute()
        )
        if lab_res.data:
            location_name = lab_res.data[0]["lab_name"]

    return RFIDScanOut(
        id=a["id"],
        name=a["asset_name"],
        status=a["status"],
        serial_number=a.get("serial_number"),
        location=location_name,
    )


# ---------------------------------------------------------------------------
# GET /digital-twin/assets
#   Returns all assets enriched with floor-plan layout positions and lab info.
#   Positions are deterministically assigned in a 4-column grid per lab.
#   Optional filters: lab_id, department, asset_type
# ---------------------------------------------------------------------------

_COLS = 4
_COL_GAP = 23.0   # % width stride
_ROW_GAP = 22.0   # % height stride
_START_X = 8.0    # % from left
_START_Y = 16.0   # % from top

_CATEGORY_TYPE: dict = {
    "computer": "computer", "pc": "computer", "desktop": "computer",
    "laptop": "laptop", "notebook": "laptop",
    "printer": "printer",
    "projector": "projector",
    "server": "server",
    "oscilloscope": "oscilloscope", "electronics": "oscilloscope",
    "network": "network", "router": "network", "switch": "network",
    "camera": "camera",
    "tablet": "tablet", "ipad": "tablet",
    "monitor": "monitor", "screen": "monitor", "display": "monitor",
    "scanner": "scanner",
    "phone": "phone", "mobile": "phone",
}


def _asset_type(category: str) -> str:
    cat = (category or "").lower()
    for key, val in _CATEGORY_TYPE.items():
        if key in cat:
            return val
    return "equipment"


class MapAsset(BaseModel):
    id: str
    name: str
    type: str
    status: str
    x: float
    y: float
    lab: str
    lab_id: str
    department: str
    asset_code: str
    category: str


@router.get(
    "/assets",
    response_model=List[MapAsset],
    summary="Get asset layout data for the Digital Twin floor-plan view",
)
def get_map_assets(
    lab_id: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    asset_type: Optional[str] = Query(None),
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_admin_or_tech),
):
    # ── 1. Fetch assets ────────────────────────────────────────────────────
    q = (
        sb.table("assets")
        .select("id, asset_name, status, serial_number, category, lab_id")
        .neq("status", "disposed")
    )
    if lab_id:
        q = q.eq("lab_id", lab_id)

    assets_res = q.execute()
    raw_assets = assets_res.data or []

    # ── 2. Fetch labs (to get lab_name + department) ───────────────────────
    labs_res = sb.table("labs").select("id, lab_name, department").execute()
    labs_map: dict = {str(lab["id"]): lab for lab in (labs_res.data or [])}

    # ── 3. Optional department filter ─────────────────────────────────────
    if department:
        raw_assets = [
            a for a in raw_assets
            if labs_map.get(str(a.get("lab_id") or ""), {}).get("department", "") == department
        ]

    # ── 4. Group by lab, sort within each lab, assign grid positions ───────
    from collections import defaultdict
    lab_groups: dict = defaultdict(list)
    for a in raw_assets:
        lab_groups[str(a.get("lab_id") or "unknown")].append(a)

    result: List[MapAsset] = []
    for lid, group in lab_groups.items():
        # Sort by category then name for stable layout
        group.sort(key=lambda a: (a.get("category") or "", a.get("asset_name") or ""))
        lab_info = labs_map.get(lid, {})
        lab_name = lab_info.get("lab_name", "")
        dept = lab_info.get("department", "")

        for idx, a in enumerate(group):
            atype = _asset_type(a.get("category") or "")
            if asset_type and atype != asset_type:
                continue
            col = idx % _COLS
            row = idx // _COLS
            x = _START_X + col * _COL_GAP
            y = _START_Y + row * _ROW_GAP
            result.append(
                MapAsset(
                    id=str(a["id"]),
                    name=a.get("asset_name") or "",
                    type=atype,
                    status=(a.get("status") or "active").lower(),
                    x=round(x, 1),
                    y=round(y, 1),
                    lab=lab_name,
                    lab_id=lid,
                    department=dept,
                    asset_code=str(a.get("serial_number") or a["id"]),
                    category=a.get("category") or "",
                )
            )

    return result


# ---------------------------------------------------------------------------
# GET /digital-twin/campus
#   Returns the full campus hierarchy:
#     campus → buildings → labs → asset counts + status summary.
#   "Building" is derived from the labs.building column (optional) or
#   falls back to the labs.department value so the feature works even
#   without a dedicated buildings table.
# ---------------------------------------------------------------------------

class LabSummary(BaseModel):
    id: str
    name: str
    building: str
    department: str
    asset_total: int
    active: int
    maintenance: int
    damaged: int


class BuildingSummary(BaseModel):
    name: str
    labs: List[LabSummary]
    asset_total: int


class CampusResponse(BaseModel):
    buildings: List[BuildingSummary]


@router.get(
    "/campus",
    response_model=CampusResponse,
    summary="Get full campus hierarchy for the Smart Campus Map",
)
def get_campus(
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_admin_or_tech),
):
    # ── 1. Fetch all labs ─────────────────────────────────────────────────
    labs_res = sb.table("labs").select("id, lab_name, department, building").execute()
    labs_raw = labs_res.data or []

    # ── 2. Fetch asset status counts per lab ──────────────────────────────
    assets_res = (
        sb.table("assets")
        .select("id, lab_id, status")
        .neq("status", "disposed")
        .execute()
    )
    assets_raw = assets_res.data or []

    # Build per-lab status counts
    from collections import defaultdict
    lab_counts: dict = defaultdict(lambda: {"total": 0, "active": 0, "maintenance": 0, "damaged": 0})
    for a in assets_raw:
        lid = str(a.get("lab_id") or "unknown")
        s = (a.get("status") or "").lower().replace(" ", "_")
        lab_counts[lid]["total"] += 1
        if s == "active":
            lab_counts[lid]["active"] += 1
        elif s == "under_maintenance":
            lab_counts[lid]["maintenance"] += 1
        elif s == "damaged":
            lab_counts[lid]["damaged"] += 1

    # ── 3. Build building → labs grouping ────────────────────────────────
    building_map: dict = defaultdict(list)
    for lab in labs_raw:
        # Use "building" column if present, else fall back to department
        b = (lab.get("building") or lab.get("department") or "General").strip()
        lid = str(lab["id"])
        cnt = lab_counts[lid]
        building_map[b].append(
            LabSummary(
                id=lid,
                name=lab.get("lab_name") or lab.get("name") or "Lab",
                building=b,
                department=lab.get("department") or "",
                asset_total=cnt["total"],
                active=cnt["active"],
                maintenance=cnt["maintenance"],
                damaged=cnt["damaged"],
            )
        )

    # ── 4. Assemble buildings sorted by name ──────────────────────────────
    buildings: List[BuildingSummary] = []
    for bname in sorted(building_map.keys()):
        labs_in_b = sorted(building_map[bname], key=lambda l: l.name)
        buildings.append(
            BuildingSummary(
                name=bname,
                labs=labs_in_b,
                asset_total=sum(l.asset_total for l in labs_in_b),
            )
        )

    return CampusResponse(buildings=buildings)
