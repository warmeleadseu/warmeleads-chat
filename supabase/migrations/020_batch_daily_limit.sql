ALTER TABLE customer_batches ADD COLUMN IF NOT EXISTS leads_per_day integer;
ALTER TABLE batch_orders ADD COLUMN IF NOT EXISTS leads_per_day integer;
