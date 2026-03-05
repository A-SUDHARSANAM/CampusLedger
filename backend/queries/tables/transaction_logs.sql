-- ============================================================
-- CampusLedger — Transaction Logs Table
-- Depends on: extensions.sql, users
-- Immutable audit log for all important system transactions.
-- transaction_type examples: 'asset_added', 'purchase_approved',
--   'maintenance_completed', 'stock_restocked', 'user_approved'
-- ============================================================

CREATE TABLE transaction_logs (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_type  TEXT        NOT NULL,
    reference_id      UUID,
    performed_by      UUID        REFERENCES users (id) ON DELETE SET NULL,
    description       TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
