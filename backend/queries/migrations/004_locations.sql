-- ============================================================
-- CampusLedger Migration 004 — Locations
-- Introduces a unified "locations" table that covers both
-- academic (lab) and non-academic (Mess, Gym, Library, …) areas.
-- Backward-compatible: existing lab_id on assets is preserved.
-- ============================================================

-- Step 1: Create the locations table
CREATE TABLE IF NOT EXISTS locations (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT        NOT NULL,
    type       TEXT        NOT NULL DEFAULT 'academic'
                           CHECK (type IN ('academic', 'non_academic')),
    -- For academic locations: optionally link to an existing lab row so that
    -- assets with only lab_id set are still returned by the locations API.
    lab_id     UUID        REFERENCES labs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 2: Auto-create academic locations for every existing lab
INSERT INTO locations (name, type, lab_id)
SELECT lab_name, 'academic', id
FROM   labs
ON CONFLICT DO NOTHING;

-- Step 3: Seed non-academic locations
INSERT INTO locations (name, type) VALUES
    ('Mess',       'non_academic'),
    ('Auditorium', 'non_academic'),
    ('Gym',        'non_academic'),
    ('Library',    'non_academic')
ON CONFLICT DO NOTHING;

-- Step 4: Add location_id column to assets (backward-compatible nullable FK)
ALTER TABLE assets
    ADD COLUMN IF NOT EXISTS location_id UUID
        REFERENCES locations(id) ON DELETE SET NULL;

-- Step 5: Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_assets_location_id  ON assets(location_id);
CREATE INDEX IF NOT EXISTS idx_locations_lab_id    ON locations(lab_id);
CREATE INDEX IF NOT EXISTS idx_locations_type      ON locations(type);
