-- AI Studio v2: variant_count BETWEEN 1 AND 10 is te krap voor de nieuwe
-- tree-structuur (angles × adsets × creatives kan oplopen tot 5×3×5=75).
-- We verruimen de constraint tot 1..200 zodat realistische combinaties
-- toegestaan zijn. De daadwerkelijke creatives worden alsnog per ad set
-- gegenereerd vanuit `strategy_plan`, niet uit `variant_count`.

ALTER TABLE public.ai_campaign_briefs
  DROP CONSTRAINT IF EXISTS ai_campaign_briefs_variant_count_check;

ALTER TABLE public.ai_campaign_briefs
  ADD CONSTRAINT ai_campaign_briefs_variant_count_check
  CHECK (variant_count BETWEEN 1 AND 200);
