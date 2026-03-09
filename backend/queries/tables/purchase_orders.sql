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
