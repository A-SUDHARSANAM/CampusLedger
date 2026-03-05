import uuid
from typing import List, Optional
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from pydantic import BaseModel
from supabase import Client

from app.routers.auth_routes import require_role
from app.db.supabase import get_admin_client
from app.services.storage_service import upload_file, Bucket
from app.services.notification_service import notify_purchase_decision
from app.services.ocr_service import extract_invoice_data

router = APIRouter(prefix="/purchase", tags=["Purchase"])

_require_admin         = require_role("admin")
_require_lab_tech      = require_role("lab_technician")
_require_purchase_dept = require_role("purchase_dept")
_require_admin_or_pur  = require_role("admin", "purchase_dept")
_require_any           = require_role("admin", "lab_technician", "service_staff", "purchase_dept")

# Status flow:
# pending_review -> approved / rejected (admin)
#                -> ordered             (purchase_dept, after approval)
#                -> payment_confirmed   (purchase_dept)
#                -> delivered           (purchase_dept)
#                -> delayed             (auto-suggested when past expected_delivery_date)
VALID_STATUSES = {
    "pending_review", "approved", "rejected",
    "ordered", "payment_confirmed", "delivered", "delayed",
}



def _po_number() -> str:
    return f"PO-{uuid.uuid4().hex[:8].upper()}"


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class PurchaseOut(BaseModel):
    id: str
    po_number: Optional[str] = None
    item_name: str
    item_description: Optional[str] = None
    quantity: int
    estimated_cost: Optional[float] = None
    status: str
    priority: Optional[str] = None
    requested_by_id: Optional[str] = None
    approved_by_id: Optional[str] = None
    ordered_by_id: Optional[str] = None
    vendor_name: Optional[str] = None
    expected_delivery_date: Optional[str] = None
    actual_delivery_date: Optional[str] = None
    invoice_url: Optional[str] = None
    notes: Optional[str] = None
    reorder_suggested: Optional[bool] = None
    created_at: Optional[str] = None


class PurchaseRequestIn(BaseModel):
    item_name: str
    item_description: Optional[str] = None
    quantity: int = 1
    estimated_cost: Optional[float] = None
    priority: str = "medium"
    notes: Optional[str] = None


class OrderIn(BaseModel):
    request_id: str          # the approved purchase_request id
    vendor_name: str
    expected_delivery_date: str   # ISO date string  YYYY-MM-DD


class AdminApproveIn(BaseModel):
    approved: bool
    notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Helper: check and flag delayed orders
# ---------------------------------------------------------------------------
def _check_delay(record: dict) -> dict:
    """Set reorder_suggested=True if order is past expected_delivery_date."""
    expected = record.get("expected_delivery_date")
    rec_status = record.get("status")
    if (
        expected
        and rec_status in ("ordered", "payment_confirmed")
        and date.fromisoformat(expected[:10]) < date.today()
    ):
        record["reorder_suggested"] = True
    return record


# ---------------------------------------------------------------------------
# POST /purchase/request
#   Lab technician raises a purchase request
# ---------------------------------------------------------------------------
@router.post(
    "/request",
    response_model=PurchaseOut,
    status_code=status.HTTP_201_CREATED,
    summary="Raise a purchase request (lab technician)",
)
def raise_request(
    payload: PurchaseRequestIn,
    sb: Client = Depends(get_admin_client),
    current_user: dict = Depends(_require_lab_tech),
):
    data = payload.model_dump(exclude_none=True)
    data["requested_by_id"] = current_user["id"]
    data["status"]          = "pending_review"
    data["po_number"]       = _po_number()

    result = sb.table("purchase_orders").insert(data).execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create purchase request")
    return result.data[0]


# ---------------------------------------------------------------------------
# PUT /purchase/{id}/admin-approve
#   Admin approves or rejects a pending purchase request
# ---------------------------------------------------------------------------
@router.put(
    "/{request_id}/admin-approve",
    response_model=PurchaseOut,
    summary="Approve or reject a purchase request (admin only)",
)
def admin_approve(
    request_id: str,
    payload: AdminApproveIn,
    sb: Client = Depends(get_admin_client),
    current_user: dict = Depends(_require_admin),
):
    existing = sb.table("purchase_orders").select("id, status, requested_by_id").eq("id", request_id).maybe_single().execute()
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase request not found")
    if existing.data["status"] != "pending_review":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Request is already '{existing.data['status']}', cannot re-review",
        )

    update = {
        "status":         "approved" if payload.approved else "rejected",
        "approved_by_id": current_user["id"],
    }
    if payload.notes:
        update["notes"] = payload.notes

    result = sb.table("purchase_orders").update(update).eq("id", request_id).execute()
    row = result.data[0]
    try:
        notify_purchase_decision(
            sb,
            order_id         = request_id,
            requested_by_id  = existing.data.get("requested_by_id"),
            approved         = payload.approved,
            notes            = payload.notes,
        )
    except Exception:
        pass
    return row


# ---------------------------------------------------------------------------
# POST /purchase/order
#   Purchase department formalises an approved request into a purchase order
#   and records vendor + expected delivery date.
#   The order is placed only after payment is confirmed via a follow-up action.
# ---------------------------------------------------------------------------
@router.post(
    "/order",
    response_model=PurchaseOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create purchase order from approved request (purchase dept)",
)
def create_order(
    payload: OrderIn,
    sb: Client = Depends(get_admin_client),
    current_user: dict = Depends(_require_purchase_dept),
):
    existing = sb.table("purchase_orders").select("id, status").eq("id", payload.request_id).maybe_single().execute()
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase request not found")
    if existing.data["status"] != "approved":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only admin-approved requests can be converted to an order",
        )

    update = {
        "status":                 "ordered",
        "ordered_by_id":          current_user["id"],
        "vendor_name":            payload.vendor_name,
        "expected_delivery_date": payload.expected_delivery_date,
    }
    result = sb.table("purchase_orders").update(update).eq("id", payload.request_id).execute()
    return result.data[0]


# ---------------------------------------------------------------------------
# POST /purchase/{id}/confirm-payment
#   Purchase dept records payment confirmation; order is now active
# ---------------------------------------------------------------------------
@router.post(
    "/{order_id}/confirm-payment",
    response_model=PurchaseOut,
    summary="Confirm payment for an order (purchase dept)",
)
def confirm_payment(
    order_id: str,
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_purchase_dept),
):
    existing = sb.table("purchase_orders").select("id, status").eq("id", order_id).maybe_single().execute()
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if existing.data["status"] != "ordered":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Payment can only be confirmed for orders in 'ordered' status",
        )
    result = sb.table("purchase_orders").update({"status": "payment_confirmed"}).eq("id", order_id).execute()
    return result.data[0]


# ---------------------------------------------------------------------------
# POST /purchase/upload-invoice
#   Purchase dept uploads invoice file; stored in Supabase Storage.
#   Invoice URL is saved on the order and a notification record is created
#   so admin can review it.
# ---------------------------------------------------------------------------
@router.post(
    "/upload-invoice",
    response_model=PurchaseOut,
    summary="Upload invoice for an order (purchase dept)",
)
def upload_invoice(
    order_id: str = Form(...),
    actual_delivery_date: Optional[str] = Form(None),
    invoice: UploadFile = File(..., description="Invoice PDF or image"),
    sb: Client = Depends(get_admin_client),
    current_user: dict = Depends(_require_purchase_dept),
):
    existing = sb.table("purchase_orders").select("id, status").eq("id", order_id).maybe_single().execute()
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if existing.data["status"] not in ("payment_confirmed", "ordered"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Invoice can only be uploaded for orders that have been ordered or payment confirmed",
        )

    public_url = upload_file(sb, Bucket.PURCHASE_INVOICES, order_id, invoice)

    update: dict = {
        "invoice_url": public_url,
        "status":      "delivered",
    }
    if actual_delivery_date:
        update["actual_delivery_date"] = actual_delivery_date

    result = sb.table("purchase_orders").update(update).eq("id", order_id).execute()

    # Notify admin that invoice is ready for review
    try:
        admin_rows = sb.table("users").select("id").eq("role", "admin").execute().data or []
        notifications = [
            {
                "user_id": adm["id"],
                "title":   "Invoice Upload",
                "message": f"Invoice uploaded for order {order_id}. Please review.",
                "type":    "invoice",
                "is_read": False,
            }
            for adm in admin_rows
        ]
        if notifications:
            sb.table("notifications").insert(notifications).execute()
    except Exception:
        pass  # non-fatal; order update already succeeded

    return result.data[0]


# ---------------------------------------------------------------------------
# GET /purchase/orders
#   admin / purchase_dept -> all orders (filterable)
#   lab_tech              -> only their own requests
# ---------------------------------------------------------------------------
@router.get(
    "/orders",
    response_model=List[PurchaseOut],
    summary="List purchase orders",
)
def list_orders(
    req_status: Optional[str] = Query(None, alias="status"),
    reorder_only: bool = Query(False, description="Show only delayed/reorder-suggested orders"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    sb: Client = Depends(get_admin_client),
    current_user: dict = Depends(_require_any),
):
    if req_status and req_status not in VALID_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"status must be one of: {', '.join(sorted(VALID_STATUSES))}",
        )

    q = sb.table("purchase_orders").select("*").range(skip, skip + limit - 1).order("created_at", desc=True)

    if current_user["role"] not in ("admin", "purchase_dept"):
        q = q.eq("requested_by_id", current_user["id"])
    if req_status:
        q = q.eq("status", req_status)

    rows = q.execute().data or []

    # Annotate + optionally filter for delayed orders
    rows = [_check_delay(r) for r in rows]
    if reorder_only:
        rows = [r for r in rows if r.get("reorder_suggested")]

    return rows


# ---------------------------------------------------------------------------
# POST /purchase/scan-invoice
#   Upload an invoice image; OCR extracts asset fields and returns a
#   pre-filled JSON payload ready for the asset creation form.
# ---------------------------------------------------------------------------
class InvoiceOCROut(BaseModel):
    product_name:    Optional[str]   = None
    serial_number:   Optional[str]   = None
    purchase_date:   Optional[str]   = None
    warranty_period: Optional[str]   = None
    price:           Optional[float] = None
    engine:          Optional[str]   = None
    confidence:      Optional[float] = None


@router.post(
    "/scan-invoice",
    response_model=InvoiceOCROut,
    summary="Scan an invoice image and extract asset information (purchase dept)",
)
def scan_invoice(
    invoice: UploadFile = File(..., description="Invoice image (JPEG / PNG / WebP)"),
    _: dict = Depends(_require_admin_or_pur),
):
    image_bytes = invoice.file.read()
    if not image_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")
    try:
        result = extract_invoice_data(image_bytes)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"OCR failed: {exc}")
    return InvoiceOCROut(**{k: result.get(k) for k in InvoiceOCROut.model_fields})
