-- ============================================================
-- Migration 001 — Add extra catalog columns to stock table
-- Safe to run repeatedly (uses ADD COLUMN IF NOT EXISTS)
-- ============================================================

ALTER TABLE stock
    ADD COLUMN IF NOT EXISTS sku            TEXT,
    ADD COLUMN IF NOT EXISTS unit_cost      NUMERIC     NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS warranty_months INTEGER     NOT NULL DEFAULT 12;
