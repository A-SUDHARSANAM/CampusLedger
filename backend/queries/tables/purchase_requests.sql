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
