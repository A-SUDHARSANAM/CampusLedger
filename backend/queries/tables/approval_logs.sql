-- ============================================================
-- CampusLedger — Approval Logs Table
-- Depends on: extensions.sql, users
-- Tracks approvals across procurement and maintenance workflows.
-- request_type: 'purchase_request' | 'maintenance_request'
-- ============================================================

CREATE TABLE approval_logs (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    request_type    TEXT        NOT NULL
                                CHECK (request_type IN ('purchase_request', 'maintenance_request')),
    request_id      UUID        NOT NULL,
    approved_by     UUID        REFERENCES users (id) ON DELETE SET NULL,
    approval_status TEXT        NOT NULL
                                CHECK (approval_status IN ('approved', 'rejected', 'pending')),
    remarks         TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
