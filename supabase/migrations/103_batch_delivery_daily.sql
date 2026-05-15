-- Dagelijkse telling toegekende leads per batch (kalenderdag Europe/Amsterdam) voor levering-overzicht.

CREATE TABLE IF NOT EXISTS public.batch_delivery_daily (
  batch_id UUID NOT NULL REFERENCES public.customer_batches(id) ON DELETE CASCADE,
  day_date DATE NOT NULL,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (batch_id, day_date)
);

CREATE INDEX IF NOT EXISTS idx_batch_delivery_daily_day
  ON public.batch_delivery_daily (day_date DESC);

COMMENT ON TABLE public.batch_delivery_daily IS
  'Aantal lead-toewijzingen per batch per kalenderdag (Europe/Amsterdam). Wordt periodiek ververst.';

-- Kalenderdagen Amsterdam: gisteren t/m (gisteren - (n-1)), oudste eerst in array.
CREATE OR REPLACE FUNCTION public.last_n_completed_amsterdam_days(n integer)
RETURNS date[]
LANGUAGE sql
STABLE
AS $$
  WITH t AS (
    SELECT ((CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Amsterdam')::date - 1) AS yesterday
  )
  SELECT ARRAY(
    SELECT (yesterday - (g - 1))::date
    FROM t, generate_series(1, GREATEST(1, n)) AS g
    ORDER BY (yesterday - (g - 1)) ASC
  );
$$;

-- Vul/ververs batch_delivery_daily voor recente toewijzingen (efficiënte bulk upsert).
CREATE OR REPLACE FUNCTION public.refresh_batch_delivery_daily(p_days integer DEFAULT 14)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.batch_delivery_daily (batch_id, day_date, delivered_count)
  SELECT
    la.batch_id,
    (la.assigned_at AT TIME ZONE 'Europe/Amsterdam')::date AS d,
    COUNT(*)::integer
  FROM public.lead_assignments la
  INNER JOIN public.customer_batches cb ON cb.id = la.batch_id
  WHERE la.batch_id IS NOT NULL
    AND la.assigned_at >= NOW() - ((GREATEST(1, p_days) + 2) * INTERVAL '1 day')
    AND cb.batch_kind = 'leads'
    AND cb.status = 'active'
    AND COALESCE(cb.is_paid, false) = true
    AND cb.leads_per_day IS NOT NULL
    AND cb.leads_per_day > 0
  GROUP BY la.batch_id, (la.assigned_at AT TIME ZONE 'Europe/Amsterdam')::date
  ON CONFLICT (batch_id, day_date) DO UPDATE
  SET delivered_count = EXCLUDED.delivered_count;
END;
$$;
