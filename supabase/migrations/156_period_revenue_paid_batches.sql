-- ============================================================================
-- 156 — Periodetegels: omzet = betaalde batches, niet geleverde leads
--
-- De periodetegels (dag/week/maand/kwartaal/jaar) telden omzet per geleverde
-- lead (price_per_lead per assignment). Batches worden echter volledig vooraf
-- betaald: drie geleverde leads op een ochtend zijn geen "€89 omzet", die
-- batch was al afgerekend. Zelfde principe als migratie 142 voor het
-- omzettotaal, nu ook per periode:
--
--   omzet = som van total_price van betaalde batches (is_paid, niet
--           cancelled) die in de periode zijn aangemaakt
--         + bulkverkoop (die wordt wél per geleverde lead afgerekend).
--
-- Alle overige clausules zijn identiek aan migratie 155.
-- ============================================================================

CREATE OR REPLACE FUNCTION period_profit_stats()
RETURNS jsonb
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  p record;
  p_start timestamptz;
  prev_start timestamptz;
  -- UTC-middernacht, exact gelijk aan META_SPEND_START_ISO in src/lib/metaCpl.ts.
  boekhoud_start CONSTANT timestamptz := TIMESTAMPTZ '2026-05-01 00:00:00+00';
  p_leads bigint;
  p_prev_leads bigint;
  p_assigned bigint;
  p_prev_assigned bigint;
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

    prev_start := GREATEST(prev_start, boekhoud_start);
    p_start := GREATEST(p_start, boekhoud_start);

    SELECT COUNT(*) INTO p_leads
    FROM leads
    WHERE bron != 'excel_import' AND created_at >= p_start;

    SELECT COUNT(*) INTO p_prev_leads
    FROM leads
    WHERE bron != 'excel_import'
      AND created_at >= prev_start AND created_at < p_start;

    SELECT COUNT(*) INTO p_assigned
    FROM lead_assignments la
    INNER JOIN leads l ON l.id = la.lead_id
    WHERE COALESCE(la.source, 'distribution') NOT IN ('bulk_export', 'demo')
      AND l.bron NOT IN ('excel_import', 'demo')
      AND la.assigned_at >= p_start;

    SELECT COUNT(*) INTO p_prev_assigned
    FROM lead_assignments la
    INNER JOIN leads l ON l.id = la.lead_id
    WHERE COALESCE(la.source, 'distribution') NOT IN ('bulk_export', 'demo')
      AND l.bron NOT IN ('excel_import', 'demo')
      AND la.assigned_at >= prev_start AND la.assigned_at < p_start;

    -- Omzet: betaalde batches aangemaakt in de periode + bulkverkoop.
    SELECT
      COALESCE((
        SELECT SUM(cb.total_price)
        FROM customer_batches cb
        WHERE cb.is_paid = true
          AND COALESCE(cb.status, '') <> 'cancelled'
          AND cb.total_price IS NOT NULL
          AND cb.created_at >= p_start
      ), 0)
      + COALESCE((
        SELECT SUM(c.bulk_price_per_lead)
        FROM lead_assignments la
        JOIN customers c ON c.id = la.customer_id
        WHERE la.batch_id IS NULL
          AND c.bulk_price_per_lead IS NOT NULL
          AND la.assigned_at >= p_start
      ), 0)
    INTO p_revenue;

    SELECT
      COALESCE((
        SELECT SUM(cb.total_price)
        FROM customer_batches cb
        WHERE cb.is_paid = true
          AND COALESCE(cb.status, '') <> 'cancelled'
          AND cb.total_price IS NOT NULL
          AND cb.created_at >= prev_start AND cb.created_at < p_start
      ), 0)
      + COALESCE((
        SELECT SUM(c.bulk_price_per_lead)
        FROM lead_assignments la
        JOIN customers c ON c.id = la.customer_id
        WHERE la.batch_id IS NULL
          AND c.bulk_price_per_lead IS NOT NULL
          AND la.assigned_at >= prev_start AND la.assigned_at < p_start
      ), 0)
    INTO p_prev_revenue;

    SELECT COALESCE(SUM(mas.spend), 0) INTO p_spend
    FROM meta_ad_spend mas
    WHERE mas.date >= p_start::date
      AND COALESCE(mas.campaign_name, '') !~* '\mpakketadvies\M'
      AND COALESCE(mas.campaign_name, '') !~* '\menergie\M';

    SELECT COALESCE(SUM(mas.spend), 0) INTO p_prev_spend
    FROM meta_ad_spend mas
    WHERE mas.date >= prev_start::date AND mas.date < p_start::date
      AND COALESCE(mas.campaign_name, '') !~* '\mpakketadvies\M'
      AND COALESCE(mas.campaign_name, '') !~* '\menergie\M';

    result := result || jsonb_build_object(
      p.key, jsonb_build_object(
        'leads', p_leads,
        'prev_leads', p_prev_leads,
        'assigned', p_assigned,
        'prev_assigned', p_prev_assigned,
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
