"""
app/routers/carbon_footprint.py
================================
Carbon Footprint & Energy monitoring API.

Endpoints
---------
GET  /carbon-footprint            — full summary (admin + lab_tech)
GET  /carbon-footprint/by-category — energy breakdown by device category
GET  /carbon-footprint/by-lab      — energy breakdown by lab
"""

from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from supabase import Client

from app.db.supabase import get_admin_client
from app.routers.auth_routes import require_role
from app.services.carbon_service import calculate_carbon_impact

router = APIRouter(prefix="/carbon-footprint", tags=["Carbon Footprint"])

_require_any = require_role("admin", "lab_technician", "service_staff", "purchase_dept")


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class ChartPoint(BaseModel):
    label: str
    value: float


class DeviceEmitter(BaseModel):
    asset_id: str
    asset_name: str
    category: str
    power_watts: int
    energy_kwh: float
    co2_kg: float
    age_years: int
    savings_potential: bool


class CarbonSummary(BaseModel):
    total_devices: int
    total_energy_kwh: float
    carbon_emission_kg: float
    carbon_emission_tons: float
    potential_savings_kwh: float
    potential_co2_reduction: float
    co2_per_kwh_factor: float
    hours_per_day: int
    working_days: int
    by_category_chart: List[ChartPoint]
    by_lab_chart: List[ChartPoint]
    top_emitters: List[DeviceEmitter]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get(
    "",
    response_model=CarbonSummary,
    summary="Get full carbon footprint summary for all tracked devices",
)
def get_carbon_footprint(
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_any),
) -> CarbonSummary:
    data = calculate_carbon_impact(sb)
    return CarbonSummary(**data)


@router.get(
    "/by-category",
    response_model=List[ChartPoint],
    summary="Energy consumption grouped by device category",
)
def get_by_category(
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_any),
) -> List[ChartPoint]:
    data = calculate_carbon_impact(sb)
    return [ChartPoint(**p) for p in data["by_category_chart"]]


@router.get(
    "/by-lab",
    response_model=List[ChartPoint],
    summary="Energy consumption grouped by lab",
)
def get_by_lab(
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_any),
) -> List[ChartPoint]:
    data = calculate_carbon_impact(sb)
    return [ChartPoint(**p) for p in data["by_lab_chart"]]
