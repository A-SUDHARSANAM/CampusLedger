"""
ml/ocr/ocr_service.py
======================
OCR service for CampusLedger.  Two engines are supported:

1. **OpenAI GPT-4 Vision** (preferred, high accuracy)
   Activated automatically when ``OPENAI_API_KEY`` is set in the environment.
   Sends the image to ``gpt-4o`` with a structured extraction prompt.

2. **OpenCV + Tesseract** (local fallback, free)
   Used when no OpenAI key is present.
   Requires:  pip install opencv-python pytesseract
   And the Tesseract binary:  https://github.com/UB-Mannheim/tesseract/wiki
   Set ``TESSERACT_CMD`` env var if Tesseract is not on PATH.

Extracted fields (both engines)
--------------------------------
  asset_name          – product / item description
  serial_number       – SN / serial number
  model               – model identifier
  quantity            – numeric quantity
  price               – numeric price
  purchase_department – supplier / purchase department name
  purchase_date       – normalised to YYYY-MM-DD

Public API
----------
    from ml.ocr.ocr_service import extract_from_bytes, extract_text_from_image
"""

from __future__ import annotations

import base64
import json
import logging
import os
import re
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# OpenAI GPT-4 Vision prompt
# ---------------------------------------------------------------------------

_OPENAI_PROMPT = """
You are an asset and invoice data extractor for a campus inventory system.
Examine the image and extract the following fields. Return ONLY a valid JSON object — no markdown, no explanation.

Fields to extract:
- asset_name          (string: product name / item description, or null)
- serial_number       (string: SN / serial number, or null)
- model               (string: model number / identifier, or null)
- quantity            (integer: quantity/units, or null)
- price               (number: item price as a float, or null)
- purchase_department (string: supplier / vendor / purchase department name, or null)
- purchase_date       (string: purchase date in YYYY-MM-DD format, or null)

If a field is not visible in the image, set it to null.
Return only valid JSON like:
{"asset_name":"...","serial_number":null,"model":"...","quantity":1,"price":0.0,"purchase_department":null,"purchase_date":null}
""".strip()


# ---------------------------------------------------------------------------
# Public entry points
# ---------------------------------------------------------------------------

def extract_from_bytes(image_bytes: bytes) -> dict:
    """
    Run OCR on raw image bytes.  Uses GPT-4 Vision if OPENAI_API_KEY is set,
    otherwise falls back to the local OpenCV + Tesseract pipeline.
    """
    # Prefer the pydantic-settings object (which reads .env) over raw os.getenv,
    # because pydantic-settings does not propagate .env values into os.environ.
    try:
        from app.core.config import settings  # type: ignore
        openai_key = (settings.OPENAI_API_KEY or "").strip()
    except Exception:
        openai_key = os.getenv("OPENAI_API_KEY", "").strip()

    if openai_key:
        logger.info("OCR engine: OpenAI GPT-4 Vision")
        try:
            return _extract_openai(image_bytes, openai_key)
        except Exception as exc:
            err_str = str(exc)
            # 429 quota-exceeded → silently fall back to Tesseract
            if "429" in err_str or "insufficient_quota" in err_str or "quota" in err_str.lower():
                logger.warning("OpenAI quota exceeded — falling back to Tesseract OCR")
            else:
                raise  # unexpected error — propagate

    logger.info("OCR engine: OpenCV + Tesseract")
    return _extract_tesseract_from_bytes(image_bytes)


def extract_text_from_image(image_path: str) -> dict:
    """
    Run OCR on a file path.  Delegates to extract_from_bytes internally.
    """
    with open(image_path, "rb") as fh:
        image_bytes = fh.read()
    return extract_from_bytes(image_bytes)


# ---------------------------------------------------------------------------
# Engine 1 — OpenAI GPT-4 Vision
# ---------------------------------------------------------------------------

def _extract_openai(image_bytes: bytes, api_key: str) -> dict:
    try:
        from openai import OpenAI  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "openai package is required for GPT-4 Vision OCR. "
            "Run: pip install openai"
        ) from exc

    client = OpenAI(api_key=api_key)
    b64 = base64.b64encode(image_bytes).decode("utf-8")

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{
            "role": "user",
            "content": [
                {"type": "text",      "text":      _OPENAI_PROMPT},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
            ],
        }],
        max_tokens=512,
        temperature=0,
    )

    raw_json = response.choices[0].message.content.strip()

    try:
        fields = json.loads(raw_json)
    except json.JSONDecodeError:
        # Model may have wrapped the JSON in markdown — fish it out
        m = re.search(r"\{.*\}", raw_json, re.DOTALL)
        fields = json.loads(m.group()) if m else {}

    # Coerce types
    try:
        if fields.get("price") is not None:
            fields["price"] = float(fields["price"])
    except (ValueError, TypeError):
        fields["price"] = None
    try:
        if fields.get("quantity") is not None:
            fields["quantity"] = int(fields["quantity"])
    except (ValueError, TypeError):
        fields["quantity"] = None

    # Build the standard response shape
    detected = {
        "asset_name":          fields.get("asset_name"),
        "serial_number":       fields.get("serial_number"),
        "model":               fields.get("model"),
        "quantity":            fields.get("quantity"),
        "price":               fields.get("price"),
        "purchase_department": fields.get("purchase_department"),
        "purchase_date":       fields.get("purchase_date"),
    }

    # GPT-4 returns structured fields directly; synthesise a human-readable text
    parts = [f"{k.replace('_', ' ').title()}: {v}" for k, v in detected.items() if v is not None]
    summary_text = "\n".join(parts) if parts else ""

    return {
        "text":            summary_text,
        "detected_fields": detected,
    }


# ---------------------------------------------------------------------------
# Engine 2 — OpenCV + Tesseract (local fallback)
# ---------------------------------------------------------------------------

def _extract_tesseract_from_bytes(image_bytes: bytes) -> dict:
    """
    Local OCR fallback.  Tries EasyOCR first (pure-Python, no binary needed),
    then falls back to OpenCV + Tesseract if EasyOCR is unavailable.
    """
    # ── EasyOCR path (preferred local engine, no binary required) ────────
    try:
        import easyocr  # type: ignore
        import cv2       # type: ignore
        import numpy as np  # type: ignore
        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Could not decode image")
        # EasyOCR expects BGR numpy array (HxWxC)
        reader = easyocr.Reader(["en"], gpu=False, verbose=False)
        results = reader.readtext(img)
        # results is a list of (bbox, text, confidence)
        raw_text = "\n".join(text for _, text, conf in results if conf > 0.2)
        logger.info("OCR engine: EasyOCR (local fallback)")
        return _build_result(raw_text)
    except Exception as easyocr_err:
        logger.warning("EasyOCR failed (%s) — trying Tesseract", easyocr_err)

    # ── OpenCV + Tesseract path ───────────────────────────────────────────
    try:
        import cv2          # type: ignore
        import numpy as np  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "No local OCR engine available.\n"
            "Install EasyOCR:  pip install easyocr\n"
            "Or install OpenCV + pytesseract + Tesseract binary:\n"
            "  pip install opencv-python pytesseract\n"
            "  https://github.com/UB-Mannheim/tesseract/wiki"
        ) from exc

    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Could not decode image bytes. Ensure the file is a valid JPEG/PNG/BMP.")

    preprocessed = _preprocess(image)
    raw_text = _run_tesseract(preprocessed)
    return _build_result(raw_text)


def _preprocess(image):
    import cv2  # type: ignore
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    return thresh


def _run_tesseract(preprocessed_image) -> str:
    try:
        import pytesseract  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "pytesseract is required. Run: pip install pytesseract\n"
            "Also install the Tesseract binary: "
            "https://github.com/UB-Mannheim/tesseract/wiki\n"
            "Or set OPENAI_API_KEY in your .env to use GPT-4 Vision instead."
        ) from exc

    tess_cmd = os.getenv("TESSERACT_CMD")
    if tess_cmd:
        pytesseract.pytesseract.tesseract_cmd = tess_cmd

    return pytesseract.image_to_string(preprocessed_image, config=r"--oem 3 --psm 6")


# ---------------------------------------------------------------------------
# Field extraction — regex patterns (Tesseract path only)
# ---------------------------------------------------------------------------

_ASSET_NAME_PATTERNS = [
    r"(?:Product|Item|Description|Asset\s*Name|Name)\s*[:\-]?\s*(.+?)(?:\n|$)",
]

_SERIAL_PATTERNS = [
    r"(?:S/?N|Serial\s*(?:No\.?|Number))\s*[:\-]?\s*([A-Z0-9\-]{5,40})",
    r"Serial\s*[:\-]?\s*([A-Z0-9\-]{5,40})",
]

_MODEL_PATTERNS = [
    r"(?:Model|Model\s*No\.?|Part\s*No\.?)\s*[:\-]?\s*([A-Za-z0-9\-\s]{3,40}?)(?:\n|,|$)",
]

_QTY_PATTERNS = [
    r"(?:Qty|Quantity|Units?|No\.\s*of\s*Items?)\s*[:\-]?\s*(\d+)",
    r"^(\d+)\s*(?:pcs?|units?|nos?)$",
]

_PRICE_PATTERNS = [
    r"(?:Total|Amount|Price|Cost|MRP|Rate)\s*[:\-]?\s*[₹$€£]?\s*([\d,]+(?:\.\d{1,2})?)",
    r"[₹$€£]\s*([\d,]+(?:\.\d{1,2})?)",
]

_PURCHASE_DEPT_PATTERNS = [
    r"(?:Vendor|Supplier|Sold\s*by|From|Manufacturer|Distributor)\s*[:\-]?\s*(.+?)(?:\n|$)",
]

_DATE_PATTERNS = [
    r"\b(\d{4}[-/]\d{2}[-/]\d{2})\b",
    r"\b(\d{2}[-/]\d{2}[-/]\d{4})\b",
    r"\b(\d{1,2}\s+\w{3,9}\s+\d{4})\b",
]


def extract_fields(raw_text: str) -> dict:
    upper = raw_text.upper()

    asset_name    = _first_match(_ASSET_NAME_PATTERNS, raw_text) or _heuristic_name(raw_text)
    serial_number = _first_match(_SERIAL_PATTERNS, upper)
    model         = _first_match(_MODEL_PATTERNS, raw_text, re.IGNORECASE)
    qty_raw       = _first_match(_QTY_PATTERNS, raw_text, re.IGNORECASE | re.MULTILINE)
    price_raw     = _first_match(_PRICE_PATTERNS, raw_text, re.IGNORECASE)
    purchase_department = _first_match(_PURCHASE_DEPT_PATTERNS, raw_text, re.IGNORECASE)
    purchase_date = _parse_date(raw_text)

    quantity: Optional[int] = None
    if qty_raw:
        try:
            quantity = int(qty_raw)
        except ValueError:
            pass

    price: Optional[float] = None
    if price_raw:
        try:
            price = float(price_raw.replace(",", ""))
        except ValueError:
            pass

    return {
        "asset_name":          asset_name,
        "serial_number":       serial_number,
        "model":               model,
        "quantity":            quantity,
        "price":               price,
        "purchase_department": purchase_department,
        "purchase_date":       purchase_date,
    }


def _build_result(raw_text: str) -> dict:
    text = raw_text.strip()
    if not text:
        return {
            "text": "",
            "detected_fields": {
                "asset_name": None, "serial_number": None, "model": None,
                "quantity": None, "price": None,
                "purchase_department": None, "purchase_date": None,
            },
            "message": "No readable text detected in image.",
        }
    return {"text": text, "detected_fields": extract_fields(text)}


def _first_match(patterns: list, text: str, flags: int = 0) -> Optional[str]:
    for pat in patterns:
        m = re.search(pat, text, flags)
        if m:
            return m.group(1).strip()
    return None


def _parse_date(text: str) -> Optional[str]:
    for pat in _DATE_PATTERNS:
        m = re.search(pat, text, re.IGNORECASE)
        if not m:
            continue
        raw = m.group(1)
        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d-%m-%Y", "%d/%m/%Y", "%d %B %Y", "%d %b %Y"):
            try:
                return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
            except ValueError:
                pass
    return None


def _heuristic_name(text: str) -> Optional[str]:
    for line in text.splitlines():
        line = line.strip()
        if len(line) > 4 and not re.match(r"^[\d\W]+$", line):
            return line
    return None

