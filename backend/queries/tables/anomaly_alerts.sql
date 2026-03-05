-- ============================================================
-- CampusLedger — Anomaly Alerts Table
-- Depends on: extensions.sql
-- Stores system-detected anomalies for dashboard monitoring.
-- severity: 'low' | 'medium' | 'high' | 'critical'
-- alert_type examples: 'warranty_expiry', 'overdue_maintenance',
--   'low_stock', 'delayed_delivery', 'high_fine'
-- ============================================================

CREATE TABLE anomaly_alerts (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type    TEXT        NOT NULL,
    reference_id  UUID,
    severity      TEXT        NOT NULL DEFAULT 'medium'
                              CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    message       TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
