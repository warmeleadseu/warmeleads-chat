-- Fix revenue model: switch from assignment-based to order-based revenue.
--
-- Revenue = what customers pay = batch_size × price_per_lead = total_price
-- NOT leads_delivered × price_per_lead (overcounts due to compensations)
-- NOT count(lead_assignments) × price_per_lead (also overcounts)
--
-- Costs = total Meta ad spend
-- Profit = revenue - costs
-- Bulk = pure profit (leads already generated, no extra cost)

-- ═══════════════════════════════════════════════════════════════════
-- 1. live_revenue_stats() — hero KPI totals on the live dashboard
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
    'total_assignments', (
      SELECT COUNT(*)
      FROM lead_assignments
      WHERE batch_id IS NOT NULL
    ),
    'unique_assigned_leads', (
      SELECT COUNT(DISTINCT lead_id)
      FROM lead_assignments
      WHERE batch_id IS NOT NULL
    ),
    'bulk_assignment_count', (
      SELECT COUNT(*)
      FROM lead_assignments
      WHERE batch_id IS NULL
    )
  )
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 2. period_profit_stats() — day/week/month/quarter/year cards
--    Revenue is now attributed when the batch is CREATED (ordered),
--    not when individual leads are assigned.
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

    -- Leads generated in period (excluding excel imports)
    SELECT COUNT(*) INTO p_leads
    FROM leads
    WHERE bron != 'excel_import' AND created_at >= p_start;

    SELECT COUNT(*) INTO p_prev_leads
    FROM leads
    WHERE bron != 'excel_import'
      AND created_at >= prev_start AND created_at < p_start;

    -- Batch assignments in period (excluding bulk)
    SELECT COUNT(*) INTO p_assigned
    FROM lead_assignments
    WHERE batch_id IS NOT NULL AND assigned_at >= p_start;

    SELECT COUNT(*) INTO p_prev_assigned
    FROM lead_assignments
    WHERE batch_id IS NOT NULL
      AND assigned_at >= prev_start AND assigned_at < p_start;

    -- Batch revenue: SUM(total_price) for batches CREATED in the period
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

    -- Bulk revenue: assignments without batch, priced per customer
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

    -- Ad spend with branch-start cutoff
    SELECT COALESCE(SUM(mas.spend), 0) INTO p_spend
    FROM meta_ad_spend mas
    WHERE mas.date >= p_start::date
      AND mas.campaign_id IN (
        SELECT DISTINCT l.meta_campaign_id FROM leads l
        WHERE l.meta_campaign_id IS NOT NULL AND l.bron != 'excel_import'
      )
      AND mas.date >= COALESCE((
        SELECT MIN(cb2.created_at)::date
        FROM customer_batches cb2
        WHERE cb2.status IN ('active', 'completed')
          AND cb2.branch = (
            SELECT l2.branch FROM leads l2
            WHERE l2.meta_campaign_id = mas.campaign_id
              AND l2.bron != 'excel_import'
            LIMIT 1
          )
      ), mas.date);

    SELECT COALESCE(SUM(mas.spend), 0) INTO p_prev_spend
    FROM meta_ad_spend mas
    WHERE mas.date >= prev_start::date AND mas.date < p_start::date
      AND mas.campaign_id IN (
        SELECT DISTINCT l.meta_campaign_id FROM leads l
        WHERE l.meta_campaign_id IS NOT NULL AND l.bron != 'excel_import'
      )
      AND mas.date >= COALESCE((
        SELECT MIN(cb2.created_at)::date
        FROM customer_batches cb2
        WHERE cb2.status IN ('active', 'completed')
          AND cb2.branch = (
            SELECT l2.branch FROM leads l2
            WHERE l2.meta_campaign_id = mas.campaign_id
              AND l2.bron != 'excel_import'
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
