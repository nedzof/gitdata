-- Remove legacy tables as recommended in corrections.md
-- This follows the exact recommendations from lines 103-117

BEGIN;

-- Drop legacy tables with CASCADE to remove dependent objects
DROP TABLE IF EXISTS receipts CASCADE;
DROP TABLE IF EXISTS declarations CASCADE;
DROP TABLE IF EXISTS manifests CASCADE;
DROP TABLE IF EXISTS edges CASCADE;
DROP TABLE IF EXISTS prices CASCADE;
DROP TABLE IF EXISTS revenue_events CASCADE;
DROP TABLE IF EXISTS price_rules CASCADE;
DROP TABLE IF EXISTS advisories CASCADE;
DROP TABLE IF EXISTS advisory_targets CASCADE;
DROP TABLE IF EXISTS rules CASCADE;
DROP TABLE IF EXISTS jobs CASCADE;
DROP TABLE IF EXISTS contract_templates CASCADE;
DROP TABLE IF EXISTS artifacts CASCADE;

COMMIT;