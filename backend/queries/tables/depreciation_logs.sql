-- ============================================================
-- CampusLedger — Depreciation Logs Table
-- Depends on: extensions.sql, assets
-- Tracks calculated depreciation values over time.
-- ============================================================

CREATE TABLE depreciation_logs (
    id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id           UUID        NOT NULL REFERENCES assets (id) ON DELETE CASCADE,
    original_value     NUMERIC     NOT NULL CHECK (original_value >= 0),
    depreciated_value  NUMERIC     NOT NULL CHECK (depreciated_value >= 0),
    depreciation_rate  NUMERIC     NOT NULL CHECK (depreciation_rate BETWEEN 0 AND 100),
    calculated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
