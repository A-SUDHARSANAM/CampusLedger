"""
app/routers/ocr.py
==================
OCR API endpoint for CampusLedger.

Endpoints
---------
POST /ocr/scan
    Accept an image file upload, run OpenCV + Tesseract, and return the
    extracted text alongside a structured ``detected_fields`` dict.

Access
------
Accessible to:  admin, lab_technician, purchase_dept

Workflow per role
-----------------
Admin
    Upload an asset label → receive asset_name, serial_number, model.
    Confirm and create the asset record.

Lab Technician
    Upload equipment label → receive asset_name, serial_number.
    Use the extracted info to file a maintenance request.

Purchase Department
    Upload an invoice image → receive asset_name / item description,
    serial_number, quantity, price, purchase_department.
    Auto-fills the purchase request form.
"""

from __future__ import annotations

import os
import uuid
import tempfile
import logging
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel

from app.routers.auth_routes import require_role

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ocr", tags=["OCR"])

_require_ocr_roles = require_role("admin", "lab_technician", "purchase_dept")


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class DetectedFields(BaseModel):
    asset_name:    Optional[str]   = None
    serial_number: Optional[str]   = None
    model:         Optional[str]   = None
    quantity:      Optional[int]   = None
    price:         Optional[float] = None
    purchase_department:   Optional[str]   = None
    purchase_date: Optional[str]   = None


class OCRScanResponse(BaseModel):
    text:            str
    detected_fields: DetectedFields
    message:         Optional[str] = None


# ---------------------------------------------------------------------------
# POST /ocr/scan
# ---------------------------------------------------------------------------

@router.post(
    "/scan",
    response_model=OCRScanResponse,
    status_code=status.HTTP_200_OK,
    summary="Extract text and asset fields from an uploaded image",
    description=(
        "Upload a JPEG, PNG, or BMP image of an asset label or invoice. "
        "The image is preprocessed with OpenCV (grayscale + Otsu threshold) "
        "and then passed to Tesseract for text recognition. "
        "Structured fields (asset_name, serial_number, model, quantity, "
        "price, purchase_department, purchase_date) are extracted via regex and "
        "returned alongside the raw recognised text."
    ),
)
async def ocr_scan(
    file: UploadFile = File(..., description="Image file (JPEG / PNG / BMP)"),
    _user: dict = Depends(_require_ocr_roles),
) -> OCRScanResponse:
    # ── Validate content type ─────────────────────────────────────────────
    allowed_types = {"image/jpeg", "image/png", "image/bmp", "image/webp", "image/tiff"}
    ct = (file.content_type or "").lower()
    if ct and ct not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type '{ct}'. Accepted: JPEG, PNG, BMP, WebP, TIFF.",
        )

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    # ── Run OCR ───────────────────────────────────────────────────────────
    try:
        from ml.ocr.ocr_service import extract_from_bytes  # type: ignore
        result = extract_from_bytes(image_bytes)
    except RuntimeError as exc:
        # Library not installed — return clear installation hint
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )
    except Exception as exc:
        logger.exception("OCR scan failed for file '%s': %s", file.filename, exc)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"OCR processing failed: {exc}",
        )

    # ── Handle empty-text case ────────────────────────────────────────────
    raw_text = result.get("text", "").strip()
    if not raw_text:
        return OCRScanResponse(
            text="",
            detected_fields=DetectedFields(),
            message="No readable text detected in image.",
        )

    fields_dict = result.get("detected_fields", {})
    return OCRScanResponse(
        text=raw_text,
        detected_fields=DetectedFields(**{
            k: fields_dict.get(k)
            for k in DetectedFields.model_fields
        }),
    )
