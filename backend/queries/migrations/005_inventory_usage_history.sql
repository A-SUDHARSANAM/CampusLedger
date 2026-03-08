-- ============================================================
-- Migration 005 — Inventory usage history table for ML demand prediction
-- Safe to run multiple times (uses IF NOT EXISTS)
-- ============================================================

CREATE TABLE IF NOT EXISTS inventory_usage_history (
    id             SERIAL PRIMARY KEY,
    item_id        INT           NOT NULL,
    item_name      VARCHAR(100)  NOT NULL,
    department     VARCHAR(100)  NOT NULL DEFAULT 'General',
    month          DATE          NOT NULL,          -- stored as first day of month, e.g. 2024-01-01
    quantity_used  INT           NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_item_month UNIQUE (item_id, department, month)
);

CREATE INDEX IF NOT EXISTS idx_usage_item_id  ON inventory_usage_history (item_id);
CREATE INDEX IF NOT EXISTS idx_usage_month    ON inventory_usage_history (month);

-- ── Seed data: 18 months of realistic usage history ──────────────────────────
-- Run only when table is empty so re-running the migration is idempotent.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM inventory_usage_history LIMIT 1) THEN

        -- Item 1: HDMI Cable — IT Lab
        INSERT INTO inventory_usage_history (item_id, item_name, department, month, quantity_used) VALUES
            (1, 'HDMI Cable',  'IT Lab',  '2024-01-01', 18),
            (1, 'HDMI Cable',  'IT Lab',  '2024-02-01', 22),
            (1, 'HDMI Cable',  'IT Lab',  '2024-03-01', 27),
            (1, 'HDMI Cable',  'IT Lab',  '2024-04-01', 24),
            (1, 'HDMI Cable',  'IT Lab',  '2024-05-01', 20),
            (1, 'HDMI Cable',  'IT Lab',  '2024-06-01', 30),
            (1, 'HDMI Cable',  'IT Lab',  '2024-07-01', 28),
            (1, 'HDMI Cable',  'IT Lab',  '2024-08-01', 25),
            (1, 'HDMI Cable',  'IT Lab',  '2024-09-01', 32),
            (1, 'HDMI Cable',  'IT Lab',  '2024-10-01', 35),
            (1, 'HDMI Cable',  'IT Lab',  '2024-11-01', 38),
            (1, 'HDMI Cable',  'IT Lab',  '2024-12-01', 42),
            (1, 'HDMI Cable',  'IT Lab',  '2025-01-01', 20),
            (1, 'HDMI Cable',  'IT Lab',  '2025-02-01', 26),
            (1, 'HDMI Cable',  'IT Lab',  '2025-03-01', 31),
            (1, 'HDMI Cable',  'IT Lab',  '2025-04-01', 29),
            (1, 'HDMI Cable',  'IT Lab',  '2025-05-01', 22),
            (1, 'HDMI Cable',  'IT Lab',  '2025-06-01', 33);

        -- Item 2: Keyboard — CS Lab
        INSERT INTO inventory_usage_history (item_id, item_name, department, month, quantity_used) VALUES
            (2, 'Keyboard',    'CS Lab',  '2024-01-01',  9),
            (2, 'Keyboard',    'CS Lab',  '2024-02-01', 11),
            (2, 'Keyboard',    'CS Lab',  '2024-03-01', 14),
            (2, 'Keyboard',    'CS Lab',  '2024-04-01', 12),
            (2, 'Keyboard',    'CS Lab',  '2024-05-01', 10),
            (2, 'Keyboard',    'CS Lab',  '2024-06-01', 16),
            (2, 'Keyboard',    'CS Lab',  '2024-07-01', 15),
            (2, 'Keyboard',    'CS Lab',  '2024-08-01', 13),
            (2, 'Keyboard',    'CS Lab',  '2024-09-01', 18),
            (2, 'Keyboard',    'CS Lab',  '2024-10-01', 20),
            (2, 'Keyboard',    'CS Lab',  '2024-11-01', 22),
            (2, 'Keyboard',    'CS Lab',  '2024-12-01', 25),
            (2, 'Keyboard',    'CS Lab',  '2025-01-01', 10),
            (2, 'Keyboard',    'CS Lab',  '2025-02-01', 13),
            (2, 'Keyboard',    'CS Lab',  '2025-03-01', 16),
            (2, 'Keyboard',    'CS Lab',  '2025-04-01', 14),
            (2, 'Keyboard',    'CS Lab',  '2025-05-01', 11),
            (2, 'Keyboard',    'CS Lab',  '2025-06-01', 18);

        -- Item 3: Mouse — CS Lab
        INSERT INTO inventory_usage_history (item_id, item_name, department, month, quantity_used) VALUES
            (3, 'Mouse',       'CS Lab',  '2024-01-01',  8),
            (3, 'Mouse',       'CS Lab',  '2024-02-01', 10),
            (3, 'Mouse',       'CS Lab',  '2024-03-01', 13),
            (3, 'Mouse',       'CS Lab',  '2024-04-01', 11),
            (3, 'Mouse',       'CS Lab',  '2024-05-01',  9),
            (3, 'Mouse',       'CS Lab',  '2024-06-01', 15),
            (3, 'Mouse',       'CS Lab',  '2024-07-01', 14),
            (3, 'Mouse',       'CS Lab',  '2024-08-01', 12),
            (3, 'Mouse',       'CS Lab',  '2024-09-01', 17),
            (3, 'Mouse',       'CS Lab',  '2024-10-01', 19),
            (3, 'Mouse',       'CS Lab',  '2024-11-01', 21),
            (3, 'Mouse',       'CS Lab',  '2024-12-01', 23),
            (3, 'Mouse',       'CS Lab',  '2025-01-01',  9),
            (3, 'Mouse',       'CS Lab',  '2025-02-01', 12),
            (3, 'Mouse',       'CS Lab',  '2025-03-01', 15),
            (3, 'Mouse',       'CS Lab',  '2025-04-01', 13),
            (3, 'Mouse',       'CS Lab',  '2025-05-01', 10),
            (3, 'Mouse',       'CS Lab',  '2025-06-01', 17);

        -- Item 4: Network Switch — IT Lab
        INSERT INTO inventory_usage_history (item_id, item_name, department, month, quantity_used) VALUES
            (4, 'Network Switch', 'IT Lab', '2024-01-01',  4),
            (4, 'Network Switch', 'IT Lab', '2024-02-01',  5),
            (4, 'Network Switch', 'IT Lab', '2024-03-01',  7),
            (4, 'Network Switch', 'IT Lab', '2024-04-01',  6),
            (4, 'Network Switch', 'IT Lab', '2024-05-01',  4),
            (4, 'Network Switch', 'IT Lab', '2024-06-01',  8),
            (4, 'Network Switch', 'IT Lab', '2024-07-01',  7),
            (4, 'Network Switch', 'IT Lab', '2024-08-01',  6),
            (4, 'Network Switch', 'IT Lab', '2024-09-01',  9),
            (4, 'Network Switch', 'IT Lab', '2024-10-01', 10),
            (4, 'Network Switch', 'IT Lab', '2024-11-01', 11),
            (4, 'Network Switch', 'IT Lab', '2024-12-01', 13),
            (4, 'Network Switch', 'IT Lab', '2025-01-01',  5),
            (4, 'Network Switch', 'IT Lab', '2025-02-01',  6),
            (4, 'Network Switch', 'IT Lab', '2025-03-01',  8),
            (4, 'Network Switch', 'IT Lab', '2025-04-01',  7),
            (4, 'Network Switch', 'IT Lab', '2025-05-01',  5),
            (4, 'Network Switch', 'IT Lab', '2025-06-01',  9);

        -- Item 5: Projector Bulb — Seminar Hall
        INSERT INTO inventory_usage_history (item_id, item_name, department, month, quantity_used) VALUES
            (5, 'Projector Bulb', 'Seminar Hall', '2024-01-01',  2),
            (5, 'Projector Bulb', 'Seminar Hall', '2024-02-01',  3),
            (5, 'Projector Bulb', 'Seminar Hall', '2024-03-01',  4),
            (5, 'Projector Bulb', 'Seminar Hall', '2024-04-01',  3),
            (5, 'Projector Bulb', 'Seminar Hall', '2024-05-01',  2),
            (5, 'Projector Bulb', 'Seminar Hall', '2024-06-01',  5),
            (5, 'Projector Bulb', 'Seminar Hall', '2024-07-01',  4),
            (5, 'Projector Bulb', 'Seminar Hall', '2024-08-01',  3),
            (5, 'Projector Bulb', 'Seminar Hall', '2024-09-01',  6),
            (5, 'Projector Bulb', 'Seminar Hall', '2024-10-01',  7),
            (5, 'Projector Bulb', 'Seminar Hall', '2024-11-01',  8),
            (5, 'Projector Bulb', 'Seminar Hall', '2024-12-01',  9),
            (5, 'Projector Bulb', 'Seminar Hall', '2025-01-01',  2),
            (5, 'Projector Bulb', 'Seminar Hall', '2025-02-01',  3),
            (5, 'Projector Bulb', 'Seminar Hall', '2025-03-01',  5),
            (5, 'Projector Bulb', 'Seminar Hall', '2025-04-01',  4),
            (5, 'Projector Bulb', 'Seminar Hall', '2025-05-01',  2),
            (5, 'Projector Bulb', 'Seminar Hall', '2025-06-01',  6);

        -- Item 6: USB Hub — Electronics Lab
        INSERT INTO inventory_usage_history (item_id, item_name, department, month, quantity_used) VALUES
            (6, 'USB Hub',    'Electronics Lab', '2024-01-01',  6),
            (6, 'USB Hub',    'Electronics Lab', '2024-02-01',  8),
            (6, 'USB Hub',    'Electronics Lab', '2024-03-01', 10),
            (6, 'USB Hub',    'Electronics Lab', '2024-04-01',  9),
            (6, 'USB Hub',    'Electronics Lab', '2024-05-01',  7),
            (6, 'USB Hub',    'Electronics Lab', '2024-06-01', 12),
            (6, 'USB Hub',    'Electronics Lab', '2024-07-01', 11),
            (6, 'USB Hub',    'Electronics Lab', '2024-08-01',  9),
            (6, 'USB Hub',    'Electronics Lab', '2024-09-01', 13),
            (6, 'USB Hub',    'Electronics Lab', '2024-10-01', 15),
            (6, 'USB Hub',    'Electronics Lab', '2024-11-01', 16),
            (6, 'USB Hub',    'Electronics Lab', '2024-12-01', 18),
            (6, 'USB Hub',    'Electronics Lab', '2025-01-01',  7),
            (6, 'USB Hub',    'Electronics Lab', '2025-02-01',  9),
            (6, 'USB Hub',    'Electronics Lab', '2025-03-01', 11),
            (6, 'USB Hub',    'Electronics Lab', '2025-04-01', 10),
            (6, 'USB Hub',    'Electronics Lab', '2025-05-01',  8),
            (6, 'USB Hub',    'Electronics Lab', '2025-06-01', 13);

    END IF;
END
$$;
