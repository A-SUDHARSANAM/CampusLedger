"""
app/services/blockchain_service.py
====================================
Cryptographic blockchain simulation for CampusLedger.

Each event is stored as a "block" in the ``blockchain_ledger`` Supabase table.
Every block's SHA-256 hash covers:
    block_index | asset_id | asset_name | action | performed_by | timestamp | prev_hash

This makes the chain tamper-evident: changing any field breaks all subsequent
hashes, and ``verify_chain()`` will catch it.

Architecture note
-----------------
When a Hardhat / Polygon node is reachable (BLOCKCHAIN_RPC_URL env var set)
the same events are *also* submitted to the on-chain CampusLedger.sol contract
so judges can see a real Ethereum transaction hash.  Without a node the service
degrades gracefully and the Python hash chain is the authoritative record.

Actions recorded automatically by the backend
----------------------------------------------
  ASSET_CREATED       asset added to the system
  ASSET_UPDATED       fields changed (status, lab, etc.)
  ASSET_DISPOSED      asset deleted / write-off
  MAINTENANCE_RAISED  maintenance request opened
  MAINTENANCE_DONE    maintenance request completed
  PROCUREMENT         purchase order approved / received
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Optional

from supabase import Client

_logger = logging.getLogger(__name__)

TABLE = "blockchain_ledger"
GENESIS_HASH = "0" * 64  # matches the SQL genesis block prev_hash


# ── Genesis / ensure table ────────────────────────────────────────────────────

def _ensure_genesis(sb: Client) -> None:
    """Insert genesis block if the table is empty."""
    try:
        existing = sb.table(TABLE).select("id").eq("block_index", 0).limit(1).execute()
        if existing.data:
            return
        genesis_content = f"0|GENESIS|CampusLedger|CHAIN_INIT|system|{GENESIS_HASH}"
        genesis_hash = hashlib.sha256(genesis_content.encode()).hexdigest()
        sb.table(TABLE).insert({
            "block_index":  0,
            "asset_id":     "GENESIS",
            "asset_name":   "CampusLedger",
            "action":       "CHAIN_INIT",
            "performed_by": "system",
            "block_hash":   genesis_hash,
            "prev_hash":    GENESIS_HASH,
            "block_data":   {"note": "Genesis block — immutable chain origin"},
        }).execute()
    except Exception as exc:
        _logger.warning("Could not ensure genesis block: %s", exc)


# ── Core block creation ───────────────────────────────────────────────────────

def _compute_hash(
    block_index: int,
    asset_id: str,
    asset_name: str,
    action: str,
    performed_by: str,
    timestamp: str,
    prev_hash: str,
) -> str:
    content = f"{block_index}|{asset_id}|{asset_name}|{action}|{performed_by}|{timestamp}|{prev_hash}"
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def record_event(
    sb: Client,
    asset_id: str,
    asset_name: str,
    action: str,
    performed_by: str,
    extra_data: Optional[dict[str, Any]] = None,
) -> Optional[str]:
    """
    Append a new block to the chain.  Returns the new block's SHA-256 hash,
    or None if the operation failed (non-fatal — main operation should proceed).

    Parameters
    ----------
    sb            Supabase admin client
    asset_id      Asset UUID or identifier string
    asset_name    Human-readable asset name
    action        One of the action constants above (e.g. "ASSET_CREATED")
    performed_by  Username / email / role string of the actor
    extra_data    Optional dict stored in block_data JSONB column
    """
    try:
        _ensure_genesis(sb)

        # Fetch current chain tip (highest block_index)
        tip_res = (
            sb.table(TABLE)
            .select("block_index, block_hash")
            .order("block_index", desc=True)
            .limit(1)
            .execute()
        )
        if tip_res.data:
            prev_index = tip_res.data[0]["block_index"]
            prev_hash  = tip_res.data[0]["block_hash"]
        else:
            prev_index = -1
            prev_hash  = GENESIS_HASH

        new_index = prev_index + 1
        timestamp = datetime.now(timezone.utc).isoformat()
        new_hash  = _compute_hash(
            new_index, asset_id, asset_name, action, performed_by, timestamp, prev_hash
        )

        row = {
            "block_index":  new_index,
            "asset_id":     asset_id,
            "asset_name":   asset_name,
            "action":       action,
            "performed_by": performed_by,
            "block_hash":   new_hash,
            "prev_hash":    prev_hash,
            "block_data":   json.dumps(extra_data or {}),
        }
        sb.table(TABLE).insert(row).execute()

        # ── Optional: also write to real Ethereum/Polygon node if configured ──
        _try_onchain(asset_id, asset_name, action, performed_by)

        _logger.info(
            "blockchain: block %d recorded  action=%s  asset=%s  hash=%.16s…",
            new_index, action, asset_id, new_hash,
        )
        return new_hash

    except Exception as exc:
        _logger.warning("blockchain record_event failed (non-fatal): %s", exc)
        return None


# ── Chain verification ────────────────────────────────────────────────────────

def verify_chain(sb: Client) -> dict[str, Any]:
    """
    Walk the entire chain and check every block_hash + prev_hash linkage.
    Returns {intact: bool, total_blocks: int, first_broken_index: int|None}.
    """
    try:
        rows = (
            sb.table(TABLE)
            .select("block_index, asset_id, asset_name, action, performed_by, created_at, block_hash, prev_hash")
            .order("block_index")
            .execute()
            .data or []
        )
        if not rows:
            return {"intact": True, "total_blocks": 0, "first_broken_index": None}

        for i, row in enumerate(rows):
            if row["block_index"] == 0:
                continue  # genesis: skip hash recompute
            expected = _compute_hash(
                row["block_index"],
                row["asset_id"],
                row["asset_name"],
                row["action"],
                row["performed_by"],
                row["created_at"],
                row["prev_hash"],
            )
            if expected != row["block_hash"]:
                return {
                    "intact": False,
                    "total_blocks": len(rows),
                    "first_broken_index": row["block_index"],
                }
            if i > 0 and rows[i]["prev_hash"] != rows[i - 1]["block_hash"]:
                return {
                    "intact": False,
                    "total_blocks": len(rows),
                    "first_broken_index": row["block_index"],
                }

        return {"intact": True, "total_blocks": len(rows), "first_broken_index": None}

    except Exception as exc:
        _logger.warning("verify_chain failed: %s", exc)
        return {"intact": False, "total_blocks": 0, "first_broken_index": None, "error": str(exc)}


# ── Optional on-chain write ───────────────────────────────────────────────────

def _try_onchain(asset_id: str, asset_name: str, action: str, performed_by: str) -> None:
    """
    Non-blocking attempt to also write to the deployed Solidity contract.
    Requires environment variables:
        BLOCKCHAIN_RPC_URL          e.g. http://127.0.0.1:8545  (local Hardhat)
        BLOCKCHAIN_CONTRACT_ADDRESS  the deployed CampusLedger.sol address
        DEPLOYER_PRIVATE_KEY         wallet private key (0x-prefixed)
    If any of these are missing or web3 is not installed, silently skips.
    """
    rpc_url  = os.getenv("BLOCKCHAIN_RPC_URL")
    contract = os.getenv("BLOCKCHAIN_CONTRACT_ADDRESS")
    key      = os.getenv("DEPLOYER_PRIVATE_KEY")
    if not (rpc_url and contract and key):
        return

    try:
        from web3 import Web3  # type: ignore

        w3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={"timeout": 5}))
        if not w3.is_connected():
            return

        abi = [
            {
                "inputs": [
                    {"internalType": "string", "name": "_assetId",     "type": "string"},
                    {"internalType": "string", "name": "_assetName",   "type": "string"},
                    {"internalType": "string", "name": "_action",      "type": "string"},
                    {"internalType": "string", "name": "_performedBy", "type": "string"},
                ],
                "name": "addBlock",
                "outputs": [{"internalType": "bytes32", "name": "newHash", "type": "bytes32"}],
                "stateMutability": "nonpayable",
                "type": "function",
            }
        ]
        account  = w3.eth.account.from_key(key)
        deployed = w3.eth.contract(address=Web3.to_checksum_address(contract), abi=abi)
        tx = deployed.functions.addBlock(asset_id, asset_name, action, performed_by).build_transaction({
            "from":     account.address,
            "nonce":    w3.eth.get_transaction_count(account.address),
            "gas":      200_000,
            "gasPrice": w3.eth.gas_price,
        })
        signed = account.sign_transaction(tx, private_key=key)
        tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
        _logger.info("on-chain tx submitted: %s", tx_hash.hex())

    except Exception as exc:
        # Never block the main operation
        _logger.debug("on-chain write skipped: %s", exc)
