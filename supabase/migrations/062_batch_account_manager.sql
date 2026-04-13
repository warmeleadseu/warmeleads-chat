-- Add batch-level account manager for per-batch AM attribution
ALTER TABLE customer_batches
  ADD COLUMN IF NOT EXISTS account_manager_id uuid REFERENCES admin_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cb_account_manager ON customer_batches(account_manager_id);

-- Backfill: snapshot each batch's current customer AM
UPDATE customer_batches cb
SET account_manager_id = c.account_manager_id
FROM customers c
WHERE cb.customer_id = c.id
  AND c.account_manager_id IS NOT NULL
  AND cb.account_manager_id IS NULL;
