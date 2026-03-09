-- ============================================================
-- CampusLedger — Blockchain Ledger Table
-- Stores cryptographically-chained audit blocks for every
-- significant asset lifecycle event.  Each row's block_hash
-- covers all fields + prev_hash so the chain is tamper-evident.
-- ============================================================

CREATE TABLE IF NOT EXISTS blockchain_ledger (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    block_index  BIGINT      NOT NULL,
    asset_id     TEXT        NOT NULL,
    asset_name   TEXT        NOT NULL DEFAULT '',
    action       TEXT        NOT NULL,
    performed_by TEXT        NOT NULL DEFAULT 'system',
    block_hash   TEXT        NOT NULL UNIQUE,
    prev_hash    TEXT        NOT NULL,
    block_data   JSONB       NOT NULL DEFAULT '{}',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookups by asset
CREATE INDEX IF NOT EXISTS idx_blockchain_asset_id
    ON blockchain_ledger (asset_id);

-- Ordered chain reads
CREATE INDEX IF NOT EXISTS idx_blockchain_block_index
    ON blockchain_ledger (block_index);

-- Genesis block (index 0) — inserted once
INSERT INTO blockchain_ledger (block_index, asset_id, asset_name, action, performed_by, block_hash, prev_hash, block_data)
SELECT
    0,
    'GENESIS',
    'CampusLedger',
    'CHAIN_INIT',
    'system',
    encode(sha256(convert_to('0|GENESIS|CampusLedger|CHAIN_INIT|system|0000000000000000000000000000000000000000000000000000000000000000', 'UTF8')), 'hex'),
    '0000000000000000000000000000000000000000000000000000000000000000',
    '{"note": "Genesis block — immutable chain origin"}'
WHERE NOT EXISTS (SELECT 1 FROM blockchain_ledger WHERE block_index = 0);
