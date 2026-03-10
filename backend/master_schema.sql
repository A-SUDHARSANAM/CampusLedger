-- =============================================================
-- CampusLedger — Master Schema
-- Paste into: Supabase Dashboard → SQL Editor → Run
-- =============================================================


-- ── queries/schemas/extensions.sql ─────────────────────────
-- ============================================================
-- CampusLedger — PostgreSQL Extensions
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── queries/tables/departments.sql ─────────────────────────
-- ============================================================
-- CampusLedger — Departments Table
-- Depends on: extensions.sql
-- Stores institutional departments that own labs and staff.
-- ============================================================

CREATE TABLE departments (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    department_name  TEXT        NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── queries/tables/roles.sql ───────────────────────────────
-- ============================================================
-- CampusLedger — Roles Table
-- Depends on: extensions.sql
-- Stores system-defined staff roles.
-- ============================================================

CREATE TABLE roles (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    role_name   TEXT        NOT NULL UNIQUE,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the four CampusLedger roles
INSERT INTO roles (role_name, description) VALUES
    ('admin',           'Full system access — manages users, assets, procurement'),
    ('lab_technician',  'Manages lab assets and raises maintenance/purchase requests'),
    ('service_staff',   'Handles assigned maintenance tasks'),
    ('purchase_dept',   'Processes purchase orders and handles vendor payments');

-- ── queries/tables/asset_categories.sql ────────────────────
-- ============================================================
-- CampusLedger — Asset Categories Table
-- Depends on: extensions.sql
-- ============================================================

CREATE TABLE asset_categories (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    category_name  TEXT        NOT NULL UNIQUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed common categories
INSERT INTO asset_categories (category_name) VALUES
    ('computers'),
    ('networking'),
    ('lab_equipment'),
    ('furniture'),
    ('projectors');

-- ── queries/tables/purchase_department.sql ─────────────────────────────
-- ============================================================
-- CampusLedger — Purchase Department Table
-- Depends on: extensions.sql
-- ============================================================

CREATE TABLE purchase_department (
    id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_department_name    TEXT        NOT NULL,
    contact_email               TEXT        UNIQUE,
    phone                       TEXT,
    rating                      INTEGER     CHECK (rating BETWEEN 1 AND 5),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── queries/tables/labs.sql ────────────────────────────────
-- ============================================================
-- CampusLedger — Labs Table
-- Depends on: extensions.sql, departments
-- Each lab can contain multiple assets (assets.lab_id → labs.id)
-- ============================================================

CREATE TABLE labs (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_name       TEXT        NOT NULL,
    department_id  UUID        REFERENCES departments (id) ON DELETE SET NULL,
    location       TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── queries/tables/users.sql ───────────────────────────────
-- ============================================================
-- CampusLedger — Users Table
-- Depends on: extensions.sql, roles, departments
-- ============================================================

CREATE TABLE users (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name           TEXT        NOT NULL,
    email          TEXT        NOT NULL UNIQUE,
    role_id        UUID        REFERENCES roles (id) ON DELETE SET NULL,
    department_id  UUID        REFERENCES departments (id) ON DELETE SET NULL,
    status         TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('active', 'pending')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── queries/tables/assets.sql ──────────────────────────────
-- ============================================================
-- CampusLedger — Assets Table
-- Depends on: extensions.sql, asset_categories, labs, users
-- Lifecycle: purchase → active → under_maintenance → damaged
-- ============================================================

CREATE TABLE assets (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_name       TEXT        NOT NULL,
    category_id      UUID        REFERENCES asset_categories (id) ON DELETE SET NULL,
    lab_id           UUID        REFERENCES labs (id) ON DELETE SET NULL,
    serial_number    TEXT        UNIQUE,
    purchase_date    DATE,
    warranty_expiry  DATE,
    status           TEXT        NOT NULL DEFAULT 'active'
                                 CHECK (status IN ('active', 'damaged', 'under_maintenance')),
    condition_rating INTEGER     CHECK (condition_rating BETWEEN 1 AND 5),
    qr_code          TEXT        UNIQUE,
    created_by       UUID        REFERENCES users (id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── queries/tables/maintenance_requests.sql ────────────────
-- ============================================================
-- CampusLedger — Maintenance Requests Table
-- Depends on: extensions.sql, enums.sql, assets, users
-- Workflow: report → assign → in_progress → completed
-- ============================================================

CREATE TABLE maintenance_requests (
    id                 UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id           UUID               NOT NULL REFERENCES assets (id) ON DELETE CASCADE,
    reported_by        UUID               REFERENCES users (id) ON DELETE SET NULL,
    issue_description  TEXT               NOT NULL,
    image_url          TEXT,
    priority           TEXT               NOT NULL DEFAULT 'medium'
                                          CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status             TEXT               NOT NULL DEFAULT 'pending'
                                          CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed')),
    assigned_staff     UUID               REFERENCES users (id) ON DELETE SET NULL,
    qr_code            TEXT,
    created_at         TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_maintenance_requests_updated_at
    BEFORE UPDATE ON maintenance_requests
    FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- ── queries/tables/maintenance_logs.sql ────────────────────
-- ============================================================
-- CampusLedger — Maintenance Logs Table
-- Depends on: extensions.sql, maintenance_requests, users
-- Stores full activity history for each maintenance request.
-- ============================================================

CREATE TABLE maintenance_logs (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id   UUID        NOT NULL REFERENCES maintenance_requests (id) ON DELETE CASCADE,
    action       TEXT        NOT NULL,
    performed_by UUID        REFERENCES users (id) ON DELETE SET NULL,
    notes        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── queries/tables/purchase_requests.sql ───────────────────
-- ============================================================
-- CampusLedger — Purchase Requests Table
-- Depends on: extensions.sql, enums.sql, users, purchase_department
-- Workflow: request → admin_approval → purchase_dept processes
--           → purchase department order → payment → delivery
-- ============================================================

CREATE TABLE purchase_requests (
    id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    item_name                TEXT         NOT NULL,
    quantity                 INTEGER      NOT NULL CHECK (quantity > 0),
    requested_by             UUID         REFERENCES users (id) ON DELETE SET NULL,
    admin_approval           BOOLEAN      NOT NULL DEFAULT FALSE,
    purchase_department_id   UUID         REFERENCES purchase_department (id) ON DELETE SET NULL,
    payment_status   TEXT         NOT NULL DEFAULT 'unpaid'
                                  CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'refunded')),
    order_status     TEXT         NOT NULL DEFAULT 'pending'
                                  CHECK (order_status IN ('pending', 'ordered', 'delivered', 'cancelled')),
    delivery_date    DATE,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── queries/tables/purchase_orders.sql ─────────────────────
-- ============================================================
-- CampusLedger — Purchase Orders Table
-- Depends on: extensions.sql, enums.sql, purchase_requests, purchase_department
-- A purchase order is created once admin approves a purchase request.
-- ============================================================

CREATE TABLE purchase_orders (
    id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id               UUID         NOT NULL REFERENCES purchase_requests (id) ON DELETE CASCADE,
    purchase_department_id   UUID         REFERENCES purchase_department (id) ON DELETE SET NULL,
    payment_status  TEXT         NOT NULL DEFAULT 'unpaid'
                                 CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'refunded')),
    order_status    TEXT         NOT NULL DEFAULT 'pending'
                                 CHECK (order_status IN ('pending', 'ordered', 'delivered', 'cancelled')),
    invoice_url     TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── queries/tables/approval_logs.sql ───────────────────────
-- ============================================================
-- CampusLedger — Approval Logs Table
-- Depends on: extensions.sql, users
-- Tracks approvals across procurement and maintenance workflows.
-- request_type: 'purchase_request' | 'maintenance_request'
-- ============================================================

CREATE TABLE approval_logs (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    request_type    TEXT        NOT NULL
                                CHECK (request_type IN ('purchase_request', 'maintenance_request')),
    request_id      UUID        NOT NULL,
    approved_by     UUID        REFERENCES users (id) ON DELETE SET NULL,
    approval_status TEXT        NOT NULL
                                CHECK (approval_status IN ('approved', 'rejected', 'pending')),
    remarks         TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── queries/tables/asset_movements.sql ─────────────────────
-- ============================================================
-- CampusLedger — Asset Movements Table
-- Depends on: extensions.sql, assets, labs, users
-- Tracks asset transfers between labs.
-- ============================================================

CREATE TABLE asset_movements (
    id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id  UUID        NOT NULL REFERENCES assets (id) ON DELETE CASCADE,
    from_lab  UUID        REFERENCES labs (id) ON DELETE SET NULL,
    to_lab    UUID        REFERENCES labs (id) ON DELETE SET NULL,
    moved_by  UUID        REFERENCES users (id) ON DELETE SET NULL,
    moved_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── queries/tables/asset_verification.sql ──────────────────
-- ============================================================
-- CampusLedger — Asset Verification Table
-- Depends on: extensions.sql, assets, users
-- Stores periodic audit/verification checks on assets.
-- ============================================================

CREATE TABLE asset_verification (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id            UUID        NOT NULL REFERENCES assets (id) ON DELETE CASCADE,
    verified_by         UUID        REFERENCES users (id) ON DELETE SET NULL,
    verification_status TEXT        NOT NULL
                                    CHECK (verification_status IN ('verified', 'missing', 'damaged', 'needs_review')),
    remarks             TEXT,
    verified_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── queries/tables/depreciation_logs.sql ───────────────────
-- ============================================================
-- CampusLedger — Depreciation Logs Table
-- Depends on: extensions.sql, assets
-- Tracks calculated depreciation values over time.
-- ============================================================

CREATE TABLE depreciation_logs (
    id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id           UUID        NOT NULL REFERENCES assets (id) ON DELETE CASCADE,
    original_value     NUMERIC     NOT NULL CHECK (original_value >= 0),
    depreciated_value  NUMERIC     NOT NULL CHECK (depreciated_value >= 0),
    depreciation_rate  NUMERIC     NOT NULL CHECK (depreciation_rate BETWEEN 0 AND 100),
    calculated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── queries/tables/borrow_records.sql ──────────────────────
-- ============================================================
-- CampusLedger — Borrow Records Table
-- Depends on: extensions.sql, assets
-- Tracks temporary asset loans to students.
-- ============================================================

CREATE TABLE borrow_records (
    id            UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id      UUID     NOT NULL REFERENCES assets (id) ON DELETE CASCADE,
    student_name  TEXT     NOT NULL,
    student_id    TEXT     NOT NULL,
    borrowed_date DATE     NOT NULL DEFAULT CURRENT_DATE,
    return_date   DATE,
    fine_amount   NUMERIC  NOT NULL DEFAULT 0.00 CHECK (fine_amount >= 0),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── queries/tables/stock.sql ───────────────────────────────
-- ============================================================
-- CampusLedger — Stock Table
-- Depends on: extensions.sql, labs
-- Tracks consumable inventory items per lab.
-- ============================================================

CREATE TABLE stock (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    item_name      TEXT        NOT NULL,
    category       TEXT,
    quantity       INTEGER     NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    lab_id         UUID        REFERENCES labs (id) ON DELETE SET NULL,
    reorder_level  INTEGER     NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── queries/tables/stock_movements.sql ─────────────────────
-- ============================================================
-- CampusLedger — Stock Movements Table
-- Depends on: extensions.sql, stock, users
-- Tracks inflow and outflow of consumable stock items.
-- movement_type: 'inflow' (restock) | 'outflow' (consumed/issued)
-- ============================================================

CREATE TABLE stock_movements (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_id       UUID        NOT NULL REFERENCES stock (id) ON DELETE CASCADE,
    movement_type  TEXT        NOT NULL CHECK (movement_type IN ('inflow', 'outflow')),
    quantity       INTEGER     NOT NULL CHECK (quantity > 0),
    performed_by   UUID        REFERENCES users (id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── queries/tables/consumption_history.sql ─────────────────
-- ============================================================
-- CampusLedger — Consumption History Table
-- Depends on: extensions.sql, stock, users
-- Records each consumable usage event for analytics.
-- ============================================================

CREATE TABLE consumption_history (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_id       UUID        NOT NULL REFERENCES stock (id) ON DELETE CASCADE,
    quantity_used  INTEGER     NOT NULL CHECK (quantity_used > 0),
    used_by        UUID        REFERENCES users (id) ON DELETE SET NULL,
    used_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── queries/tables/notifications.sql ───────────────────────
-- ============================================================
-- CampusLedger — Notifications Table
-- Depends on: extensions.sql, enums.sql, users
-- Triggered by: maintenance events, purchase approvals,
--               delivery delays, warranty expiry
-- ============================================================

CREATE TABLE notifications (
    id          UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID                NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    message     TEXT                NOT NULL,
    status      TEXT                NOT NULL DEFAULT 'unread'
                                    CHECK (status IN ('unread', 'read')),
    created_at  TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

-- ── queries/tables/feedback.sql ────────────────────────────
-- ============================================================
-- CampusLedger — Feedback Table
-- Depends on: extensions.sql, users
-- Users submit feedback on asset condition or service quality.
-- ============================================================

CREATE TABLE feedback (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        REFERENCES users (id) ON DELETE SET NULL,
    rating      INTEGER     NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comments    TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── queries/tables/transaction_logs.sql ────────────────────
-- ============================================================
-- CampusLedger — Transaction Logs Table
-- Depends on: extensions.sql, users
-- Immutable audit log for all important system transactions.
-- transaction_type examples: 'asset_added', 'purchase_approved',
--   'maintenance_completed', 'stock_restocked', 'user_approved'
-- ============================================================

CREATE TABLE transaction_logs (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_type  TEXT        NOT NULL,
    reference_id      UUID,
    performed_by      UUID        REFERENCES users (id) ON DELETE SET NULL,
    description       TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── queries/tables/anomaly_alerts.sql ──────────────────────
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

-- ── queries/views/asset_summary.sql ────────────────────────
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

-- ── queries/views/maintenance_summary.sql ──────────────────
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

-- ── queries/schemas/indexes.sql ────────────────────────────
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
CREATE INDEX idx_purchase_req_purchase_department_id  ON purchase_requests (purchase_department_id);
CREATE INDEX idx_purchase_req_order_status            ON purchase_requests (order_status);

-- purchase_orders
CREATE INDEX idx_purchase_orders_request_id               ON purchase_orders (request_id);
CREATE INDEX idx_purchase_orders_purchase_department_id   ON purchase_orders (purchase_department_id);

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
CREATE INDEX idx_anomaly_alerts_reference_id  ON anomaly_alerts (reference_id);\ i   q u e r i e s / t a b l e s / s e r v i c e _ t a s k s . s q l  
 