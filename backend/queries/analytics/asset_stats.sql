-- ============================================================
-- CampusLedger — Asset Statistics (Admin Dashboard)
-- Depends on: assets, asset_categories, labs
-- ============================================================

-- Assets by status
SELECT
    status,
    COUNT(*) AS total
FROM assets
GROUP BY status
ORDER BY total DESC;

-- ─────────────────────────────────────────────────────────────

-- Assets by category
SELECT
    ac.category_name,
    COUNT(a.id) AS total
FROM asset_categories ac
LEFT JOIN assets a ON a.category_id = ac.id
GROUP BY ac.category_name
ORDER BY total DESC;

-- ─────────────────────────────────────────────────────────────

-- Assets by lab
SELECT
    l.lab_name,
    COUNT(a.id) AS total
FROM labs l
LEFT JOIN assets a ON a.lab_id = l.id
GROUP BY l.lab_name
ORDER BY total DESC;
