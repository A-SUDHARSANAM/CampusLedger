from typing import Any, Dict, List
from pydantic import BaseModel


class AssetSummary(BaseModel):
    total: int
    active: int
    under_maintenance: int
    inactive: int
    disposed: int


class MaintenanceSummary(BaseModel):
    total: int
    pending: int
    in_progress: int
    completed: int
    cancelled: int


class PurchaseSummary(BaseModel):
    total: int
    draft: int
    pending_approval: int
    approved: int
    received: int
    rejected: int
    total_spend: float


class DashboardReport(BaseModel):
    assets: AssetSummary
    maintenance: MaintenanceSummary
    purchase: PurchaseSummary
    labs_count: int
    users_count: int


class AssetsByCategory(BaseModel):
    category: str
    count: int


class AssetsByLab(BaseModel):
    lab_name: str
    lab_code: str
    count: int


class MaintenanceByStatus(BaseModel):
    status: str
    count: int


class ReportResponse(BaseModel):
    dashboard: DashboardReport
    assets_by_category: List[AssetsByCategory]
    assets_by_lab: List[AssetsByLab]
    maintenance_by_status: List[MaintenanceByStatus]
