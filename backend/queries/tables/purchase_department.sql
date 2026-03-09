-- ============================================================
-- CampusLedger — Purchase Department Table
-- Depends on: extensions.sql
-- ============================================================

CREATE TABLE purchase_department (
    id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_department_name    TEXT        NOT NULL,
    contact_email               TEXT        UNIQUE,
    phone                       TEXT,
    rating                      INTEGER     CHECK (rating BETWEEN 1 AND 5),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
