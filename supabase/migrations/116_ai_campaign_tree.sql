-- ============================================================
-- AI Campaign Studio v2: multi-campaign tree-structuur
-- ============================================================
-- Doel: per launch een complete battle-plan (1 experiment ->
-- N Meta-campagnes per angle -> M ad sets per targeting-strategie ->
-- K creatives per ad set).
--
-- Extra: targeting-cache voor Meta interest search, lookalike
-- audiences pipeline, soft-delete vlaggen voor audit-trail.
-- ============================================================

-- ── 1. ai_campaign_meta_campaigns ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_campaign_meta_campaigns (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  experiment_id uuid NOT NULL REFERENCES public.ai_campaign_experiments(id) ON DELETE CASCADE,
  meta_campaign_id text,
  angle text NOT NULL,
  rationale text,
  daily_budget_cents integer NOT NULL DEFAULT 0,
  daily_budget_share numeric(5,4) NOT NULL DEFAULT 0,
  bid_strategy text NOT NULL DEFAULT 'LOWEST_COST_WITHOUT_CAP'
    CHECK (bid_strategy IN ('LOWEST_COST_WITHOUT_CAP', 'COST_CAP', 'LOWEST_COST_WITH_BID_CAP')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'paused', 'archived', 'failed')),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_meta_campaigns_exp ON public.ai_campaign_meta_campaigns(experiment_id);
CREATE INDEX IF NOT EXISTS idx_ai_meta_campaigns_meta_id ON public.ai_campaign_meta_campaigns(meta_campaign_id)
  WHERE meta_campaign_id IS NOT NULL;

CREATE TRIGGER set_ai_meta_campaigns_updated_at
  BEFORE UPDATE ON public.ai_campaign_meta_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.ai_campaign_meta_campaigns IS
  'Per experiment N Meta-campagnes (één per angle). CBO budget op deze laag.';

-- ── 2. ai_campaign_meta_adsets ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_campaign_meta_adsets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  meta_campaign_row_id uuid NOT NULL REFERENCES public.ai_campaign_meta_campaigns(id) ON DELETE CASCADE,
  meta_adset_id text,
  name text NOT NULL,
  strategy_type text NOT NULL
    CHECK (strategy_type IN ('broad', 'interest', 'behavior', 'lookalike', 'retargeting_excl', 'advantage')),
  targeting_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  daily_budget_cents integer,
  predicted_cpl_cents integer,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'paused', 'archived', 'failed')),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_meta_adsets_campaign ON public.ai_campaign_meta_adsets(meta_campaign_row_id);
CREATE INDEX IF NOT EXISTS idx_ai_meta_adsets_meta_id ON public.ai_campaign_meta_adsets(meta_adset_id)
  WHERE meta_adset_id IS NOT NULL;

CREATE TRIGGER set_ai_meta_adsets_updated_at
  BEFORE UPDATE ON public.ai_campaign_meta_adsets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.ai_campaign_meta_adsets IS
  'Per meta_campaign M ad sets, elk met eigen targeting-strategie (broad/interest/lookalike/...).';

-- ── 3. ai_campaign_variants: tree-koppeling + creative meta ─────
ALTER TABLE public.ai_campaign_variants
  ADD COLUMN IF NOT EXISTS meta_adset_row_id uuid REFERENCES public.ai_campaign_meta_adsets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS creative_style text,
  ADD COLUMN IF NOT EXISTS framework text,
  ADD COLUMN IF NOT EXISTS predicted_cpl_cents integer;

CREATE INDEX IF NOT EXISTS idx_ai_variants_adset_row
  ON public.ai_campaign_variants(meta_adset_row_id)
  WHERE meta_adset_row_id IS NOT NULL;

-- ── 4. ai_campaign_briefs: targeting + strategie + soft-delete ──
ALTER TABLE public.ai_campaign_briefs
  ADD COLUMN IF NOT EXISTS targeting_spec jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS strategy_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS strategy_plan jsonb,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_ai_briefs_not_deleted
  ON public.ai_campaign_briefs(branch, created_at DESC)
  WHERE deleted_at IS NULL;

-- ── 5. ai_campaign_experiments: tree-summary + soft-delete ──────
ALTER TABLE public.ai_campaign_experiments
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS tree_summary jsonb;

-- Phase enum uitbreiden met 'deleted' status (geen check-violation door
-- bestaande rijen — we vervangen de check):
ALTER TABLE public.ai_campaign_experiments DROP CONSTRAINT IF EXISTS ai_campaign_experiments_phase_check;
ALTER TABLE public.ai_campaign_experiments
  ADD CONSTRAINT ai_campaign_experiments_phase_check
  CHECK (phase IN ('pending', 'running', 'paused', 'killed', 'completed', 'deleted'));

CREATE INDEX IF NOT EXISTS idx_ai_exp_not_deleted
  ON public.ai_campaign_experiments(brief_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- ── 6. ai_campaign_briefs.status uitbreiden met 'deleted' ───────
ALTER TABLE public.ai_campaign_briefs DROP CONSTRAINT IF EXISTS ai_campaign_briefs_status_check;
ALTER TABLE public.ai_campaign_briefs
  ADD CONSTRAINT ai_campaign_briefs_status_check
  CHECK (status IN ('draft', 'generated', 'launched', 'killed', 'failed', 'deleted'));

-- ── 7. ai_campaign_decisions: action enum uitbreiden ────────────
ALTER TABLE public.ai_campaign_decisions DROP CONSTRAINT IF EXISTS ai_campaign_decisions_action_check;
ALTER TABLE public.ai_campaign_decisions
  ADD CONSTRAINT ai_campaign_decisions_action_check
  CHECK (action IN (
    'launch', 'pause_loser', 'scale_winner', 'iterate', 'kill_cold_funnel',
    'idle_pause', 'daily_cap_reached', 'no_demand', 'manual_kill', 'manual_resume',
    'policy_block_suspected', 'meta_rate_limited', 'manual_delete',
    'strategize', 'pause_adset', 'reallocate_budget', 'auto_iterate'
  ));

-- ── 8. meta_targeting_cache (interest search results) ──────────
CREATE TABLE IF NOT EXISTS public.meta_targeting_cache (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('interest_search', 'interest_suggestions', 'behavior_search')),
  query text NOT NULL,
  result jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meta_targeting_cache_expires
  ON public.meta_targeting_cache(expires_at);

COMMENT ON TABLE public.meta_targeting_cache IS
  '24u-cache voor Meta /search?type=adinterest etc. om herhaalde lookups te vermijden.';

-- ── 9. ai_campaign_lookalikes ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_campaign_lookalikes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  branch text NOT NULL REFERENCES public.branches(slug) ON UPDATE CASCADE,
  country text NOT NULL,
  ratio numeric(4,3) NOT NULL DEFAULT 0.01,
  seed_audience_id text,
  lookalike_audience_id text,
  exclusion_audience_id text,
  source_lead_count integer NOT NULL DEFAULT 0,
  last_refreshed_at timestamptz,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'building', 'ready', 'failed', 'stale')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_lookalikes_unique
  ON public.ai_campaign_lookalikes(branch, country, ratio);
CREATE INDEX IF NOT EXISTS idx_ai_lookalikes_status
  ON public.ai_campaign_lookalikes(status);

CREATE TRIGGER set_ai_lookalikes_updated_at
  BEFORE UPDATE ON public.ai_campaign_lookalikes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.ai_campaign_lookalikes IS
  'Per (branche, land, ratio) één Meta Lookalike + bijbehorende seed/exclusion audience. Wekelijks refreshen via cron.';

-- ── 10. RLS voor nieuwe tabellen ───────────────────────────────
ALTER TABLE public.ai_campaign_meta_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_campaign_meta_adsets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_targeting_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_campaign_lookalikes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access ai_meta_campaigns"
  ON public.ai_campaign_meta_campaigns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access ai_meta_adsets"
  ON public.ai_campaign_meta_adsets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access meta_targeting_cache"
  ON public.meta_targeting_cache FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access ai_lookalikes"
  ON public.ai_campaign_lookalikes FOR ALL USING (true) WITH CHECK (true);

-- ── 11. Backfill: bestaande experiment_id -> nieuwe tree-rij ────
-- Voor bestaande experimenten maken we 1 meta_campaign + 1 meta_adset
-- aan zodat queries die naar de tree kijken niet stuk gaan.
INSERT INTO public.ai_campaign_meta_campaigns (experiment_id, meta_campaign_id, angle, daily_budget_cents, daily_budget_share, status)
SELECT
  e.id,
  e.meta_campaign_id,
  COALESCE((SELECT v.angle FROM public.ai_campaign_variants v WHERE v.experiment_id = e.id AND v.angle IS NOT NULL LIMIT 1), 'legacy'),
  COALESCE(b.daily_budget_cents, 0),
  1.0,
  CASE WHEN e.phase = 'killed' THEN 'archived' WHEN e.phase = 'running' THEN 'active' ELSE 'paused' END
FROM public.ai_campaign_experiments e
LEFT JOIN public.ai_campaign_briefs b ON b.id = e.brief_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_campaign_meta_campaigns mc WHERE mc.experiment_id = e.id
);

INSERT INTO public.ai_campaign_meta_adsets (meta_campaign_row_id, meta_adset_id, name, strategy_type, status)
SELECT
  mc.id,
  e.meta_adset_id,
  'legacy-adset',
  'broad',
  CASE WHEN e.phase = 'killed' THEN 'archived' WHEN e.phase = 'running' THEN 'active' ELSE 'paused' END
FROM public.ai_campaign_meta_campaigns mc
JOIN public.ai_campaign_experiments e ON e.id = mc.experiment_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_campaign_meta_adsets ma WHERE ma.meta_campaign_row_id = mc.id
);

-- Verbind bestaande varianten met de legacy adset-rij van hun experiment
UPDATE public.ai_campaign_variants v
SET meta_adset_row_id = ma.id
FROM public.ai_campaign_meta_campaigns mc
JOIN public.ai_campaign_meta_adsets ma ON ma.meta_campaign_row_id = mc.id
WHERE mc.experiment_id = v.experiment_id
  AND v.meta_adset_row_id IS NULL
  AND v.experiment_id IS NOT NULL;
