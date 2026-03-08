"""
app/services/qr_service.py
--------------------------
QR code generation and decoding for CampusLedger maintenance requests.

Workflow
--------
1. Lab technician raises a maintenance issue  (POST /maintenance/report)
2. Admin assigns service staff               (PUT  /maintenance/{id}/assign)
3. System generates a QR code               (GET  /maintenance/{id}/qr)
   Payload: { issue_id, asset_id, assigned_staff_id }
4. Service staff scans QR after repair       (POST /maintenance/scan)
5. Backend marks the request as completed

QR codes are returned as base64-encoded PNG strings (data-URI ready).
"""

import base64
import io
import json

import qrcode
from qrcode.image.pil import PilImage


def generate_qr_b64(payload: dict) -> str:
    """
    Encode *payload* as JSON, create a QR code PNG, and return it
    as a base64 string suitable for embedding in a ``<img src="...">``
    data-URI or sending over the API.

    Example
    -------
    >>> qr_b64 = generate_qr_b64({
    ...     "issue_id":          "uuid-123",
    ...     "asset_id":          "uuid-456",
    ...     "assigned_staff_id": "uuid-789",
    ... })
    >>> # Use in HTML: <img src="data:image/png;base64,{qr_b64}">
    """
    json_data = json.dumps(payload, separators=(",", ":"))

    qr = qrcode.QRCode(
        version=None,           # auto-size
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(json_data)
    qr.make(fit=True)

    img: PilImage = qr.make_image(fill_color="black", back_color="white")

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)

    return base64.b64encode(buffer.read()).decode("utf-8")


def decode_qr_payload(qr_base64: str) -> dict:
    """
    Decode a base64-encoded QR PNG back to its original JSON payload.

    The mobile client captures the QR image, reads the embedded text
    (via a QR scanner SDK), and sends that text — typically the raw
    JSON string — back as ``qr_data``. This function handles both cases:

    * ``qr_data`` is the raw JSON string  → decoded directly.
    * ``qr_data`` is a base64-encoded PNG  → decoded via Pillow + pyzbar
      (requires ``pyzbar`` to be installed; falls back gracefully).

    In the typical mobile flow the client SDK returns the decoded string,
    so the base64 → image → scan path is rarely exercised in production.

    Raises
    ------
    ValueError
        If the payload cannot be decoded or is not valid JSON.
    """
    # Fast path: the value is already the JSON string from the QR scanner
    stripped = qr_base64.strip()
    if stripped.startswith("{"):
        try:
            return json.loads(stripped)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid JSON payload: {exc}") from exc

    # Slow path: re-decode a base64 PNG using pyzbar (optional dependency)
    try:
        from pyzbar.pyzbar import decode as pyzbar_decode  # type: ignore
        from PIL import Image  # type: ignore

        image_bytes = base64.b64decode(qr_base64)
        img = Image.open(io.BytesIO(image_bytes))
        decoded = pyzbar_decode(img)
        if not decoded:
            raise ValueError("No QR code found in the provided image")
        raw_text = decoded[0].data.decode("utf-8")
        return json.loads(raw_text)

    except ImportError:
        raise ValueError(
            "Cannot decode QR image server-side: install 'pyzbar' and 'Pillow', "
            "or send the decoded JSON string directly from the mobile client."
        )
    except Exception as exc:
        raise ValueError(f"Failed to decode QR code: {exc}") from exc


def generate_maintenance_qr(issue_id: str, asset_id: str, staff_id: str) -> str:
    """
    Generate a maintenance-verification QR code for a specific repair assignment.

    Encodes a JSON payload with ``issue_id``, ``asset_id``, and
    ``assigned_staff_id`` into a base64 PNG QR code.  The service staff
    scans this code after completing the repair; the backend uses all three
    fields to verify the scan before marking the request as completed.

    Parameters
    ----------
    issue_id : str
        UUID of the ``maintenance_requests`` row.
    asset_id : str
        UUID of the asset being repaired.
    staff_id : str
        UUID of the service staff member assigned to this request.
    """
    return generate_qr_b64({
        "issue_id":          issue_id,
        "asset_id":          asset_id,
        "assigned_staff_id": staff_id,
    })
