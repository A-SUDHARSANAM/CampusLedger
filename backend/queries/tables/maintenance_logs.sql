-- ============================================================
-- CampusLedger — Maintenance Logs Table
-- Depends on: extensions.sql, maintenance_requests, users
-- Stores full activity history for each maintenance request.
-- ============================================================

CREATE TABLE maintenance_logs (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id   UUID        NOT NULL REFERENCES maintenance_requests (id) ON DELETE CASCADE,
    action       TEXT        NOT NULL,
    performed_by UUID        REFERENCES users (id) ON DELETE SET NULL,
    notes        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
