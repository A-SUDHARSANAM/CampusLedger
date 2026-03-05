-- ============================================================
-- CampusLedger — Asset Movements Table
-- Depends on: extensions.sql, assets, labs, users
-- Tracks asset transfers between labs.
-- ============================================================

CREATE TABLE asset_movements (
    id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id  UUID        NOT NULL REFERENCES assets (id) ON DELETE CASCADE,
    from_lab  UUID        REFERENCES labs (id) ON DELETE SET NULL,
    to_lab    UUID        REFERENCES labs (id) ON DELETE SET NULL,
    moved_by  UUID        REFERENCES users (id) ON DELETE SET NULL,
    moved_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
