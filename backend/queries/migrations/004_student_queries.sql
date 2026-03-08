-- ============================================================
-- Migration 004 — Student Queries table
-- Stores asset issues reported by students (public, no auth).
-- Safe to run repeatedly.
-- ============================================================

CREATE TABLE IF NOT EXISTS student_queries (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    student_name         TEXT        NOT NULL,
    student_id           TEXT        NOT NULL,
    department           TEXT        NOT NULL,
    lab_id               UUID        NOT NULL REFERENCES labs (id) ON DELETE CASCADE,
    asset_id             UUID        REFERENCES assets (id) ON DELETE SET NULL,
    issue_description    TEXT        NOT NULL,
    priority             TEXT        NOT NULL DEFAULT 'medium'
                                     CHECK (priority IN ('low', 'medium', 'high')),
    status               TEXT        NOT NULL DEFAULT 'pending'
                                     CHECK (status IN ('pending', 'reviewed', 'converted_to_maintenance', 'resolved')),
    assigned_technician  UUID        REFERENCES users (id) ON DELETE SET NULL,
    verified             BOOLEAN     NOT NULL DEFAULT FALSE,
    helpful_score        INTEGER     NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_queries_lab_id
    ON student_queries (lab_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_queries_status
    ON student_queries (status);
