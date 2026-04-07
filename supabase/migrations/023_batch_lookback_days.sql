ALTER TABLE customer_batches ADD COLUMN IF NOT EXISTS lookback_days integer DEFAULT 3;
ALTER TABLE batch_orders ADD COLUMN IF NOT EXISTS lookback_days integer DEFAULT 3;
