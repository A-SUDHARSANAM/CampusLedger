-- Migration 011: add lifecycle_years to assets table
-- Allows Financial Forecast module to compute replacement schedules.

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS lifecycle_years INTEGER DEFAULT 5;

-- Seed sensible defaults per category for existing rows
UPDATE assets SET lifecycle_years = 4 WHERE category = 'computers'    AND lifecycle_years IS NULL;
UPDATE assets SET lifecycle_years = 3 WHERE category = 'electronics'  AND lifecycle_years IS NULL;
UPDATE assets SET lifecycle_years = 7 WHERE category = 'furniture'    AND lifecycle_years IS NULL;
UPDATE assets SET lifecycle_years = 5 WHERE category = 'lab_equipment' AND lifecycle_years IS NULL;
UPDATE assets SET lifecycle_years = 5 WHERE category = 'networking'   AND lifecycle_years IS NULL;
UPDATE assets SET lifecycle_years = 3 WHERE category = 'software'     AND lifecycle_years IS NULL;
UPDATE assets SET lifecycle_years = 5 WHERE lifecycle_years IS NULL;
