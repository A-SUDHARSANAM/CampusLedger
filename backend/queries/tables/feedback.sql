-- ============================================================
-- CampusLedger — Feedback Table
-- Depends on: extensions.sql, users
-- Users submit feedback on asset condition or service quality.
-- ============================================================

CREATE TABLE feedback (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        REFERENCES users (id) ON DELETE SET NULL,
    rating      INTEGER     NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comments    TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
