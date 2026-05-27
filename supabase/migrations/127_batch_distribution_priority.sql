-- Spoed/voorrang: deze pipeline-batch krijgt nieuwe leads vóór oudere open batches (zelfde klant + branche).

ALTER TABLE public.customer_batches
  ADD COLUMN IF NOT EXISTS distribution_priority boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.customer_batches.distribution_priority IS
  'Indien true: bij leadverdeling voorrang op FIFO-kop binnen dezelfde klant en branche.';

CREATE INDEX IF NOT EXISTS idx_customer_batches_distribution_priority
  ON public.customer_batches (distribution_priority)
  WHERE distribution_priority = true AND status = 'active';
