-- Per gekoppelde Meta-campagne: handmatig gepauzeerd in CRM → altijd PAUSED in Ads Manager (los van batch-sync).

ALTER TABLE public.customer_batches
  ADD COLUMN IF NOT EXISTS meta_campaign_paused_ids text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.customer_batches.meta_campaign_paused_ids IS
  'Subset van meta_campaign_ids die in het CRM handmatig uit staan; reconcile zet deze campagnes op PAUSED.';

ALTER TABLE public.customer_branch_meta_defaults
  ADD COLUMN IF NOT EXISTS meta_campaign_paused_ids text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.customer_branch_meta_defaults.meta_campaign_paused_ids IS
  'Standaard handmatig gepauzeerde campagnes (subset van meta_campaign_ids).';
