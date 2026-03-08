"""
app/routers/borrow.py
=====================
Electronics catalog (stock) and student borrow management.

Endpoints
---------
GET  /borrow/catalog               – list all stock/catalog items (all lab techs & admins)
POST /borrow/catalog               – create a new catalog stock item (admin only)
GET  /borrow/records               – list borrow records (lab_tech → their lab, admin → all)
POST /borrow/records               – create a new borrow record / generate bill
PUT  /borrow/records/{id}/return   – mark a borrow record as returned (or damaged)
"""

from __future__ import annotations

import json
import math
from datetime import date, datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from supabase import Client

from app.routers.auth_routes import require_role
from app.db.supabase import get_admin_client

router = APIRouter(prefix="/borrow", tags=["Borrow"])

_require_admin        = require_role("admin")
_require_lab_or_admin = require_role("lab_technician", "admin")
_require_any          = require_role("admin", "lab_technician", "service_staff", "purchase_dept")


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class CatalogItemOut(BaseModel):
    id: str
    sku: Optional[str] = None
    name: str
    category: Optional[str] = None
    unit_cost: float = 0.0
    warranty_months: int = 12
    in_stock: int = 0
    lab_id: Optional[str] = None


class CatalogItemCreate(BaseModel):
    item_name: str
    sku: Optional[str] = None
    category: Optional[str] = None
    unit_cost: float = 0.0
    warranty_months: int = 12
    quantity: int = 0
    lab_id: Optional[str] = None


class BorrowItemIn(BaseModel):
    stock_id: Optional[str] = None
    sku: str
    product_name: str
    quantity: int
    unit_cost: float
    warranty_months: int = 12


class BorrowRecordCreate(BaseModel):
    lab_id: Optional[str] = None
    student_name: str
    project_name: str
    due_date: str          # ISO date string YYYY-MM-DD
    items: List[BorrowItemIn]


class BorrowReturnPayload(BaseModel):
    damaged: bool = False
    remark: str = ""
    returned_date: Optional[str] = None


class BorrowRecordOut(BaseModel):
    id: str
    borrow_id: str
    bill_no: str
    invoice_no: str
    lab_id: Optional[str] = None
    lab_name: Optional[str] = None
    student_name: str
    project_name: str
    created_date: str
    due_date: str
    returned_date: Optional[str] = None
    status: str
    fine_amount: float
    items: list
    issue_updates: list


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _enrich_catalog(row: dict) -> dict:
    raw_id = str(row.get("id", ""))
    return {
        "id": raw_id,
        # sku column added by migration; fall back to auto-generated prefix
        "sku": row.get("sku") or f"STOCK-{raw_id[:6].upper()}",
        "name": row.get("item_name", ""),
        "category": row.get("category"),
        # unit_cost added by migration; fall back to reorder_level as price proxy
        "unit_cost": float(row.get("unit_cost") or row.get("reorder_level") or 0),
        # warranty_months added by migration; default 12
        "warranty_months": int(row.get("warranty_months") or 12),
        "in_stock": int(row.get("quantity") or 0),
        "lab_id": row.get("lab_id"),
    }


def _enrich_borrow(row: dict) -> dict:
    items = row.get("items") or []
    if isinstance(items, str):
        try:
            items = json.loads(items)
        except Exception:
            items = []

    issue_updates = row.get("issue_updates") or []
    if isinstance(issue_updates, str):
        try:
            issue_updates = json.loads(issue_updates)
        except Exception:
            issue_updates = []

    lab_obj = row.get("labs") or {}
    return {
        "id": str(row.get("id", "")),
        "borrow_id": row.get("bill_no", str(row.get("id", ""))[:8]),
        "bill_no": row.get("bill_no", ""),
        "invoice_no": row.get("invoice_no", ""),
        "lab_id": row.get("lab_id"),
        "lab_name": lab_obj.get("lab_name") if isinstance(lab_obj, dict) else None,
        "student_name": row.get("student_name", ""),
        "project_name": row.get("project_name", ""),
        "created_date": str(row.get("created_at", ""))[:10],
        "due_date": str(row.get("due_date", "")),
        "returned_date": str(row.get("returned_date", ""))[:10] if row.get("returned_date") else None,
        "status": row.get("status", "borrowed"),
        "fine_amount": float(row.get("fine_amount") or 0),
        "items": items,
        "issue_updates": issue_updates,
    }


def _compute_fine(due_date_str: str, returned_date_str: str, damaged: bool) -> float:
    try:
        due = date.fromisoformat(due_date_str)
        returned = date.fromisoformat(returned_date_str)
        late_days = max(0, (returned - due).days)
        return late_days * 75.0 + (500.0 if damaged else 0.0)
    except Exception:
        return 500.0 if damaged else 0.0


def _next_sequence(sb: Client, prefix: str, table: str, col: str) -> str:
    """Derive next sequential number for bill/invoice numbering."""
    try:
        res = sb.table(table).select(col).order("created_at", desc=True).limit(1).execute()
        if res.data:
            last = str(res.data[0].get(col) or "")
            digits = "".join(filter(str.isdigit, last.split("-")[-1]))
            if digits:
                return f"{prefix}{int(digits) + 1:04d}"
    except Exception:
        pass
    return f"{prefix}1001"


# ---------------------------------------------------------------------------
# GET /borrow/catalog
# ---------------------------------------------------------------------------
@router.get("/catalog", response_model=List[CatalogItemOut], summary="List electronics catalog")
def list_catalog(
    lab_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    sb: Client = Depends(get_admin_client),
    current_user: dict = Depends(_require_any),
):
    try:
        q = sb.table("stock").select("*").range(skip, skip + limit - 1).order("item_name")
        if lab_id:
            q = q.eq("lab_id", lab_id)
        result = q.execute()
        return [_enrich_catalog(r) for r in (result.data or [])]
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


# ---------------------------------------------------------------------------
# POST /borrow/catalog
# ---------------------------------------------------------------------------
@router.post(
    "/catalog",
    response_model=CatalogItemOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add a stock/catalog item (admin or lab tech)",
)
def create_catalog_item(
    payload: CatalogItemCreate,
    sb: Client = Depends(get_admin_client),
    _: dict = Depends(_require_lab_or_admin),
):
    # Build row with only base stock columns (reorder_level stores unit price
    # until the migration that adds unit_cost/warranty_months is applied).
    data: dict = {
        "item_name": payload.item_name,
        "category": payload.category,
        "quantity": payload.quantity,
        "reorder_level": int(payload.unit_cost),  # proxy until migration applied
    }
    if payload.lab_id:
        data["lab_id"] = payload.lab_id
    try:
        result = sb.table("stock").insert(data).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create catalog item")
        return _enrich_catalog(result.data[0])
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# GET /borrow/records
# ---------------------------------------------------------------------------
@router.get("/records", response_model=List[BorrowRecordOut], summary="List borrow records")
def list_borrow_records(
    lab_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    sb: Client = Depends(get_admin_client),
    current_user: dict = Depends(_require_any),
):
    try:
        q = (
            sb.table("student_borrows")
            .select("*, labs(lab_name)")
            .range(skip, skip + limit - 1)
            .order("created_at", desc=True)
        )

        role = current_user.get("role", "")
        if role == "lab_technician":
            # Filter to records created by this user
            q = q.eq("created_by", current_user["id"])
        elif lab_id:
            q = q.eq("lab_id", lab_id)

        result = q.execute()
        return [_enrich_borrow(r) for r in (result.data or [])]
    except Exception as exc:
        # If the table doesn't exist yet (DB not migrated), return empty list gracefully
        if "relation" in str(exc).lower() and "student_borrows" in str(exc):
            return []
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------------------
# POST /borrow/records
# ---------------------------------------------------------------------------
@router.post(
    "/records",
    response_model=BorrowRecordOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a borrow record / generate bill",
)
def create_borrow_record(
    payload: BorrowRecordCreate,
    sb: Client = Depends(get_admin_client),
    current_user: dict = Depends(_require_lab_or_admin),
):
    if not payload.items:
        raise HTTPException(status_code=422, detail="At least one item is required.")

    today = date.today().isoformat()
    import uuid as _uuid

    # Generate sequential bill and invoice numbers
    bill_no = _next_sequence(sb, "BILL-", "student_borrows", "bill_no")
    invoice_no = _next_sequence(sb, "INV-", "student_borrows", "invoice_no")

    items_json = [
        {
            "stock_id": item.stock_id,
            "sku": item.sku,
            "product_name": item.product_name,
            "quantity": item.quantity,
            "unit_cost": item.unit_cost,
            "warranty_months": item.warranty_months,
        }
        for item in payload.items
    ]

    row_data: dict = {
        "student_name": payload.student_name,
        "project_name": payload.project_name,
        "due_date": payload.due_date,
        "bill_no": bill_no,
        "invoice_no": invoice_no,
        "status": "borrowed",
        "fine_amount": 0,
        "items": items_json,
        "issue_updates": ["Issued by lab technician"],
        "created_by": current_user["id"],
    }
    if payload.lab_id:
        row_data["lab_id"] = payload.lab_id

    try:
        # Deduct stock quantities
        for item in payload.items:
            if item.stock_id:
                try:
                    stock_res = sb.table("stock").select("quantity").eq("id", item.stock_id).maybe_single().execute()
                    if stock_res.data:
                        new_qty = max(0, int(stock_res.data["quantity"]) - item.quantity)
                        sb.table("stock").update({"quantity": new_qty}).eq("id", item.stock_id).execute()
                        # Record in stock_movements
                        sb.table("stock_movements").insert({
                            "stock_id": item.stock_id,
                            "movement_type": "outflow",
                            "quantity": item.quantity,
                            "performed_by": current_user["id"],
                        }).execute()
                except Exception:
                    pass  # stock deduction failure should not block the borrow record

        result = sb.table("student_borrows").insert(row_data).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create borrow record.")
        return _enrich_borrow(result.data[0])
    except HTTPException:
        raise
    except Exception as exc:
        err = str(exc)
        if "student_borrows" in err and ("does not exist" in err or "relation" in err.lower()):
            raise HTTPException(
                status_code=503,
                detail=(
                    "The student_borrows table has not been created yet. "
                    "Please run the SQL in backend/queries/migrations/002_student_borrows.sql "
                    "via the Supabase Dashboard → SQL Editor."
                ),
            )
        raise HTTPException(status_code=500, detail=err)


# ---------------------------------------------------------------------------
# PUT /borrow/records/{borrow_id}/return
# ---------------------------------------------------------------------------
@router.put(
    "/records/{borrow_id}/return",
    response_model=BorrowRecordOut,
    summary="Mark a borrow record as returned / damaged",
)
def return_borrow_record(
    borrow_id: str,
    payload: BorrowReturnPayload,
    sb: Client = Depends(get_admin_client),
    current_user: dict = Depends(_require_lab_or_admin),
):
    existing = (
        sb.table("student_borrows")
        .select("*")
        .eq("id", borrow_id)
        .maybe_single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Borrow record not found.")
    if existing.data["status"] != "borrowed":
        raise HTTPException(status_code=409, detail="This record has already been returned.")

    returned_date = payload.returned_date or date.today().isoformat()
    due_date = str(existing.data.get("due_date", ""))
    late = returned_date > due_date if due_date else False
    fine = _compute_fine(due_date, returned_date, payload.damaged)

    if payload.damaged:
        new_status = "damaged"
    elif late:
        new_status = "late_return"
    else:
        new_status = "returned"

    issue_updates = existing.data.get("issue_updates") or []
    if isinstance(issue_updates, str):
        try:
            issue_updates = json.loads(issue_updates)
        except Exception:
            issue_updates = []
    issue_updates.append(payload.remark or ("Returned with damage" if payload.damaged else "Returned in good condition"))

    # Restock on clean return
    if not payload.damaged:
        items = existing.data.get("items") or []
        if isinstance(items, str):
            try:
                items = json.loads(items)
            except Exception:
                items = []
        for item in items:
            stock_id = item.get("stock_id")
            qty = int(item.get("quantity", 0))
            if stock_id and qty > 0:
                try:
                    stock_res = sb.table("stock").select("quantity").eq("id", stock_id).maybe_single().execute()
                    if stock_res.data:
                        new_qty = int(stock_res.data["quantity"]) + qty
                        sb.table("stock").update({"quantity": new_qty}).eq("id", stock_id).execute()
                        sb.table("stock_movements").insert({
                            "stock_id": stock_id,
                            "movement_type": "inflow",
                            "quantity": qty,
                            "performed_by": current_user["id"],
                        }).execute()
                except Exception:
                    pass

    update_data = {
        "status": new_status,
        "returned_date": returned_date,
        "fine_amount": fine,
        "issue_updates": issue_updates,
    }
    result = sb.table("student_borrows").update(update_data).eq("id", borrow_id).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update borrow record.")
    return _enrich_borrow(result.data[0])
