-- ============================================================
-- CampusLedger — Consumption History Table
-- Depends on: extensions.sql, stock, users
-- Records each consumable usage event for analytics.
-- ============================================================

CREATE TABLE consumption_history (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_id       UUID        NOT NULL REFERENCES stock (id) ON DELETE CASCADE,
    quantity_used  INTEGER     NOT NULL CHECK (quantity_used > 0),
    used_by        UUID        REFERENCES users (id) ON DELETE SET NULL,
    used_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
