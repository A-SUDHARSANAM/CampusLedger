-- ============================================================
-- Migration 002 — Student Borrows table
-- Tracks electronics/stock loans issued to students per lab.
-- Safe to run repeatedly (uses CREATE TABLE IF NOT EXISTS)
-- ============================================================

CREATE TABLE IF NOT EXISTS student_borrows (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_id        UUID        REFERENCES labs(id) ON DELETE SET NULL,
    created_by    UUID        REFERENCES users(id) ON DELETE SET NULL,
    student_name  TEXT        NOT NULL,
    project_name  TEXT        NOT NULL,
    bill_no       TEXT        NOT NULL,
    invoice_no    TEXT        NOT NULL,
    due_date      DATE        NOT NULL,
    returned_date DATE,
    status        TEXT        NOT NULL DEFAULT 'borrowed'
                              CHECK (status IN ('borrowed', 'returned', 'late_return', 'damaged')),
    fine_amount   NUMERIC     NOT NULL DEFAULT 0.00 CHECK (fine_amount >= 0),
    items         JSONB       NOT NULL DEFAULT '[]',
    issue_updates JSONB       NOT NULL DEFAULT '[]',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at on every change
CREATE OR REPLACE FUNCTION update_student_borrows_ts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_student_borrows_ts ON student_borrows;
CREATE TRIGGER trg_student_borrows_ts
    BEFORE UPDATE ON student_borrows
    FOR EACH ROW EXECUTE FUNCTION update_student_borrows_ts();
