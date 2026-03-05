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
