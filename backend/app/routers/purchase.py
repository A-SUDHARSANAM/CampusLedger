from typing import List, Optional
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from pydantic import BaseModel
from supabase import Client

from app.routers.auth_routes import require_role
from app.db.supabase import get_admin_client
from app.services.storage_service import upload_file, Bucket
from app.services.notification_service import notify_purchase_decision
from app.services.ocr_service import extract_invoice_data
from app.services.blockchain_service import record_event as _bc_record

router = APIRouter(prefix="/purchase", tags=["Purchase"])

_require_admin         = require_role("admin")
_require_lab_tech      = require_role("lab_technician")
_require_purchase_dept = require_role("purchase_dept")
_require_admin_or_pur  = require_role("admin", "purchase_dept")
_require_any           = require_role("admin", "lab_technician", "service_staff", "purchase_dept")

# Actual DB tables used:
#   purchase_requests(id, item_name, quantity, requested_by, admin_approval,
#                     purchase_department_id, payment_status, order_status, delivery_date, created_at)
#   purchase_orders  (id, request_id, purchase_department_id, payment_status, order_status, invoice_url, created_at)
#   purchase_department (id, purchase_department_name, contact_email, phone, rating, created_at)

# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class PurchaseOut(BaseModel):
    id: str
    item_name: str
    quantity: int
    status: str                           # derived unified status string
    purchase_department_name: Optional[str] = None
    delivery_date: Optional[str] = None
    admin_approval: Optional[bool] = None
    order_status: Optional[str] = None
    payment_status: Optional[str] = None
    requested_by: Optional[str] = None
    purchase_department_id: Optional[str] = None
    invoice_url: Optional[str] = None
    created_at: Optional[str] = None
    # Compat aliases kept so adaptProcurement() keeps working
    estimated_cost: Optional[float] = None
    notes: Optional[str] = None
    lab_id: Optional[str] = None
    lab_name: Optional[str] = None


class PurchaseRequestIn(BaseModel):
    item_name: str
    quantity: int = 1
    estimated_cost: Optional[float] = None
    notes: Optional[str] = None
    lab_id: Optional[str] = None


class OrderIn(BaseModel):
    request_id: str
    purchase_department_name: str
    expected_delivery_date: str   # ISO date  YYYY-MM-DD


class AdminApproveIn(BaseModel):
    approved: bool
    notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _derive_status(row: dict) -> str:
    """Map (admin_approval, order_status, payment_status) → unified status string."""
    if row.get("order_status") == "cancelled":
        return "rejected"
    if row.get("order_status") == "delivered":
        return "delivered"
    if row.get("payment_status") in ("paid",):
        return "payment_confirmed"
    if row.get("order_status") == "ordered":
        return "ordered"
    if row.get("admin_approval") is True:
        return "approved"
    return "pending_review"


def _enrich(row: dict, *, purchase_department_name: Optional[str] = None) -> dict:
    """Add derived status + purchase_department_name to a purchase_requests row."""
    row["status"] = _derive_status(row)
    if purchase_department_name is not None:
        row["purchase_department_name"] = purchase_department_name
    elif "purchase_department" in row:
        # Supabase embed: {"purchase_department": {"purchase_department_name": "..."}}
        v = row.pop("purchase_department", None) or {}
        row["purchase_department_name"] = v.get("purchase_department_name")
    return row


def _get_or_create_purchase_department(sb: Client, purchase_department_name: str) -> str:
    """Return purchase_department UUID, creating a new record if needed."""
    res = sb.table("purchase_department").select("id").ilike("purchase_department_name", purchase_department_name).limit(1).execute()
    if res.data:
        return res.data[0]["id"]
    new = sb.table("purchase_department").insert({"purchase_department_name": purchase_department_name}).execute()
    return new.data[0]["id"]


def _check_delay(record: dict) -> dict:
    """Set reorder_suggested=True if delivery is overdue."""
    delivery = record.get("delivery_date")
    rec_status = record.get("status")
    if (
        delivery
        and rec_status in ("ordered", "payment_confirmed")
        and date.fromisoformat(str(delivery)[:10]) < date.today()
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
    data: dict = {
        "item_name":    payload.item_name,
        "quantity":     payload.quantity,
        "requested_by": current_user["id"],
    }
    # Store optional enrichment fields when the migration has been applied
    if payload.estimated_cost is not None:
        data["estimated_cost"] = payload.estimated_cost
    if payload.notes:
        data["notes"] = payload.notes
    # Use lab_id from payload (sent by frontend) or fall back to user's lab_id
    lab_id = payload.lab_id or current_user.get("lab_id")
    if lab_id:
        data["lab_id"] = lab_id
    result = sb.table("purchase_requests").insert(data).execute()
    if not result.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create purchase request")
    return _enrich(result.data[0])


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
    existing = sb.table("purchase_requests").select("id, admin_approval, order_status").eq("id", request_id).maybe_single().execute()
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase request not found")
    cur = existing.data
    # Prevent re-review if already processed
    if cur.get("admin_approval") is True or cur.get("order_status") == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Request has already been reviewed",
        )

    if payload.approved:
        update = {"admin_approval": True}
    else:
        update = {"order_status": "cancelled"}

    result = sb.table("purchase_requests").update(update).eq("id", request_id).execute()
    row = result.data[0]
    try:
        notify_purchase_decision(
            sb,
            order_id        = request_id,
            requested_by_id = cur.get("requested_by"),
            approved        = payload.approved,
            notes           = payload.notes,
        )
    except Exception:
        pass
    return _enrich(row)


# ---------------------------------------------------------------------------
# POST /purchase/order
#   Admin/purchase dept formalises an approved request: assigns purchase_department + marks ordered
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
    current_user: dict = Depends(_require_admin_or_pur),
):
    existing = sb.table("purchase_requests").select("id, admin_approval, order_status").eq("id", payload.request_id).maybe_single().execute()
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase request not found")
    if not existing.data.get("admin_approval"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only admin-approved requests can be converted to an order",
        )

    purchase_department_id = _get_or_create_purchase_department(sb, payload.purchase_department_name)
    update = {
        "purchase_department_id": purchase_department_id,
        "order_status": "ordered",
        "delivery_date": payload.expected_delivery_date,
    }
    result = sb.table("purchase_requests").update(update).eq("id", payload.request_id).execute()
    row = result.data[0]
    # ── blockchain: PROCUREMENT ─────────────────────────────────────────
    _bc_record(
        sb,
        asset_id=str(payload.request_id),
        asset_name=str(row.get("item_name", "Purchase Order")),
        action="PROCUREMENT",
        performed_by=current_user.get("email") or current_user.get("role", "purchase_dept"),
        extra_data={
            "purchase_department": payload.purchase_department_name,
            "expected_delivery":   payload.expected_delivery_date,
            "quantity":            row.get("quantity"),
        },
    )
    return _enrich(row, purchase_department_name=payload.purchase_department_name)


# ---------------------------------------------------------------------------
# POST /purchase/{id}/confirm-payment
#   Purchase dept records payment confirmation
# ---------------------------------------------------------------------------
@router.post(
    "/{order_id}/confirm-payment",
    response_model=PurchaseOut,
    summary="Confirm payment for an order (admin or purchase dept)",
)
def confirm_payment(
    order_id: str,
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_admin_or_pur),
):
    existing = sb.table("purchase_requests").select("id, order_status").eq("id", order_id).maybe_single().execute()
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if existing.data.get("order_status") != "ordered":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Payment can only be confirmed for orders in 'ordered' status",
        )
    result = sb.table("purchase_requests").update({"payment_status": "paid"}).eq("id", order_id).execute()
    return _enrich(result.data[0])


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
    current_user: dict = Depends(_require_admin_or_pur),
):
    existing = sb.table("purchase_requests").select("id, order_status").eq("id", order_id).maybe_single().execute()
    if not existing.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if existing.data.get("order_status") not in ("ordered",):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Invoice can only be uploaded for orders in 'ordered' status",
        )

    public_url = upload_file(sb, Bucket.PURCHASE_INVOICES, order_id, invoice)

    update: dict = {"order_status": "delivered"}
    if actual_delivery_date:
        update["delivery_date"] = actual_delivery_date

    result = sb.table("purchase_requests").update(update).eq("id", order_id).execute()

    # Upsert into purchase_orders for invoice_url storage
    try:
        po_existing = sb.table("purchase_orders").select("id").eq("request_id", order_id).limit(1).execute()
        if po_existing.data:
            sb.table("purchase_orders").update({"invoice_url": public_url, "order_status": "delivered"}).eq("request_id", order_id).execute()
        else:
            sb.table("purchase_orders").insert({"request_id": order_id, "invoice_url": public_url, "order_status": "delivered"}).execute()
    except Exception:
        pass

    # Notify admin
    try:
        role_res = sb.table("roles").select("id").eq("role_name", "admin").limit(1).execute()
        admin_rows = []
        if role_res.data:
            admin_rows = sb.table("users").select("id").eq("role_id", role_res.data[0]["id"]).execute().data or []
        notifications = [
            {"user_id": adm["id"], "title": "Invoice Upload",
             "message": f"Invoice uploaded for order {order_id}. Please review.",
             "type": "invoice", "is_read": False}
            for adm in admin_rows
        ]
        if notifications:
            sb.table("notifications").insert(notifications).execute()
    except Exception:
        pass

    return _enrich(result.data[0])


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
    # Fetch from purchase_requests with purchase_department name via join
    q = sb.table("purchase_requests").select("*, purchase_department(purchase_department_name)").range(skip, skip + limit - 1).order("created_at", desc=True)

    if current_user["role"] not in ("admin", "purchase_dept"):
        q = q.eq("requested_by", current_user["id"])

    rows = q.execute().data or []

    results = []
    for r in rows:
        r = _enrich(r)
        r = _check_delay(r)
        results.append(r)

    # Filter by derived status if requested
    if req_status:
        results = [r for r in results if r.get("status") == req_status]

    if reorder_only:
        results = [r for r in results if r.get("reorder_suggested")]

    return results


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
