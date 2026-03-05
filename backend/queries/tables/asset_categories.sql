-- ============================================================
-- CampusLedger — Asset Categories Table
-- Depends on: extensions.sql
-- ============================================================

CREATE TABLE asset_categories (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    category_name  TEXT        NOT NULL UNIQUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed common categories
INSERT INTO asset_categories (category_name) VALUES
    ('computers'),
    ('networking'),
    ('lab_equipment'),
    ('furniture'),
    ('projectors');
