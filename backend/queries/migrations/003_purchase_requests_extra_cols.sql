-- ============================================================
-- Migration 003 — purchase_requests extra columns
-- Adds estimated_cost, notes, and lab_id to purchase_requests
-- so lab technicians can provide cost estimates and context,
-- and the admin can see which lab submitted each request.
-- Safe to run repeatedly (uses ALTER TABLE ... IF NOT EXISTS).
-- ============================================================

ALTER TABLE purchase_requests
    ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS notes          TEXT,
    ADD COLUMN IF NOT EXISTS lab_id         UUID REFERENCES labs (id) ON DELETE SET NULL;

-- Index for fast filtering by lab
CREATE INDEX IF NOT EXISTS idx_purchase_req_lab_id ON purchase_requests (lab_id);
