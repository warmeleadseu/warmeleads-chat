-- Fix: customer_batches heeft geen updated_at; index op created_at (105 gebruikte updated_at).
DROP INDEX IF EXISTS public.idx_customer_batches_meta_reconcile;

CREATE INDEX IF NOT EXISTS idx_customer_batches_meta_reconcile
  ON public.customer_batches (created_at DESC)
  WHERE cardinality(meta_campaign_ids) > 0
    AND (batch_kind IS NULL OR batch_kind = 'leads');
