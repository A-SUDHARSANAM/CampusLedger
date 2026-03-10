-- Migration 008: Add lab_id to users table
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Then re-run: python seed_lab123.py

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS lab_id UUID REFERENCES labs(id) ON DELETE SET NULL;

COMMENT ON COLUMN users.lab_id IS 'For lab_technician role: the lab this technician manages. Drives asset filtering on the maintenance page.';
