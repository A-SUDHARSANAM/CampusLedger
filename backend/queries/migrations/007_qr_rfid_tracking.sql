-- ============================================================
-- Migration 007 — QR / RFID Asset Tracking Tables
-- Creates tables for RFID tag registry, asset verification
-- audit logs, RFID movement history, and asset usage logs.
-- Safe to run multiple times (uses IF NOT EXISTS).
-- ============================================================

-- 1. RFID tag → asset mapping ─────────────────────────────────
CREATE TABLE IF NOT EXISTS rfid_tags (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    rfid_tag     TEXT        NOT NULL UNIQUE,
    asset_id     UUID        REFERENCES assets (id) ON DELETE CASCADE,
    asset_name   TEXT        NOT NULL DEFAULT '',
    registered_by TEXT,
    is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rfid_tags_asset ON rfid_tags (asset_id);

-- 2. Asset verification / audit scan log ──────────────────────
CREATE TABLE IF NOT EXISTS asset_verification_logs (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id     TEXT        NOT NULL,
    asset_name   TEXT        NOT NULL DEFAULT '',
    verified_by  TEXT        NOT NULL,
    location     TEXT        NOT NULL DEFAULT '',
    scan_method  TEXT        NOT NULL DEFAULT 'qr'   -- 'qr' | 'rfid' | 'manual'
                             CHECK (scan_method IN ('qr', 'rfid', 'manual')),
    notes        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_avl_asset_id  ON asset_verification_logs (asset_id);
CREATE INDEX IF NOT EXISTS idx_avl_created   ON asset_verification_logs (created_at DESC);

-- 3. RFID movement / location history ─────────────────────────
CREATE TABLE IF NOT EXISTS rfid_movement_logs (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    rfid_tag        TEXT        NOT NULL,
    asset_id        TEXT,
    asset_name      TEXT        NOT NULL DEFAULT '',
    from_location   TEXT,
    to_location     TEXT        NOT NULL,
    is_authorized   BOOLEAN     NOT NULL DEFAULT TRUE,
    reader_id       TEXT,                               -- physical reader identifier
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rml_asset_id  ON rfid_movement_logs (asset_id);
CREATE INDEX IF NOT EXISTS idx_rml_created   ON rfid_movement_logs (created_at DESC);

-- 4. Asset usage log ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS asset_usage_logs (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id    TEXT        NOT NULL,
    asset_name  TEXT        NOT NULL DEFAULT '',
    location    TEXT        NOT NULL DEFAULT '',
    start_time  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_time    TIMESTAMPTZ,
    duration_minutes INT    GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (COALESCE(end_time, NOW()) - start_time)) / 60
    )::INT STORED,
    triggered_by TEXT       NOT NULL DEFAULT 'rfid'  -- 'rfid' | 'manual'
                            CHECK (triggered_by IN ('rfid', 'manual')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aul_asset_id  ON asset_usage_logs (asset_id);
CREATE INDEX IF NOT EXISTS idx_aul_created   ON asset_usage_logs (created_at DESC);
