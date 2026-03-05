from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.dependencies import get_db, require_admin, require_any_role
from app.models.asset import Asset, AssetStatus, AssetCategory
from app.models.lab import Lab
from app.models.maintenance import MaintenanceRequest, MaintenanceStatus
from app.models.purchase import PurchaseOrder, PurchaseOrderStatus
from app.models.user import User
from app.schemas.report import (
    ReportResponse, DashboardReport, AssetSummary, MaintenanceSummary,
    PurchaseSummary, AssetsByCategory, AssetsByLab, MaintenanceByStatus,
)

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/dashboard", response_model=ReportResponse, summary="Full dashboard report (admin only)")
def get_dashboard_report(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    # Asset aggregates
    asset_counts = db.query(Asset.status, func.count(Asset.id)).group_by(Asset.status).all()
    asset_map = {s.value: 0 for s in AssetStatus}
    total_assets = 0
    for s, c in asset_counts:
        asset_map[s.value] = c
        total_assets += c

    asset_summary = AssetSummary(
        total=total_assets,
        active=asset_map.get("active", 0),
        under_maintenance=asset_map.get("under_maintenance", 0),
        inactive=asset_map.get("inactive", 0),
        disposed=asset_map.get("disposed", 0),
    )

    # Maintenance aggregates
    maint_counts = db.query(MaintenanceRequest.status, func.count(MaintenanceRequest.id)).group_by(MaintenanceRequest.status).all()
    maint_map = {s.value: 0 for s in MaintenanceStatus}
    total_maint = 0
    for s, c in maint_counts:
        maint_map[s.value] = c
        total_maint += c

    maintenance_summary = MaintenanceSummary(
        total=total_maint,
        pending=maint_map.get("pending", 0),
        in_progress=maint_map.get("in_progress", 0),
        completed=maint_map.get("completed", 0),
        cancelled=maint_map.get("cancelled", 0),
    )

    # Purchase aggregates
    po_counts = db.query(PurchaseOrder.status, func.count(PurchaseOrder.id)).group_by(PurchaseOrder.status).all()
    po_map = {s.value: 0 for s in PurchaseOrderStatus}
    total_po = 0
    for s, c in po_counts:
        po_map[s.value] = c
        total_po += c

    total_spend_result = db.query(func.sum(PurchaseOrder.total_amount)).filter(
        PurchaseOrder.status == PurchaseOrderStatus.received
    ).scalar()

    purchase_summary = PurchaseSummary(
        total=total_po,
        draft=po_map.get("draft", 0),
        pending_approval=po_map.get("pending_approval", 0),
        approved=po_map.get("approved", 0),
        received=po_map.get("received", 0),
        rejected=po_map.get("rejected", 0),
        total_spend=float(total_spend_result or 0),
    )

    labs_count = db.query(func.count(Lab.id)).scalar()
    users_count = db.query(func.count(User.id)).filter(User.is_active).scalar()

    # Assets by category
    by_category = db.query(Asset.category, func.count(Asset.id)).group_by(Asset.category).all()
    assets_by_category = [AssetsByCategory(category=c.value, count=cnt) for c, cnt in by_category]

    # Assets by lab
    by_lab = (
        db.query(Lab.name, Lab.lab_code, func.count(Asset.id))
        .outerjoin(Asset, Asset.lab_id == Lab.id)
        .group_by(Lab.id, Lab.name, Lab.lab_code)
        .all()
    )
    assets_by_lab = [AssetsByLab(lab_name=n, lab_code=lc, count=cnt) for n, lc, cnt in by_lab]

    # Maintenance by status
    maint_by_status = [
        MaintenanceByStatus(status=s.value, count=maint_map.get(s.value, 0))
        for s in MaintenanceStatus
    ]

    return ReportResponse(
        dashboard=DashboardReport(
            assets=asset_summary,
            maintenance=maintenance_summary,
            purchase=purchase_summary,
            labs_count=labs_count or 0,
            users_count=users_count or 0,
        ),
        assets_by_category=assets_by_category,
        assets_by_lab=assets_by_lab,
        maintenance_by_status=maint_by_status,
    )
