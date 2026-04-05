-- Track payment status per batch
ALTER TABLE customer_batches ADD COLUMN IF NOT EXISTS is_paid boolean DEFAULT true;
ALTER TABLE customer_batches ADD COLUMN IF NOT EXISTS mollie_payment_id text;

-- Existing batches are considered paid, new admin-created batches can be marked unpaid
CREATE INDEX IF NOT EXISTS idx_customer_batches_is_paid ON customer_batches(is_paid) WHERE is_paid = false;
