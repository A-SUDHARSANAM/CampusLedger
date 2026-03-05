-- ============================================================
-- CampusLedger — Roles Table
-- Depends on: extensions.sql
-- Stores system-defined staff roles.
-- ============================================================

CREATE TABLE roles (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    role_name   TEXT        NOT NULL UNIQUE,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the four CampusLedger roles
INSERT INTO roles (role_name, description) VALUES
    ('admin',           'Full system access — manages users, assets, procurement'),
    ('lab_technician',  'Manages lab assets and raises maintenance/purchase requests'),
    ('service_staff',   'Handles assigned maintenance tasks'),
    ('purchase_dept',   'Processes purchase orders and handles vendor payments');
