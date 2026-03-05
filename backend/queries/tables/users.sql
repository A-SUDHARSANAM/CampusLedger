-- ============================================================
-- CampusLedger — Users Table
-- Depends on: extensions.sql, roles, departments
-- ============================================================

CREATE TABLE users (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name           TEXT        NOT NULL,
    email          TEXT        NOT NULL UNIQUE,
    role_id        UUID        REFERENCES roles (id) ON DELETE SET NULL,
    department_id  UUID        REFERENCES departments (id) ON DELETE SET NULL,
    status         TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('active', 'pending')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
