-- ============================================================
-- CampusLedger — Vendors Table
-- Depends on: extensions.sql
-- ============================================================

CREATE TABLE vendors (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_name    TEXT        NOT NULL,
    contact_email  TEXT        UNIQUE,
    phone          TEXT,
    rating         INTEGER     CHECK (rating BETWEEN 1 AND 5),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
