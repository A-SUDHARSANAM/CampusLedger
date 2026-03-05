"""
app/services/storage_service.py
--------------------------------
Centralised Supabase Storage upload service for CampusLedger.

Supported buckets
-----------------
- maintenance-images  : photos attached to maintenance issue reports
- purchase-invoices   : PDF / image invoices for purchase orders
- asset-documents     : manuals, warranty cards, purchase receipts for assets

Usage
-----
    from app.services.storage_service import upload_file, Bucket

    url = upload_file(
        sb       = supabase_admin_client,
        bucket   = Bucket.MAINTENANCE_IMAGES,
        folder   = "issue-uuid-here",
        file     = fastapi_upload_file_object,
    )
"""

import uuid
from enum import Enum

from fastapi import HTTPException, UploadFile, status
from supabase import Client


class Bucket(str, Enum):
    MAINTENANCE_IMAGES = "maintenance-images"
    PURCHASE_INVOICES  = "purchase-invoices"
    ASSET_DOCUMENTS    = "asset-documents"


# Allowed MIME types per bucket
_ALLOWED_TYPES: dict[str, set[str]] = {
    Bucket.MAINTENANCE_IMAGES: {
        "image/jpeg", "image/png", "image/webp", "image/gif",
    },
    Bucket.PURCHASE_INVOICES: {
        "application/pdf",
        "image/jpeg", "image/png", "image/webp",
    },
    Bucket.ASSET_DOCUMENTS: {
        "application/pdf",
        "image/jpeg", "image/png", "image/webp",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
}

# Maximum file size in bytes (10 MB)
MAX_FILE_SIZE = 10 * 1024 * 1024


def upload_file(
    sb: Client,
    bucket: Bucket,
    folder: str,
    file: UploadFile,
) -> str:
    """
    Upload *file* to the given Supabase Storage *bucket* under *folder*
    and return the public URL.

    Parameters
    ----------
    sb      : Supabase admin client (service-role, bypasses RLS)
    bucket  : one of :class:`Bucket`
    folder  : path prefix inside the bucket (e.g. an order ID or issue ID)
    file    : FastAPI ``UploadFile`` from a multipart form field

    Returns
    -------
    str
        The public URL of the uploaded file.

    Raises
    ------
    HTTPException 415
        If the MIME type is not allowed for this bucket.
    HTTPException 413
        If the file exceeds ``MAX_FILE_SIZE`` (10 MB).
    HTTPException 502
        If the Supabase Storage upload fails.
    """
    content_type = file.content_type or "application/octet-stream"

    # Validate MIME type
    allowed = _ALLOWED_TYPES.get(bucket, set())
    if allowed and content_type not in allowed:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"File type '{content_type}' is not allowed for bucket '{bucket}'. "
                f"Allowed types: {', '.join(sorted(allowed))}"
            ),
        )

    # Read and size-check
    file_bytes = file.file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the {MAX_FILE_SIZE // (1024 * 1024)} MB limit",
        )

    # Build a unique storage path:  folder/uuid.ext
    ext  = _extension(file.filename, content_type)
    path = f"{folder}/{uuid.uuid4().hex}.{ext}"

    try:
        sb.storage.from_(bucket).upload(
            path,
            file_bytes,
            {"content-type": content_type},
        )
        public_url: str = sb.storage.from_(bucket).get_public_url(path)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Storage upload failed: {exc}",
        ) from exc

    return public_url


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

_MIME_TO_EXT: dict[str, str] = {
    "image/jpeg":       "jpg",
    "image/png":        "png",
    "image/webp":       "webp",
    "image/gif":        "gif",
    "application/pdf":  "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
}


def _extension(filename: str | None, content_type: str) -> str:
    """Derive a safe file extension from the original filename or MIME type."""
    if filename and "." in filename:
        return filename.rsplit(".", 1)[-1].lower()
    return _MIME_TO_EXT.get(content_type, "bin")
