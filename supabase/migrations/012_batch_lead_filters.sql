-- Add lead_filters (jsonb) to customer_batches
-- Allows per-batch filtering on lead custom_fields and standard fields
-- Format: [{ "field": "budget", "operator": "gte", "value": "5000" }, ...]
ALTER TABLE customer_batches ADD COLUMN IF NOT EXISTS lead_filters jsonb DEFAULT '[]';
