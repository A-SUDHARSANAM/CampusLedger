-- ============================================================
-- CampusLedger — Asset Summary View
-- Depends on: assets
-- Provides asset counts per lab, broken down by status.
-- ============================================================

CREATE OR REPLACE VIEW asset_summary AS
SELECT
    lab_id,
    COUNT(*)                                            AS total_assets,
    COUNT(*) FILTER (WHERE status = 'active')           AS active_assets,
    COUNT(*) FILTER (WHERE status = 'damaged')          AS damaged_assets,
    COUNT(*) FILTER (WHERE status = 'under_maintenance') AS under_maintenance_assets
FROM assets
GROUP BY lab_id;
