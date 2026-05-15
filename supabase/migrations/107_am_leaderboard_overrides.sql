-- Superadmin: leaderboard op live-dashboard per AM kunnen fine-tunen
-- (batch uitsluiten voor een kalendermaand + handmatige regels).

CREATE TABLE IF NOT EXISTS public.am_leaderboard_batch_exclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month text NOT NULL CHECK (year_month ~ '^\d{4}-\d{2}$'),
  customer_batch_id uuid NOT NULL REFERENCES public.customer_batches(id) ON DELETE CASCADE,
  reason text,
  created_by uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_batch_id, year_month)
);

CREATE INDEX IF NOT EXISTS idx_am_lb_exclusions_ym ON public.am_leaderboard_batch_exclusions(year_month);

CREATE TABLE IF NOT EXISTS public.am_leaderboard_manual_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month text NOT NULL CHECK (year_month ~ '^\d{4}-\d{2}$'),
  admin_user_id uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  label text NOT NULL,
  amount_euro numeric(12, 2) NOT NULL,
  counts_as_batch integer NOT NULL DEFAULT 0 CHECK (counts_as_batch IN (0, 1)),
  created_by uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_am_lb_manual_ym ON public.am_leaderboard_manual_lines(year_month);
CREATE INDEX IF NOT EXISTS idx_am_lb_manual_am ON public.am_leaderboard_manual_lines(admin_user_id);

ALTER TABLE public.am_leaderboard_batch_exclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.am_leaderboard_manual_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on am_leaderboard_batch_exclusions"
  ON public.am_leaderboard_batch_exclusions FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on am_leaderboard_manual_lines"
  ON public.am_leaderboard_manual_lines FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE public.am_leaderboard_batch_exclusions IS
  'Betaalde batches die voor een gegeven YYYY-MM niet meetellen op het live AM-leaderboard.';
COMMENT ON TABLE public.am_leaderboard_manual_lines IS
  'Handmatige leaderboard-correcties per AM per YYYY-MM (bedrag + optioneel als batch tellen).';
