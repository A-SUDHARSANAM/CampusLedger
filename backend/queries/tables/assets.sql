-- ============================================================
-- CampusLedger — Assets Table
-- Depends on: extensions.sql, asset_categories, labs, users
-- Lifecycle: purchase → active → under_maintenance → damaged
-- ============================================================

CREATE TABLE assets (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_name       TEXT        NOT NULL,
    category_id      UUID        REFERENCES asset_categories (id) ON DELETE SET NULL,
    lab_id           UUID        REFERENCES labs (id) ON DELETE SET NULL,
    serial_number    TEXT        UNIQUE,
    purchase_date    DATE,
    warranty_expiry  DATE,
    status           TEXT        NOT NULL DEFAULT 'active'
                                 CHECK (status IN ('active', 'damaged', 'under_maintenance')),
    condition_rating INTEGER     CHECK (condition_rating BETWEEN 1 AND 5),
    qr_code          TEXT        UNIQUE,
    created_by       UUID        REFERENCES users (id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
