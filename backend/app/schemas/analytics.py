from typing import List
from pydantic import BaseModel


class AssetSummary(BaseModel):
    total: int
    active: int
    under_maintenance: int
    inactive: int
    disposed: int
    lost: int


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


class DashboardSummary(BaseModel):
    assets: AssetSummary
    maintenance: MaintenanceSummary
    purchase: PurchaseSummary
    labs_count: int
    users_count: int


class CategoryCount(BaseModel):
    category: str
    count: int


class LabAssetCount(BaseModel):
    lab_id: str
    lab_name: str
    lab_code: str
    count: int


class StatusCount(BaseModel):
    status: str
    count: int


class MonthlyTrend(BaseModel):
    month: str
    count: int


class AnalyticsReport(BaseModel):
    summary: DashboardSummary
    assets_by_category: List[CategoryCount]
    assets_by_status: List[StatusCount]
    assets_by_lab: List[LabAssetCount]
    maintenance_by_status: List[StatusCount]
    maintenance_by_priority: List[StatusCount]
    purchase_by_status: List[StatusCount]
