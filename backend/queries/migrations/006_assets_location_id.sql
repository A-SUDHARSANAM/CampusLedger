-- ============================================================
-- CampusLedger Migration 006 — Full Locations Setup
--
-- Runs safely even if migrations 004/005 were never applied.
-- Paste the entire script into Supabase SQL Editor and click Run.
-- All statements use IF NOT EXISTS / ON CONFLICT so they are
-- safe to run multiple times.
-- ============================================================

-- ── Step 1: Create the locations table ───────────────────────
CREATE TABLE IF NOT EXISTS locations (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT        NOT NULL,
    type       TEXT        NOT NULL DEFAULT 'academic'
                           CHECK (type IN ('academic', 'non_academic')),
    lab_id     UUID        REFERENCES labs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Step 2: Seed academic locations from existing labs ────────
-- Each lab row becomes one academic location automatically.
INSERT INTO locations (name, type, lab_id)
SELECT lab_name, 'academic', id
FROM   labs
ON CONFLICT DO NOTHING;

-- ── Step 3: Seed non-academic locations ──────────────────────
INSERT INTO locations (name, type) VALUES
    ('Mess',                    'non_academic'),
    ('Auditorium',              'non_academic'),
    ('Gym',                     'non_academic'),
    ('Library',                 'non_academic'),
    ('Administrative Office',   'non_academic'),
    ('Student Cafeteria',       'non_academic'),
    ('Sports Facility',         'non_academic'),
    ('Workshop & Maintenance',  'non_academic'),
    ('Hostel Complex',          'non_academic')
ON CONFLICT DO NOTHING;

-- ── Step 4: Add location_id to assets (nullable FK) ──────────
ALTER TABLE assets
    ADD COLUMN IF NOT EXISTS location_id UUID
        REFERENCES locations(id) ON DELETE SET NULL;

-- ── Step 5: Indexes ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_assets_location_id ON assets(location_id);
CREATE INDEX IF NOT EXISTS idx_locations_lab_id   ON locations(lab_id);
CREATE INDEX IF NOT EXISTS idx_locations_type     ON locations(type);

-- ── Step 6: Tell PostgREST to reload its schema cache ─────────
NOTIFY pgrst, 'reload schema';
