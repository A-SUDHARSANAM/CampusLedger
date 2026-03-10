-- Migration 009: Create service_tasks table for the Admin → Service Staff task workflow
-- Applied automatically by migrate.py on startup.

CREATE TABLE IF NOT EXISTS service_tasks (
    id          SERIAL PRIMARY KEY,
    issue_id    TEXT        NOT NULL,   -- FK to maintenance_requests.id
    asset_id    TEXT        NOT NULL,
    assigned_to TEXT        NOT NULL,   -- FK to users.id (service_staff)
    assigned_by TEXT        NOT NULL,   -- FK to users.id (admin)
    priority    TEXT        NOT NULL DEFAULT 'medium',
    status      TEXT        NOT NULL DEFAULT 'pending',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT service_tasks_status_chk
        CHECK (status IN ('pending', 'in_progress', 'completed')),
    CONSTRAINT service_tasks_priority_chk
        CHECK (priority IN ('low', 'medium', 'high', 'critical'))
);

-- Helpful indexes for the two most common lookups
CREATE INDEX IF NOT EXISTS idx_service_tasks_assigned_to ON service_tasks (assigned_to);
CREATE INDEX IF NOT EXISTS idx_service_tasks_issue_id    ON service_tasks (issue_id);
