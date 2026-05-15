-- Meta Marketing API: koppel lead-batches aan campagne-ID's; status ACTIVE/PAUSED
-- volgt batch-lifecycle (betaald, actief, vol, pauze) én geplande startdatum (starts_at).

ALTER TABLE public.customer_batches
  ADD COLUMN IF NOT EXISTS meta_campaign_ids TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS meta_campaign_sync_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS meta_sync_last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS meta_sync_last_success_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS meta_sync_last_error TEXT;

COMMENT ON COLUMN public.customer_batches.meta_campaign_ids IS 'Facebook Graph campaign ID(s); leeg = geen automatische Meta status-sync.';
COMMENT ON COLUMN public.customer_batches.meta_campaign_sync_enabled IS 'Uit = campagnes naar PAUSED, geen ACTIVE tot weer aan.';
COMMENT ON COLUMN public.customer_batches.meta_sync_last_error IS 'Laatste fouttekst van Meta sync (geen secrets); truncatie in applicatie.';

CREATE INDEX IF NOT EXISTS idx_customer_batches_meta_reconcile
  ON public.customer_batches (updated_at DESC)
  WHERE cardinality(meta_campaign_ids) > 0
    AND (batch_kind IS NULL OR batch_kind = 'leads');
