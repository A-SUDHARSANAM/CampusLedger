-- Migration 012: asset_usage_logs
-- Asset Utilization Intelligence — stores per-asset hourly usage by day.
-- Each row records how many hours a specific asset was in use on a given date.

CREATE TABLE IF NOT EXISTS asset_usage_logs (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id    UUID        NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    lab_id      UUID        REFERENCES labs(id) ON DELETE SET NULL,
    usage_hours FLOAT       NOT NULL CHECK (usage_hours >= 0),
    usage_date  DATE        NOT NULL DEFAULT CURRENT_DATE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_usage_logs_asset    ON asset_usage_logs(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_usage_logs_lab      ON asset_usage_logs(lab_id);
CREATE INDEX IF NOT EXISTS idx_asset_usage_logs_date     ON asset_usage_logs(usage_date);

-- Seed demo data for the current month (relative dates so it always lands in the current period)
-- Note: real asset_ids must exist; this seed is only applied after assets table is populated.
-- If assets do not yet exist the INSERT is a no-op due to the ON CONFLICT DO NOTHING.
-- The backend falls back to in-memory seed data when this table is empty.
