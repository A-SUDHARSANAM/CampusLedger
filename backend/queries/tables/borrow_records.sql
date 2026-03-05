-- ============================================================
-- CampusLedger — Borrow Records Table
-- Depends on: extensions.sql, assets
-- Tracks temporary asset loans to students.
-- ============================================================

CREATE TABLE borrow_records (
    id            UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id      UUID     NOT NULL REFERENCES assets (id) ON DELETE CASCADE,
    student_name  TEXT     NOT NULL,
    student_id    TEXT     NOT NULL,
    borrowed_date DATE     NOT NULL DEFAULT CURRENT_DATE,
    return_date   DATE,
    fine_amount   NUMERIC  NOT NULL DEFAULT 0.00 CHECK (fine_amount >= 0),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
