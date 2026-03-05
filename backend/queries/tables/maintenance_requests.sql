-- ============================================================
-- CampusLedger — Maintenance Requests Table
-- Depends on: extensions.sql, enums.sql, assets, users
-- Workflow: report → assign → in_progress → completed
-- ============================================================

CREATE TABLE maintenance_requests (
    id                 UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id           UUID               NOT NULL REFERENCES assets (id) ON DELETE CASCADE,
    reported_by        UUID               REFERENCES users (id) ON DELETE SET NULL,
    issue_description  TEXT               NOT NULL,
    image_url          TEXT,
    priority           TEXT               NOT NULL DEFAULT 'medium'
                                          CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status             TEXT               NOT NULL DEFAULT 'pending'
                                          CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed')),
    assigned_staff     UUID               REFERENCES users (id) ON DELETE SET NULL,
    qr_code            TEXT,
    created_at         TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_maintenance_requests_updated_at
    BEFORE UPDATE ON maintenance_requests
    FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
