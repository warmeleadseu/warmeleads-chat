-- Leveringsmodel: los van batch_size (productomvang) en batch_kind (producttype).

ALTER TABLE public.customer_batches
  ADD COLUMN IF NOT EXISTS delivery_model text NOT NULL DEFAULT 'capped';

ALTER TABLE public.batch_orders
  ADD COLUMN IF NOT EXISTS delivery_model text NOT NULL DEFAULT 'capped';

COMMENT ON COLUMN public.customer_batches.delivery_model IS
  'capped = pipeline met batch_size als lead-limiet; unlimited = onderzoek (alle inbound leads); manual = bulk/handmatig.';
COMMENT ON COLUMN public.batch_orders.delivery_model IS
  'Zelfde semantiek als customer_batches.delivery_model.';

ALTER TABLE public.customer_batches DROP CONSTRAINT IF EXISTS customer_batches_delivery_model_check;
ALTER TABLE public.customer_batches
  ADD CONSTRAINT customer_batches_delivery_model_check
  CHECK (delivery_model IN ('capped', 'unlimited', 'manual'));

ALTER TABLE public.batch_orders DROP CONSTRAINT IF EXISTS batch_orders_delivery_model_check;
ALTER TABLE public.batch_orders
  ADD CONSTRAINT batch_orders_delivery_model_check
  CHECK (delivery_model IN ('capped', 'unlimited', 'manual'));

UPDATE public.customer_batches
SET delivery_model = CASE
  WHEN batch_kind = 'niche_research' THEN 'unlimited'
  WHEN batch_kind = 'bulk_leads' THEN 'manual'
  ELSE 'capped'
END;

UPDATE public.batch_orders
SET delivery_model = CASE
  WHEN batch_kind = 'niche_research' THEN 'unlimited'
  WHEN batch_kind = 'bulk_leads' THEN 'manual'
  ELSE 'capped'
END;

CREATE INDEX IF NOT EXISTS idx_customer_batches_delivery_model_active
  ON public.customer_batches (delivery_model, status)
  WHERE status = 'active';
