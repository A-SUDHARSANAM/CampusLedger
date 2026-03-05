-- ============================================================
-- CampusLedger — ENUM Types
-- ============================================================

CREATE TYPE user_role AS ENUM (
    'admin',
    'lab_technician',
    'service_staff',
    'purchase_dept'
);

CREATE TYPE asset_status AS ENUM (
    'active',
    'damaged',
    'under_maintenance'
);

CREATE TYPE maintenance_status AS ENUM (
    'pending',
    'assigned',
    'in_progress',
    'completed'
);

CREATE TYPE order_status AS ENUM (
    'pending',
    'ordered',
    'delivered',
    'cancelled'
);

CREATE TYPE notification_status AS ENUM (
    'unread',
    'read'
);
