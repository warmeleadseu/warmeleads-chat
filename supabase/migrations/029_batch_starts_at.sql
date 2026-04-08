-- Add optional start date for batches (NULL = start immediately)
ALTER TABLE customer_batches
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ DEFAULT NULL;
