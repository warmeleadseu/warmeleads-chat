-- Track externally delivered leads (mail/Excel) separately so syncBatchDelivered
-- can always recount assignments without losing the manual offset.
ALTER TABLE customer_batches
  ADD COLUMN IF NOT EXISTS leads_delivered_external integer DEFAULT 0;
