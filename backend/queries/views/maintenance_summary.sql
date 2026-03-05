-- ============================================================
-- CampusLedger — Maintenance Summary View
-- Depends on: maintenance_requests
-- Provides system-wide maintenance request statistics.
-- ============================================================

CREATE OR REPLACE VIEW maintenance_summary AS
SELECT
    COUNT(*)                                              AS total_requests,
    COUNT(*) FILTER (WHERE status = 'pending')            AS pending_requests,
    COUNT(*) FILTER (WHERE status = 'in_progress')        AS in_progress_requests,
    COUNT(*) FILTER (WHERE status = 'completed')          AS completed_requests
FROM maintenance_requests;
