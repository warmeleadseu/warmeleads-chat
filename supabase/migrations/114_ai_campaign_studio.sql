-- ============================================================
-- AI Meta Campaign Studio (Fase 1 + Fase 2 hooks)
-- ============================================================
-- Bouwt de fundamenten voor AI-gegenereerde Meta-advertenties:
-- * Briefs (input vanuit admin)
-- * Variants (per AI-gegenereerde ad: copy + image)
-- * Experiments (groepering van varianten per Meta-campagne)
-- * Decisions (auditlog van pause/scale/iterate/kill)
-- * Budget guards (per-branche hard caps + OpenAI maandcap)
-- * OpenAI usage log
-- * reserve_branch_budget() advisory-lock helper
-- * set_terminal_status_at() trigger op lead_assignments
-- ============================================================

-- ── 1. ai_campaign_briefs ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_campaign_briefs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  branch text NOT NULL REFERENCES public.branches(slug) ON UPDATE CASCADE,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'generated', 'launched', 'killed', 'failed')),
  target_audience jsonb NOT NULL DEFAULT '{}'::jsonb,
  geographic_targeting jsonb NOT NULL DEFAULT '{"countries":["NL"]}'::jsonb,
  target_cpl_cents integer,
  target_cpql_cents integer,
  daily_budget_cents integer NOT NULL,
  max_total_budget_cents integer NOT NULL,
  lead_form_id text NOT NULL,
  page_id text NOT NULL,
  special_ad_category text NOT NULL DEFAULT 'NONE'
    CHECK (special_ad_category IN ('NONE', 'CREDIT', 'EMPLOYMENT', 'HOUSING', 'ISSUES_ELECTIONS_POLITICS')),
  is_test_mode boolean NOT NULL DEFAULT false,
  image_formats text[] NOT NULL DEFAULT ARRAY['feed_1x1']::text[],
  variant_count integer NOT NULL DEFAULT 4 CHECK (variant_count BETWEEN 1 AND 10),
  naming_prefix text,
  created_by uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_briefs_branch ON public.ai_campaign_briefs(branch);
CREATE INDEX IF NOT EXISTS idx_ai_briefs_status ON public.ai_campaign_briefs(status);
CREATE INDEX IF NOT EXISTS idx_ai_briefs_created_at ON public.ai_campaign_briefs(created_at DESC);

CREATE TRIGGER set_ai_briefs_updated_at
  BEFORE UPDATE ON public.ai_campaign_briefs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.ai_campaign_briefs IS
  'Eén brief = één lancering. AI maakt varianten op basis van deze brief.';

-- ── 2. ai_campaign_experiments ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_campaign_experiments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brief_id uuid NOT NULL REFERENCES public.ai_campaign_briefs(id) ON DELETE CASCADE,
  meta_campaign_id text,
  meta_adset_id text,
  phase text NOT NULL DEFAULT 'pending'
    CHECK (phase IN ('pending', 'running', 'paused', 'killed', 'completed')),
  stop_reason text,
  last_optimizer_tick_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_exp_brief ON public.ai_campaign_experiments(brief_id);
CREATE INDEX IF NOT EXISTS idx_ai_exp_phase ON public.ai_campaign_experiments(phase);
CREATE INDEX IF NOT EXISTS idx_ai_exp_meta_campaign ON public.ai_campaign_experiments(meta_campaign_id)
  WHERE meta_campaign_id IS NOT NULL;

-- ── 3. ai_campaign_variants ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_campaign_variants (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brief_id uuid NOT NULL REFERENCES public.ai_campaign_briefs(id) ON DELETE CASCADE,
  experiment_id uuid REFERENCES public.ai_campaign_experiments(id) ON DELETE SET NULL,
  parent_variant_id uuid REFERENCES public.ai_campaign_variants(id) ON DELETE SET NULL,
  lineage_depth integer NOT NULL DEFAULT 0,
  angle text,
  tone text,
  headline text NOT NULL,
  primary_text text NOT NULL,
  description text,
  cta text NOT NULL,
  image_prompt text,
  image_storage_path text,
  image_url text,
  meta_image_hash text,
  meta_creative_id text,
  meta_ad_id text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'live', 'paused', 'killed', 'failed')),
  scale_count integer NOT NULL DEFAULT 0,
  policy_precheck jsonb NOT NULL DEFAULT '{}'::jsonb,
  generation jsonb NOT NULL DEFAULT '{}'::jsonb,
  prompt_used text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_variants_brief ON public.ai_campaign_variants(brief_id);
CREATE INDEX IF NOT EXISTS idx_ai_variants_experiment ON public.ai_campaign_variants(experiment_id)
  WHERE experiment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_variants_meta_ad ON public.ai_campaign_variants(meta_ad_id)
  WHERE meta_ad_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_variants_status ON public.ai_campaign_variants(status);

CREATE TRIGGER set_ai_variants_updated_at
  BEFORE UPDATE ON public.ai_campaign_variants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 4. ai_campaign_decisions ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_campaign_decisions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  experiment_id uuid REFERENCES public.ai_campaign_experiments(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.ai_campaign_variants(id) ON DELETE SET NULL,
  action text NOT NULL
    CHECK (action IN (
      'launch', 'pause_loser', 'scale_winner', 'iterate', 'kill_cold_funnel',
      'idle_pause', 'daily_cap_reached', 'no_demand', 'manual_kill', 'manual_resume',
      'policy_block_suspected', 'meta_rate_limited'
    )),
  reason text,
  metrics_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  dry_run boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_decisions_experiment ON public.ai_campaign_decisions(experiment_id);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_action ON public.ai_campaign_decisions(action);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_created_at ON public.ai_campaign_decisions(created_at DESC);

-- ── 5. ai_campaign_budget_guards ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_campaign_budget_guards (
  branch text PRIMARY KEY REFERENCES public.branches(slug) ON UPDATE CASCADE ON DELETE CASCADE,
  daily_budget_cents integer NOT NULL DEFAULT 0,
  monthly_budget_cents integer NOT NULL DEFAULT 0,
  spent_today_cents integer NOT NULL DEFAULT 0,
  spent_month_cents integer NOT NULL DEFAULT 0,
  openai_monthly_cap_cents integer NOT NULL DEFAULT 5000,
  openai_spent_month_cents integer NOT NULL DEFAULT 0,
  last_day_reset_at date NOT NULL DEFAULT CURRENT_DATE,
  last_month_reset_at date NOT NULL DEFAULT date_trunc('month', CURRENT_DATE)::date,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_ai_budget_guards_updated_at
  BEFORE UPDATE ON public.ai_campaign_budget_guards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.ai_campaign_budget_guards IS
  'Per-branche dag/maand cap voor Meta spend en OpenAI usage. 0 = AI uit voor die branche.';

INSERT INTO public.ai_campaign_budget_guards (branch)
SELECT slug FROM public.branches
ON CONFLICT (branch) DO NOTHING;

-- ── 6. ai_openai_usage ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_openai_usage (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  brief_id uuid REFERENCES public.ai_campaign_briefs(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.ai_campaign_variants(id) ON DELETE SET NULL,
  branch text REFERENCES public.branches(slug) ON UPDATE CASCADE,
  kind text NOT NULL CHECK (kind IN ('copy', 'image', 'judge', 'optimizer')),
  model text NOT NULL,
  cost_cents integer NOT NULL DEFAULT 0,
  input_tokens integer,
  output_tokens integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_openai_usage_created_at ON public.ai_openai_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_openai_usage_branch ON public.ai_openai_usage(branch);

-- ── 7. reserve_branch_budget() advisory-lock helper ────────────
CREATE OR REPLACE FUNCTION public.reserve_branch_budget(
  p_branch text,
  p_amount_cents integer
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  guard public.ai_campaign_budget_guards%ROWTYPE;
  today_date date := CURRENT_DATE;
  this_month date := date_trunc('month', CURRENT_DATE)::date;
BEGIN
  IF p_amount_cents <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'amount_must_be_positive');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('ai_budget:' || p_branch));

  SELECT * INTO guard FROM public.ai_campaign_budget_guards WHERE branch = p_branch FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_guard_for_branch');
  END IF;

  IF guard.last_day_reset_at < today_date THEN
    guard.spent_today_cents := 0;
    guard.last_day_reset_at := today_date;
  END IF;
  IF guard.last_month_reset_at < this_month THEN
    guard.spent_month_cents := 0;
    guard.last_month_reset_at := this_month;
  END IF;

  IF guard.daily_budget_cents <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'daily_budget_zero',
      'spent_today_cents', guard.spent_today_cents,
      'daily_budget_cents', guard.daily_budget_cents);
  END IF;

  IF guard.spent_today_cents + p_amount_cents > guard.daily_budget_cents THEN
    UPDATE public.ai_campaign_budget_guards
      SET spent_today_cents = guard.spent_today_cents,
          last_day_reset_at = guard.last_day_reset_at,
          spent_month_cents = guard.spent_month_cents,
          last_month_reset_at = guard.last_month_reset_at
      WHERE branch = p_branch;
    RETURN jsonb_build_object('ok', false, 'reason', 'daily_cap_exceeded',
      'spent_today_cents', guard.spent_today_cents,
      'daily_budget_cents', guard.daily_budget_cents,
      'requested_cents', p_amount_cents);
  END IF;

  IF guard.monthly_budget_cents > 0
     AND guard.spent_month_cents + p_amount_cents > guard.monthly_budget_cents THEN
    UPDATE public.ai_campaign_budget_guards
      SET spent_today_cents = guard.spent_today_cents,
          last_day_reset_at = guard.last_day_reset_at,
          spent_month_cents = guard.spent_month_cents,
          last_month_reset_at = guard.last_month_reset_at
      WHERE branch = p_branch;
    RETURN jsonb_build_object('ok', false, 'reason', 'monthly_cap_exceeded',
      'spent_month_cents', guard.spent_month_cents,
      'monthly_budget_cents', guard.monthly_budget_cents,
      'requested_cents', p_amount_cents);
  END IF;

  UPDATE public.ai_campaign_budget_guards
    SET spent_today_cents = guard.spent_today_cents + p_amount_cents,
        spent_month_cents = guard.spent_month_cents + p_amount_cents,
        last_day_reset_at = guard.last_day_reset_at,
        last_month_reset_at = guard.last_month_reset_at
    WHERE branch = p_branch;

  RETURN jsonb_build_object('ok', true,
    'spent_today_cents', guard.spent_today_cents + p_amount_cents,
    'spent_month_cents', guard.spent_month_cents + p_amount_cents,
    'daily_budget_cents', guard.daily_budget_cents,
    'monthly_budget_cents', guard.monthly_budget_cents);
END;
$$;

COMMENT ON FUNCTION public.reserve_branch_budget(text, integer) IS
  'Atomisch (advisory lock per branche): reset day/month counters indien nodig, verifieer caps, en boek reservering. Returns jsonb met ok=true bij succes of ok=false + reason.';

-- ── 8. reserve_openai_budget() helper ───────────────────────────
CREATE OR REPLACE FUNCTION public.reserve_openai_budget(
  p_branch text,
  p_amount_cents integer
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  guard public.ai_campaign_budget_guards%ROWTYPE;
  this_month date := date_trunc('month', CURRENT_DATE)::date;
BEGIN
  IF p_amount_cents <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'noop', true);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('ai_openai:' || p_branch));

  SELECT * INTO guard FROM public.ai_campaign_budget_guards WHERE branch = p_branch FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_guard_for_branch');
  END IF;

  IF guard.last_month_reset_at < this_month THEN
    guard.openai_spent_month_cents := 0;
    guard.last_month_reset_at := this_month;
  END IF;

  IF guard.openai_monthly_cap_cents > 0
     AND guard.openai_spent_month_cents + p_amount_cents > guard.openai_monthly_cap_cents THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'openai_cap_exceeded',
      'spent_month_cents', guard.openai_spent_month_cents,
      'cap_cents', guard.openai_monthly_cap_cents);
  END IF;

  UPDATE public.ai_campaign_budget_guards
    SET openai_spent_month_cents = guard.openai_spent_month_cents + p_amount_cents,
        last_month_reset_at = guard.last_month_reset_at
    WHERE branch = p_branch;

  RETURN jsonb_build_object('ok', true,
    'spent_month_cents', guard.openai_spent_month_cents + p_amount_cents,
    'cap_cents', guard.openai_monthly_cap_cents);
END;
$$;

COMMENT ON FUNCTION public.reserve_openai_budget(text, integer) IS
  'Atomisch: boek OpenAI-kosten op per-branche maandcap (advisory lock). 0-cap = unlimited.';

-- ── 9. set_terminal_status_at() trigger op lead_assignments ────
ALTER TABLE public.lead_assignments
  ADD COLUMN IF NOT EXISTS terminal_status_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_lead_assignments_terminal_at
  ON public.lead_assignments(terminal_status_at)
  WHERE terminal_status_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_terminal_status_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('verkocht', 'afgewezen') THEN
    IF OLD.status IS DISTINCT FROM NEW.status OR NEW.terminal_status_at IS NULL THEN
      NEW.terminal_status_at := COALESCE(NEW.terminal_status_at, now());
    END IF;
  ELSE
    NEW.terminal_status_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lead_assignments_terminal_status ON public.lead_assignments;
CREATE TRIGGER trg_lead_assignments_terminal_status
  BEFORE INSERT OR UPDATE OF status ON public.lead_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_terminal_status_at();

-- Backfill voor bestaande rijen
UPDATE public.lead_assignments
  SET terminal_status_at = COALESCE(terminal_status_at, assigned_at)
  WHERE status IN ('verkocht', 'afgewezen')
    AND terminal_status_at IS NULL;

-- ── 10. RLS ────────────────────────────────────────────────────
ALTER TABLE public.ai_campaign_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_campaign_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_campaign_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_campaign_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_campaign_budget_guards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_openai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access ai_campaign_briefs"
  ON public.ai_campaign_briefs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access ai_campaign_experiments"
  ON public.ai_campaign_experiments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access ai_campaign_variants"
  ON public.ai_campaign_variants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access ai_campaign_decisions"
  ON public.ai_campaign_decisions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access ai_campaign_budget_guards"
  ON public.ai_campaign_budget_guards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access ai_openai_usage"
  ON public.ai_openai_usage FOR ALL USING (true) WITH CHECK (true);

-- ── 11. app_settings defaults (master kill-switch) ─────────────
INSERT INTO public.app_settings (key, value)
VALUES ('ai_campaigns_enabled', 'false')
ON CONFLICT (key) DO NOTHING;
