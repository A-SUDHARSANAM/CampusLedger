-- ============================================================
-- CampusLedger — Departments Table
-- Depends on: extensions.sql
-- Stores institutional departments that own labs and staff.
-- ============================================================

CREATE TABLE departments (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    department_name  TEXT        NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
