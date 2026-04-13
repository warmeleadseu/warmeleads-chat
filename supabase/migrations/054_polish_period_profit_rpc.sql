-- Polish: filter ad spend to only include campaigns linked to actual leads,
-- matching the financial strip logic for consistency.
CREATE OR REPLACE FUNCTION period_profit_stats()
RETURNS jsonb
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  p record;
  p_start timestamptz;
  prev_start timestamptz;
  p_revenue numeric;
  p_prev_revenue numeric;
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
        p_start := now_ts - interval '3 days';
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

    -- Current period revenue (batch + bulk)
    SELECT COALESCE(SUM(
      CASE
        WHEN la.batch_id IS NOT NULL THEN cb.price_per_lead
        ELSE c.bulk_price_per_lead
      END
    ), 0)
    INTO p_revenue
    FROM lead_assignments la
    LEFT JOIN customer_batches cb ON cb.id = la.batch_id
    LEFT JOIN customers c ON c.id = la.customer_id
    WHERE la.assigned_at >= p_start
      AND (
        (la.batch_id IS NOT NULL AND cb.price_per_lead IS NOT NULL)
        OR (la.batch_id IS NULL AND c.bulk_price_per_lead IS NOT NULL)
      );

    -- Previous period revenue
    SELECT COALESCE(SUM(
      CASE
        WHEN la.batch_id IS NOT NULL THEN cb.price_per_lead
        ELSE c.bulk_price_per_lead
      END
    ), 0)
    INTO p_prev_revenue
    FROM lead_assignments la
    LEFT JOIN customer_batches cb ON cb.id = la.batch_id
    LEFT JOIN customers c ON c.id = la.customer_id
    WHERE la.assigned_at >= prev_start AND la.assigned_at < p_start
      AND (
        (la.batch_id IS NOT NULL AND cb.price_per_lead IS NOT NULL)
        OR (la.batch_id IS NULL AND c.bulk_price_per_lead IS NOT NULL)
      );

    -- Current period ad spend (only campaigns linked to our leads)
    SELECT COALESCE(SUM(mas.spend), 0)
    INTO p_spend
    FROM meta_ad_spend mas
    WHERE mas.date >= p_start::date
      AND mas.campaign_id IN (
        SELECT DISTINCT l.meta_campaign_id FROM leads l
        WHERE l.meta_campaign_id IS NOT NULL AND l.bron != 'excel_import'
      );

    -- Previous period ad spend
    SELECT COALESCE(SUM(mas.spend), 0)
    INTO p_prev_spend
    FROM meta_ad_spend mas
    WHERE mas.date >= prev_start::date
      AND mas.date < p_start::date
      AND mas.campaign_id IN (
        SELECT DISTINCT l.meta_campaign_id FROM leads l
        WHERE l.meta_campaign_id IS NOT NULL AND l.bron != 'excel_import'
      );

    result := result || jsonb_build_object(
      p.key, jsonb_build_object(
        'revenue', p_revenue,
        'prev_revenue', p_prev_revenue,
        'ad_spend', p_spend,
        'prev_ad_spend', p_prev_spend,
        'profit', p_revenue - p_spend,
        'prev_profit', p_prev_revenue - p_prev_spend
      )
    );
  END LOOP;

  RETURN result;
END;
$$;
