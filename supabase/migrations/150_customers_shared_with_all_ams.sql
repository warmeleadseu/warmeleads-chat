-- Klanten die door alle accountmanagers mogen worden ingezien/beheerd.
-- Los van account_manager_id=null (niet toegewezen / alleen admin).

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS shared_with_all_ams boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN customers.shared_with_all_ams IS
  'Als true: elke accountmanager mag deze klant zien/beheren. account_manager_id hoort dan null te zijn.';

CREATE INDEX IF NOT EXISTS idx_customers_shared_with_all_ams
  ON customers (shared_with_all_ams)
  WHERE shared_with_all_ams = true;

-- Consistentie: gedeelde klanten hebben geen vaste AM.
UPDATE customers
SET account_manager_id = NULL
WHERE shared_with_all_ams = true
  AND account_manager_id IS NOT NULL;
