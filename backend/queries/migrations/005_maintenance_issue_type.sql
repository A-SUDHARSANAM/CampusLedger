-- ============================================================
-- Migration 005 — Add issue_type to maintenance_requests
-- Values: 'service_request' | 'purchase_request'
-- Safe to run repeatedly (IF NOT EXISTS / DO NOTHING).
-- ============================================================

ALTER TABLE maintenance_requests
    ADD COLUMN IF NOT EXISTS issue_type TEXT NOT NULL DEFAULT 'service_request'
        CHECK (issue_type IN ('service_request', 'purchase_request'));
