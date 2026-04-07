-- Track compensation lead additions per batch
ALTER TABLE customer_batches
  ADD COLUMN IF NOT EXISTS compensations JSONB DEFAULT '[]'::jsonb;

-- Each entry: { "amount": 5, "reason": "Compensatie slechte leads batch #X", "date": "2026-03-16T..." }
