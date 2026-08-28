-- ============================================================================
-- 155 — Eerlijke kosten- en winstboekhouding vanaf 1 mei 2026
--
-- Afspraak (28 augustus 2026): alle Meta-advertentiekosten tellen mee vanaf
-- 1 mei 2026, met als enige uitzondering campagnes met het losse woord
-- "pakketadvies" of "energie" in de titel. De oude berekeningen telden alleen
-- spend op campagnes waar minstens één lead met attributie aan hing; 73% van
-- de leads komt zonder campagne-id binnen, waardoor tienduizenden euro's
-- spend onzichtbaar bleven en de CPL veel te laag uitviel.
--
-- Woordgrens (\m ... \M) is bewust: "Energie Zakelijk" valt eruit, maar
-- "Warmtepomp | Energiekompas - Almelo" (klantnaam) telt gewoon mee.
--
-- De TypeScript-kant van dezelfde definitie staat in src/lib/metaCpl.ts.
-- Wijzig je het hier, wijzig het dan ook daar.
-- ============================================================================

-- ── 1. Omzetstatistieken met een venster, zodat winst = omzet − kosten over
--       dezelfde periode gaat. p_since = NULL geeft het oude alles-gedrag. ──

CREATE OR REPLACE FUNCTION public.live_revenue_stats_since(p_since timestamptz DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
  SELECT jsonb_build_object(
    'batch_revenue', COALESCE((
      SELECT SUM(cb.total_price)
      FROM customer_batches cb
      WHERE cb.is_paid = true
        AND COALESCE(cb.status, '') <> 'cancelled'
        AND cb.total_price IS NOT NULL
        AND (p_since IS NULL OR cb.created_at >= p_since)
    ), 0),
    'bulk_revenue', COALESCE((
      SELECT SUM(c.bulk_price_per_lead)
      FROM lead_assignments la
      JOIN customers c ON c.id = la.customer_id
      WHERE la.batch_id IS NULL
        AND c.bulk_price_per_lead IS NOT NULL
        AND (p_since IS NULL OR la.assigned_at >= p_since)
    ), 0),
    'total_assignments', COALESCE((
      SELECT COUNT(*)
      FROM lead_assignments la
      INNER JOIN leads l ON l.id = la.lead_id
      WHERE COALESCE(la.source, 'distribution') NOT IN ('bulk_export', 'demo')
        AND l.bron NOT IN ('excel_import', 'demo')
        AND (p_since IS NULL OR la.assigned_at >= p_since)
    ), 0),
    'unique_assigned_leads', COALESCE((
      SELECT COUNT(DISTINCT la.lead_id)
      FROM lead_assignments la
      INNER JOIN leads l ON l.id = la.lead_id
      WHERE COALESCE(la.source, 'distribution') NOT IN ('bulk_export', 'demo')
        AND l.bron NOT IN ('excel_import', 'demo')
        AND (p_since IS NULL OR la.assigned_at >= p_since)
    ), 0),
    'bulk_assignment_count', COALESCE((
      SELECT COUNT(*)
      FROM lead_assignments
      WHERE batch_id IS NULL
        AND (p_since IS NULL OR assigned_at >= p_since)
    ), 0)
  )
$function$;

-- ── 2. Periodestatistieken (dag/3 dagen/week/maand/kwartaal/jaar) ──
--
-- Alle metrieken worden op de boekhoudstart begrensd: een jaar- of
-- kwartaalvenster dat vóór 1 mei 2026 begint, telt pas vanaf 1 mei. Zo gaan
-- leads, uitdelingen, omzet en kosten binnen elke periode over hetzelfde
-- venster en kan "maand" nooit meer lager uitkomen dan "week".
--
-- De spend-clausule telt nu ALLE campagnes (minus de uitgesloten woorden);
-- de oude koppeling aan leads-met-attributie en de branch-startdatum zijn
-- bewust verdwenen.

CREATE OR REPLACE FUNCTION period_profit_stats()
RETURNS jsonb
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  p record;
  p_start timestamptz;
  prev_start timestamptz;
  -- UTC-middernacht, exact gelijk aan META_SPEND_START_ISO in src/lib/metaCpl.ts;
  -- p_start::date levert dan precies 2026-05-01 op voor de spend-vergelijking.
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

    -- Boekhouding begint op 1 mei 2026; eerdere delen van het venster
    -- tellen nergens in mee.
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

    SELECT COALESCE(SUM(
      CASE
        WHEN la.batch_id IS NOT NULL THEN cb.price_per_lead
        ELSE c.bulk_price_per_lead
      END
    ), 0) INTO p_revenue
    FROM lead_assignments la
    LEFT JOIN customer_batches cb ON cb.id = la.batch_id
    LEFT JOIN customers c ON c.id = la.customer_id
    WHERE la.assigned_at >= p_start
      AND (
        (la.batch_id IS NOT NULL AND cb.price_per_lead IS NOT NULL)
        OR (la.batch_id IS NULL AND c.bulk_price_per_lead IS NOT NULL)
      );

    SELECT COALESCE(SUM(
      CASE
        WHEN la.batch_id IS NOT NULL THEN cb.price_per_lead
        ELSE c.bulk_price_per_lead
      END
    ), 0) INTO p_prev_revenue
    FROM lead_assignments la
    LEFT JOIN customer_batches cb ON cb.id = la.batch_id
    LEFT JOIN customers c ON c.id = la.customer_id
    WHERE la.assigned_at >= prev_start AND la.assigned_at < p_start
      AND (
        (la.batch_id IS NOT NULL AND cb.price_per_lead IS NOT NULL)
        OR (la.batch_id IS NULL AND c.bulk_price_per_lead IS NOT NULL)
      );

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
