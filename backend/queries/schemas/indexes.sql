-- ============================================================
-- CampusLedger — Performance Indexes
-- Run after all tables are created.
-- ============================================================

-- assets
CREATE INDEX idx_assets_lab_id       ON assets (lab_id);
CREATE INDEX idx_assets_category_id  ON assets (category_id);
CREATE INDEX idx_assets_status       ON assets (status);

-- maintenance_requests
CREATE INDEX idx_maintenance_asset_id     ON maintenance_requests (asset_id);
CREATE INDEX idx_maintenance_reported_by  ON maintenance_requests (reported_by);
CREATE INDEX idx_maintenance_assigned     ON maintenance_requests (assigned_staff);
CREATE INDEX idx_maintenance_status       ON maintenance_requests (status);

-- purchase_requests
CREATE INDEX idx_purchase_req_requested_by  ON purchase_requests (requested_by);
CREATE INDEX idx_purchase_req_vendor_id     ON purchase_requests (vendor_id);
CREATE INDEX idx_purchase_req_order_status  ON purchase_requests (order_status);

-- purchase_orders
CREATE INDEX idx_purchase_orders_request_id  ON purchase_orders (request_id);
CREATE INDEX idx_purchase_orders_vendor_id   ON purchase_orders (vendor_id);

-- borrow_records
CREATE INDEX idx_borrow_records_asset_id  ON borrow_records (asset_id);

-- notifications
CREATE INDEX idx_notifications_user_id  ON notifications (user_id);
CREATE INDEX idx_notifications_status   ON notifications (status);

-- stock
CREATE INDEX idx_stock_lab_id    ON stock (lab_id);
CREATE INDEX idx_stock_category  ON stock (category);

-- stock_movements
CREATE INDEX idx_stock_movements_stock_id  ON stock_movements (stock_id);

-- consumption_history
CREATE INDEX idx_consumption_stock_id  ON consumption_history (stock_id);
CREATE INDEX idx_consumption_used_by   ON consumption_history (used_by);

-- approval_logs
CREATE INDEX idx_approval_logs_request_id    ON approval_logs (request_id);
CREATE INDEX idx_approval_logs_approved_by   ON approval_logs (approved_by);

-- transaction_logs
CREATE INDEX idx_transaction_logs_type          ON transaction_logs (transaction_type);
CREATE INDEX idx_transaction_logs_reference_id  ON transaction_logs (reference_id);
CREATE INDEX idx_transaction_logs_performed_by  ON transaction_logs (performed_by);

-- anomaly_alerts
CREATE INDEX idx_anomaly_alerts_severity      ON anomaly_alerts (severity);
CREATE INDEX idx_anomaly_alerts_reference_id  ON anomaly_alerts (reference_id);
