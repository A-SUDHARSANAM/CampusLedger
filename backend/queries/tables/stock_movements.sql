-- ============================================================
-- CampusLedger — Stock Movements Table
-- Depends on: extensions.sql, stock, users
-- Tracks inflow and outflow of consumable stock items.
-- movement_type: 'inflow' (restock) | 'outflow' (consumed/issued)
-- ============================================================

CREATE TABLE stock_movements (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_id       UUID        NOT NULL REFERENCES stock (id) ON DELETE CASCADE,
    movement_type  TEXT        NOT NULL CHECK (movement_type IN ('inflow', 'outflow')),
    quantity       INTEGER     NOT NULL CHECK (quantity > 0),
    performed_by   UUID        REFERENCES users (id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
