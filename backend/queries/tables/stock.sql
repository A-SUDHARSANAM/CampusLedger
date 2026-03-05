-- ============================================================
-- CampusLedger — Stock Table
-- Depends on: extensions.sql, labs
-- Tracks consumable inventory items per lab.
-- ============================================================

CREATE TABLE stock (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    item_name      TEXT        NOT NULL,
    category       TEXT,
    quantity       INTEGER     NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    lab_id         UUID        REFERENCES labs (id) ON DELETE SET NULL,
    reorder_level  INTEGER     NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
