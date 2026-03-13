"""
app/services/ocr_service.py
----------------------------
OCR service for reading asset/purchase information from invoice images.

Extraction targets
------------------
  product_name    – item description / product name
  serial_number   – SN / serial no.
  purchase_date   – date of purchase (normalised to YYYY-MM-DD)
  warranty_period – warranty duration string, e.g. "1 year", "24 months"
  price           – numeric price (float)

Two extraction engines are supported
-------------------------------------
1. **Tesseract** (default, free, local)
   Requires the ``pytesseract`` Python package and the Tesseract binary:
     pip install pytesseract
     # Windows: install from https://github.com/UB-Mannheim/tesseract/wiki
     # Linux:   sudo apt install tesseract-ocr
   Set TESSERACT_CMD in .env if the binary is not on PATH.

2. **OpenAI GPT-4 Vision** (optional, higher accuracy)
   Set ``OPENAI_API_KEY`` in your .env file to enable this engine.
   The service automatically uses OpenAI when the key is present.
   Falls back to Tesseract when the key is absent.

Usage
-----
    from app.services.ocr_service import extract_invoice_data

    result = extract_invoice_data(image_bytes)
    # {
    #   "product_name":    "Dell Laptop XPS 15",
    #   "serial_number":   "SN-ABC123456",
    #   "purchase_date":   "2025-03-04",
    #   "warranty_period": "1 year",
    #   "price":           85000.0,
    #   "raw_text":        "...",   # only for Tesseract engine
    #   "confidence":      0.85,   # engine-reported confidence
    # }
"""

import base64
import io
import logging
import os
import re
from typing import Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def extract_invoice_data(image_bytes: bytes) -> dict:
    """
    Extract asset fields from an invoice image.

    Parameters
    ----------
    image_bytes : raw bytes of a PNG / JPEG / WebP / PDF-first-page image

    Returns
    -------
    dict with keys: product_name, serial_number, purchase_date,
                    warranty_period, price, engine, confidence, raw_text
    """
    openai_key = os.getenv("OPENAI_API_KEY", "").strip()
    if openai_key:
        logger.info("OCR engine: OpenAI GPT-4 Vision")
        try:
            return _extract_openai(image_bytes, openai_key)
        except Exception as exc:
            # Keep OCR usable even when OpenAI SDK/API is unavailable.
            logger.warning("OpenAI OCR unavailable (%s) - falling back to Tesseract", exc)

    logger.info("OCR engine: Tesseract")
    return _extract_tesseract(image_bytes)


# ---------------------------------------------------------------------------
# Engine 1 — Tesseract
# ---------------------------------------------------------------------------

def _extract_tesseract(image_bytes: bytes) -> dict:
    try:
        import pytesseract  # type: ignore
        from PIL import Image  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "pytesseract and Pillow are required for local OCR. "
            "Run: pip install pytesseract Pillow"
        ) from exc

    # Allow overriding the tesseract binary path via env
    tess_cmd = os.getenv("TESSERACT_CMD")
    if tess_cmd:
        pytesseract.pytesseract.tesseract_cmd = tess_cmd

    img = Image.open(io.BytesIO(image_bytes))

    # Use page-segmentation mode 6 (assume single uniform block of text)
    custom_cfg = r"--oem 3 --psm 6"
    raw_text: str = pytesseract.image_to_string(img, config=custom_cfg)

    fields = _parse_text(raw_text)
    fields["engine"]   = "tesseract"
    fields["raw_text"] = raw_text
    return fields


# ---------------------------------------------------------------------------
# Engine 2 — OpenAI GPT-4 Vision
# ---------------------------------------------------------------------------

_OPENAI_PROMPT = """
You are an invoice parser. Extract the following fields from the invoice image and return ONLY a JSON object — no markdown, no explanation.

Fields to extract:
- product_name    (string: item name / product description)
- serial_number   (string: SN / serial number, or null)
- purchase_date   (string: date the item was purchased in YYYY-MM-DD format, or null)
- warranty_period (string: warranty duration, e.g. "1 year", "24 months", or null)
- price           (number: item price as a float, or null)

If a field is not found, set it to null.

Return only valid JSON like:
{"product_name": "...", "serial_number": "...", "purchase_date": "...", "warranty_period": "...", "price": 0.0}
""".strip()


def _extract_openai(image_bytes: bytes, api_key: str) -> dict:
    try:
        from openai import OpenAI  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "openai package is required for GPT-4 Vision OCR. "
            "Run: pip install openai"
        ) from exc

    client = OpenAI(api_key=api_key)
    b64    = base64.b64encode(image_bytes).decode("utf-8")

    response = client.chat.completions.create(
        model   = "gpt-4o",   # gpt-4o supports vision and is cheaper than gpt-4-vision-preview
        messages=[{
            "role": "user",
            "content": [
                {"type": "text",       "text":       _OPENAI_PROMPT},
                {"type": "image_url",  "image_url":  {"url": f"data:image/jpeg;base64,{b64}"}},
            ],
        }],
        max_tokens   = 512,
        temperature  = 0,
    )

    raw_json = response.choices[0].message.content.strip()

    import json
    try:
        fields = json.loads(raw_json)
    except json.JSONDecodeError:
        # Try to fish out a JSON blob if the model added surrounding text
        match = re.search(r"\{.*\}", raw_json, re.DOTALL)
        fields = json.loads(match.group()) if match else {}

    # Normalise types
    try:
        if fields.get("price") is not None:
            fields["price"] = float(fields["price"])
    except (ValueError, TypeError):
        fields["price"] = None

    fields["engine"]     = "openai"
    fields["confidence"] = 0.95
    fields["raw_text"]   = raw_json
    return _ensure_keys(fields)


# ---------------------------------------------------------------------------
# Regex-based field parser (Tesseract path)
# ---------------------------------------------------------------------------

_DATE_PATTERNS = [
    r"\b(\d{4}[-/]\d{2}[-/]\d{2})\b",           # 2025-03-04
    r"\b(\d{2}[-/]\d{2}[-/]\d{4})\b",           # 04-03-2025 or 04/03/2025
    r"\b(\d{1,2}\s+\w{3,9}\s+\d{4})\b",         # 4 March 2025
]

_SERIAL_PATTERNS = [
    r"(?:S/?N|Serial\s*(?:No\.?|Number))\s*[:\-]?\s*([A-Z0-9\-]{5,30})",
    r"(?:Serial)\s*[:\-]?\s*([A-Z0-9\-]{5,30})",
]

_PRICE_PATTERNS = [
    r"(?:Total|Amount|Price|Cost|MRP)\s*[:\-]?\s*[₹$€£]?\s*([\d,]+(?:\.\d{1,2})?)",
    r"[₹$€£]\s*([\d,]+(?:\.\d{1,2})?)",
]

_WARRANTY_PATTERNS = [
    r"(?:Warranty|Guarantee|Warrantee)\s*[:\-]?\s*((?:\d+\s*)?(?:year|month|day)s?\b.*?)(?:\n|$)",
]

_PRODUCT_PATTERNS = [
    r"(?:Product|Item|Description|Model|Name)\s*[:\-]?\s*(.+?)(?:\n|$)",
]


def _parse_text(text: str) -> dict:
    """Run regex patterns against OCR text to extract structured fields."""
    upper = text.upper()

    product_name    = _first_match(_PRODUCT_PATTERNS, text) or _heuristic_product(text)
    serial_number   = _first_match(_SERIAL_PATTERNS, upper)
    purchase_date   = _parse_date(text)
    warranty_period = _first_match(_WARRANTY_PATTERNS, text, flags=re.IGNORECASE)
    price_raw       = _first_match(_PRICE_PATTERNS, text, flags=re.IGNORECASE)

    price: Optional[float] = None
    if price_raw:
        try:
            price = float(price_raw.replace(",", ""))
        except ValueError:
            pass

    return _ensure_keys({
        "product_name":    product_name,
        "serial_number":   serial_number,
        "purchase_date":   purchase_date,
        "warranty_period": warranty_period,
        "price":           price,
        "confidence":      0.6,   # conservative estimate for regex-based extraction
    })


def _first_match(patterns: list, text: str, flags: int = 0) -> Optional[str]:
    for pat in patterns:
        m = re.search(pat, text, flags)
        if m:
            return m.group(1).strip()
    return None


def _parse_date(text: str) -> Optional[str]:
    """Try date patterns and normalise to YYYY-MM-DD."""
    from datetime import datetime

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


def _heuristic_product(text: str) -> Optional[str]:
    """Return the first non-empty line that looks like a product name."""
    for line in text.splitlines():
        line = line.strip()
        if len(line) > 5 and not re.match(r"^[\d\W]+$", line):
            return line
    return None


def _ensure_keys(d: dict) -> dict:
    defaults = {
        "product_name":    None,
        "serial_number":   None,
        "purchase_date":   None,
        "warranty_period": None,
        "price":           None,
        "engine":          "unknown",
        "confidence":      0.0,
        "raw_text":        "",
    }
    defaults.update(d)
    return defaults
