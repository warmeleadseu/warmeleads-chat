-- ============================================================
-- Lead-level Meta leadgen submission id
-- ============================================================
-- Cruciaal voor Conversions API for Lead Ads attribution:
-- Meta matcht CRM-events (Lead/QualifiedLead/Purchase) terug aan
-- de oorspronkelijke advertentie via deze `lead_id` (de submission-id
-- die Meta meegeeft als iemand een Lead Form invult).
--
-- Zonder dit veld werkt CAPI nog wel via email/phone hashing, maar de
-- attributie naar campaign/adset/ad is een stuk minder betrouwbaar.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS meta_leadgen_id text;

CREATE INDEX IF NOT EXISTS idx_leads_meta_leadgen_id
  ON public.leads(meta_leadgen_id)
  WHERE meta_leadgen_id IS NOT NULL;

COMMENT ON COLUMN public.leads.meta_leadgen_id IS
  'Meta Lead Ads submission id (vroeger leadgen_id, in Graph API: lead_id). Cruciaal voor server-side CAPI attribution.';
