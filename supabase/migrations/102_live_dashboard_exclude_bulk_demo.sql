-- Live dashboard + period cards: align assignment/lead counts with admin dashboard
-- (exclude bulk_export + demo assignments; exclude demo leads from lead counts).

-- ═══════════════════════════════════════════════════════════════════
-- 1. live_revenue_stats() — CPL denominator = distributie-toewijzingen
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION live_revenue_stats()
RETURNS jsonb
LANGUAGE sql STABLE
AS $$
  SELECT jsonb_build_object(
    'batch_revenue', COALESCE((
      SELECT SUM(cb.total_price)
      FROM customer_batches cb
      WHERE cb.status IN ('active', 'completed')
        AND cb.total_price IS NOT NULL
    ), 0),
    'bulk_revenue', COALESCE((
      SELECT SUM(c.bulk_price_per_lead)
      FROM lead_assignments la
      JOIN customers c ON c.id = la.customer_id
      WHERE la.batch_id IS NULL
        AND c.bulk_price_per_lead IS NOT NULL
    ), 0),
    'total_assignments', COALESCE((
      SELECT COUNT(*)
      FROM lead_assignments la
      INNER JOIN leads l ON l.id = la.lead_id
      WHERE COALESCE(la.source, 'distribution') NOT IN ('bulk_export', 'demo')
        AND l.bron NOT IN ('excel_import', 'demo')
    ), 0),
    'unique_assigned_leads', COALESCE((
      SELECT COUNT(DISTINCT la.lead_id)
      FROM lead_assignments la
      INNER JOIN leads l ON l.id = la.lead_id
      WHERE COALESCE(la.source, 'distribution') NOT IN ('bulk_export', 'demo')
        AND l.bron NOT IN ('excel_import', 'demo')
    ), 0),
    'bulk_assignment_count', COALESCE((
      SELECT COUNT(*)
      FROM lead_assignments
      WHERE batch_id IS NULL
    ), 0)
  )
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 2. period_profit_stats() — periode-uitdeel + leads zonder bulk/demo
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION period_profit_stats()
RETURNS jsonb
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  p record;
  p_start timestamptz;
  prev_start timestamptz;
  p_leads bigint;
  p_prev_leads bigint;
  p_assigned bigint;
  p_prev_assigned bigint;
  p_revenue numeric;
  p_prev_revenue numeric;
  p_bulk_revenue numeric;
  p_prev_bulk_revenue numeric;
  p_spend numeric;
  p_prev_spend numeric;
  now_ts timestamptz := now();
BEGIN
  FOR p IN
    SELECT unnest(ARRAY['day','3days','week','month','quarter','year']) AS key
  LOOP
    CASE p.key
      WHEN 'day' THEN
        p_start := date_trunc('day', now_ts);
        prev_start := p_start - interval '1 day';
      WHEN '3days' THEN
        p_start := date_trunc('day', now_ts - interval '3 days');
        prev_start := p_start - interval '3 days';
      WHEN 'week' THEN
        p_start := date_trunc('week', now_ts);
        prev_start := p_start - interval '7 days';
      WHEN 'month' THEN
        p_start := date_trunc('month', now_ts);
        prev_start := p_start - interval '1 month';
      WHEN 'quarter' THEN
        p_start := date_trunc('quarter', now_ts);
        prev_start := p_start - interval '3 months';
      WHEN 'year' THEN
        p_start := date_trunc('year', now_ts);
        prev_start := p_start - interval '1 year';
    END CASE;

    SELECT COUNT(*) INTO p_leads
    FROM leads
    WHERE bron NOT IN ('excel_import', 'demo') AND created_at >= p_start;

    SELECT COUNT(*) INTO p_prev_leads
    FROM leads
    WHERE bron NOT IN ('excel_import', 'demo')
      AND created_at >= prev_start AND created_at < p_start;

    SELECT COUNT(*) INTO p_assigned
    FROM lead_assignments la
    INNER JOIN leads l ON l.id = la.lead_id
    WHERE la.assigned_at >= p_start
      AND COALESCE(la.source, 'distribution') NOT IN ('bulk_export', 'demo')
      AND l.bron NOT IN ('excel_import', 'demo');

    SELECT COUNT(*) INTO p_prev_assigned
    FROM lead_assignments la
    INNER JOIN leads l ON l.id = la.lead_id
    WHERE la.assigned_at >= prev_start AND la.assigned_at < p_start
      AND COALESCE(la.source, 'distribution') NOT IN ('bulk_export', 'demo')
      AND l.bron NOT IN ('excel_import', 'demo');

    SELECT COALESCE(SUM(cb.total_price), 0) INTO p_revenue
    FROM customer_batches cb
    WHERE cb.status IN ('active', 'completed')
      AND cb.total_price IS NOT NULL
      AND cb.created_at >= p_start;

    SELECT COALESCE(SUM(cb.total_price), 0) INTO p_prev_revenue
    FROM customer_batches cb
    WHERE cb.status IN ('active', 'completed')
      AND cb.total_price IS NOT NULL
      AND cb.created_at >= prev_start AND cb.created_at < p_start;

    SELECT COALESCE(SUM(c.bulk_price_per_lead), 0) INTO p_bulk_revenue
    FROM lead_assignments la
    JOIN customers c ON c.id = la.customer_id
    WHERE la.batch_id IS NULL
      AND c.bulk_price_per_lead IS NOT NULL
      AND la.assigned_at >= p_start;

    SELECT COALESCE(SUM(c.bulk_price_per_lead), 0) INTO p_prev_bulk_revenue
    FROM lead_assignments la
    JOIN customers c ON c.id = la.customer_id
    WHERE la.batch_id IS NULL
      AND c.bulk_price_per_lead IS NOT NULL
      AND la.assigned_at >= prev_start AND la.assigned_at < p_start;

    SELECT COALESCE(SUM(mas.spend), 0) INTO p_spend
    FROM meta_ad_spend mas
    WHERE mas.date >= p_start::date
      AND mas.campaign_id IN (
        SELECT DISTINCT l.meta_campaign_id FROM leads l
        WHERE l.meta_campaign_id IS NOT NULL AND l.bron NOT IN ('excel_import', 'demo')
      )
      AND mas.date >= COALESCE((
        SELECT MIN(cb2.created_at)::date
        FROM customer_batches cb2
        WHERE cb2.status IN ('active', 'completed')
          AND cb2.branch = (
            SELECT l2.branch FROM leads l2
            WHERE l2.meta_campaign_id = mas.campaign_id
              AND l2.bron NOT IN ('excel_import', 'demo')
            LIMIT 1
          )
      ), mas.date);

    SELECT COALESCE(SUM(mas.spend), 0) INTO p_prev_spend
    FROM meta_ad_spend mas
    WHERE mas.date >= prev_start::date AND mas.date < p_start::date
      AND mas.campaign_id IN (
        SELECT DISTINCT l.meta_campaign_id FROM leads l
        WHERE l.meta_campaign_id IS NOT NULL AND l.bron NOT IN ('excel_import', 'demo')
      )
      AND mas.date >= COALESCE((
        SELECT MIN(cb2.created_at)::date
        FROM customer_batches cb2
        WHERE cb2.status IN ('active', 'completed')
          AND cb2.branch = (
            SELECT l2.branch FROM leads l2
            WHERE l2.meta_campaign_id = mas.campaign_id
              AND l2.bron NOT IN ('excel_import', 'demo')
            LIMIT 1
          )
      ), mas.date);

    result := result || jsonb_build_object(
      p.key, jsonb_build_object(
        'leads', p_leads,
        'prev_leads', p_prev_leads,
        'assigned', p_assigned,
        'prev_assigned', p_prev_assigned,
        'revenue', p_revenue + p_bulk_revenue,
        'prev_revenue', p_prev_revenue + p_prev_bulk_revenue,
        'ad_spend', p_spend,
        'prev_ad_spend', p_prev_spend,
        'profit', (p_revenue + p_bulk_revenue) - p_spend,
        'prev_profit', (p_prev_revenue + p_prev_bulk_revenue) - p_prev_spend
      )
    );
  END LOOP;

  RETURN result;
END;
$$;
