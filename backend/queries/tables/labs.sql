-- ============================================================
-- CampusLedger — Labs Table
-- Depends on: extensions.sql, departments
-- Each lab can contain multiple assets (assets.lab_id → labs.id)
-- ============================================================

CREATE TABLE labs (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_name       TEXT        NOT NULL,
    department_id  UUID        REFERENCES departments (id) ON DELETE SET NULL,
    location       TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
