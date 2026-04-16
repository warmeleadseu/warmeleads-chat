ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_last_seen_at ON customers(last_seen_at);
