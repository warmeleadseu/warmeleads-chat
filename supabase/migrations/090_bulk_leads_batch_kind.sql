-- bulk_leads: verkocht pakket via CRM bulk-export, geen automatische verse-lead distributie

ALTER TABLE batch_orders DROP CONSTRAINT IF EXISTS batch_orders_batch_kind_check;
ALTER TABLE batch_orders
  ADD CONSTRAINT batch_orders_batch_kind_check
  CHECK (batch_kind IN ('leads', 'niche_research', 'bulk_leads'));

COMMENT ON COLUMN batch_orders.batch_kind IS 'leads = normale lead-batch; niche_research = onderzoeksbatch; bulk_leads = bulk-pakket (export naar portal)';

ALTER TABLE customer_batches DROP CONSTRAINT IF EXISTS customer_batches_batch_kind_check;
ALTER TABLE customer_batches
  ADD CONSTRAINT customer_batches_batch_kind_check
  CHECK (batch_kind IN ('leads', 'niche_research', 'bulk_leads'));

COMMENT ON COLUMN customer_batches.batch_kind IS 'leads = normale batch met distributie; niche_research = onderzoeksbatch; bulk_leads = bulk (geen automatische inbound-routering)';
