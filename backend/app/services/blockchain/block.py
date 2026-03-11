"""
app/services/blockchain/block.py
=================================
SHA-256 block model for the CampusLedger immutable audit chain.

Every asset lifecycle event is wrapped in a Block before being persisted to
the ``blockchain_ledger`` Supabase table.  The hash covers all identifying
fields so any tampering is detectable during chain verification.

Usage
-----
    from app.services.blockchain.block import Block

    block = Block(
        index=5,
        data={
            "asset_id":     "abc-123",
            "asset_name":   "Dell OptiPlex",
            "action":       "ASSET_CREATED",
            "performed_by": "admin@campus.edu",
        },
        previous_hash="9ef34a...",
    )
    print(block.hash)        # SHA-256 hex digest
    print(block.to_dict())   # ready for Supabase insert
"""
from __future__ import annotations

import hashlib
import time
from datetime import datetime, timezone
from typing import Any


class Block:
    """
    Represents a single block in the CampusLedger audit chain.

    Attributes
    ----------
    index         : Position in the chain (0 = genesis).
    timestamp     : Unix epoch float when this block was created.
    data          : Arbitrary dict payload for the event.
    previous_hash : SHA-256 hash of the preceding block.
    hash          : SHA-256 hash of this block's content.
    """

    def __init__(
        self,
        index: int,
        data: dict[str, Any],
        previous_hash: str,
    ) -> None:
        self.index         = index
        self.timestamp     = time.time()
        self.data          = data
        self.previous_hash = previous_hash
        self.hash          = self.calculate_hash()

    # ── Hash calculation ──────────────────────────────────────────────────────

    def calculate_hash(self) -> str:
        """
        Compute the SHA-256 digest of this block.

        The hash input mirrors the format used by ``blockchain_service.py``
        so Python-level blocks and DB-persisted blocks are interoperable:

            ``{index}|{asset_id}|{asset_name}|{action}|{performed_by}|{iso_ts}|{prev_hash}``
        """
        asset_id     = str(self.data.get("asset_id",     ""))
        asset_name   = str(self.data.get("asset_name",   ""))
        action       = str(self.data.get("action",       ""))
        performed_by = str(self.data.get("performed_by", ""))

        # Convert float timestamp → ISO string so the hash matches verify_chain()
        iso_ts = datetime.fromtimestamp(self.timestamp, tz=timezone.utc).isoformat()

        content = (
            f"{self.index}|{asset_id}|{asset_name}|{action}"
            f"|{performed_by}|{iso_ts}|{self.previous_hash}"
        )
        return hashlib.sha256(content.encode("utf-8")).hexdigest()

    # ── Serialisation ─────────────────────────────────────────────────────────

    def to_dict(self) -> dict[str, Any]:
        """Return a dict suitable for inserting into the ``blockchain_ledger`` table."""
        return {
            "block_index":  self.index,
            "asset_id":     str(self.data.get("asset_id",     "")),
            "asset_name":   str(self.data.get("asset_name",   "")),
            "action":       str(self.data.get("action",       "")),
            "performed_by": str(self.data.get("performed_by", "")),
            "block_hash":   self.hash,
            "prev_hash":    self.previous_hash,
            "block_data":   {k: v for k, v in self.data.items()
                             if k not in {"asset_id", "asset_name", "action", "performed_by"}},
        }

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"Block(index={self.index}, action={self.data.get('action')!r}, "
            f"hash={self.hash[:12]}...)"
        )
