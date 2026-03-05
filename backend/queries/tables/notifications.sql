-- ============================================================
-- CampusLedger — Notifications Table
-- Depends on: extensions.sql, enums.sql, users
-- Triggered by: maintenance events, purchase approvals,
--               delivery delays, warranty expiry
-- ============================================================

CREATE TABLE notifications (
    id          UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID                NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    message     TEXT                NOT NULL,
    status      TEXT                NOT NULL DEFAULT 'unread'
                                    CHECK (status IN ('unread', 'read')),
    created_at  TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);
