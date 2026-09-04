-- ============================================================================
-- 159 — Omzettegels: echte 24 uur, en een batch zonder totaalprijs telt mee
--
-- Twee gebreken in `period_profit_stats` (migratie 156):
--
-- 1. De tegel heet "Omzet laatste 24 uur", maar de sleutel `day` gebruikte
--    `date_trunc('day', now())`: alles sinds middernacht. Een batch die
--    gisteravond om 20:00 werd aangemaakt viel daar buiten, terwijl hij wel
--    binnen de laatste 24 uur valt. Voor de gebruiker leek de omzet dan
--    simpelweg niet opgeteld. `day` is nu een echt rollend venster van 24 uur,
--    en de vorige periode de 24 uur daarvóór. Zelfde voor het aantal leads en
--    de advertentiekosten, zodat de tegels onderling blijven kloppen.
--
-- 2. De omzet telde uitsluitend `total_price`. Handmatig in de admin
--    aangemaakte batches kregen dat veld niet altijd, waardoor betaalde
--    batches voor nul euro meetelden (drie van infinite-scale, één van
--    groenvolt in de tien dagen vóór deze migratie). Er wordt nu teruggevallen
--    op `price_per_lead * batch_size`. De aanmaakroute vult de prijs voortaan
--    zelf uit de staffel (src/lib/batchPricing.ts), dus dit is het vangnet
--    voor bestaande rijen en voor imports die de kolom overslaan.
--
-- Advertentiekosten staan per kalenderdag in `meta_ad_spend`. Voor het
-- rollende dagvenster nemen we vandaag plus gisteren naar rato van het
-- verstreken deel van de dag, zodat winst = omzet - kosten niet scheeftrekt.
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
  prev_end timestamptz;
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
      -- Rollend venster: de tegel belooft "laatste 24 uur", dus dat leveren we.
      WHEN 'day' THEN
        p_start := now_ts - interval '24 hours';
        prev_start := now_ts - interval '48 hours';
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
    prev_end := p_start;

    SELECT COUNT(*) INTO p_leads
    FROM leads
    WHERE bron != 'excel_import' AND created_at >= p_start;

    SELECT COUNT(*) INTO p_prev_leads
    FROM leads
    WHERE bron != 'excel_import'
      AND created_at >= prev_start AND created_at < prev_end;

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
      AND la.assigned_at >= prev_start AND la.assigned_at < prev_end;

    -- Omzet: betaalde batches aangemaakt in de periode + bulkverkoop.
    -- Ontbreekt total_price, dan valt hij terug op prijs per lead maal omvang.
    SELECT
      COALESCE((
        SELECT SUM(COALESCE(cb.total_price, cb.price_per_lead * cb.batch_size))
        FROM customer_batches cb
        WHERE cb.is_paid = true
          AND COALESCE(cb.status, '') <> 'cancelled'
          AND COALESCE(cb.total_price, cb.price_per_lead * cb.batch_size) IS NOT NULL
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
        SELECT SUM(COALESCE(cb.total_price, cb.price_per_lead * cb.batch_size))
        FROM customer_batches cb
        WHERE cb.is_paid = true
          AND COALESCE(cb.status, '') <> 'cancelled'
          AND COALESCE(cb.total_price, cb.price_per_lead * cb.batch_size) IS NOT NULL
          AND cb.created_at >= prev_start AND cb.created_at < prev_end
      ), 0)
      + COALESCE((
        SELECT SUM(c.bulk_price_per_lead)
        FROM lead_assignments la
        JOIN customers c ON c.id = la.customer_id
        WHERE la.batch_id IS NULL
          AND c.bulk_price_per_lead IS NOT NULL
          AND la.assigned_at >= prev_start AND la.assigned_at < prev_end
      ), 0)
    INTO p_prev_revenue;

    -- Spend staat per kalenderdag. Bij het rollende dagvenster tellen we
    -- vandaag volledig plus het resterende deel van gisteren naar rato.
    IF p.key = 'day' THEN
      SELECT COALESCE(SUM(
        CASE
          WHEN mas.date = now_ts::date THEN mas.spend
          WHEN mas.date = (now_ts - interval '1 day')::date
            THEN mas.spend * (1 - EXTRACT(EPOCH FROM (now_ts - date_trunc('day', now_ts))) / 86400.0)
          ELSE 0
        END), 0) INTO p_spend
      FROM meta_ad_spend mas
      WHERE mas.date >= (now_ts - interval '1 day')::date
        AND COALESCE(mas.campaign_name, '') !~* '\mpakketadvies\M'
        AND COALESCE(mas.campaign_name, '') !~* '\menergie\M';

      SELECT COALESCE(SUM(
        CASE
          WHEN mas.date = (now_ts - interval '1 day')::date
            THEN mas.spend * (EXTRACT(EPOCH FROM (now_ts - date_trunc('day', now_ts))) / 86400.0)
          WHEN mas.date = (now_ts - interval '2 days')::date
            THEN mas.spend * (1 - EXTRACT(EPOCH FROM (now_ts - date_trunc('day', now_ts))) / 86400.0)
          ELSE 0
        END), 0) INTO p_prev_spend
      FROM meta_ad_spend mas
      WHERE mas.date >= (now_ts - interval '2 days')::date
        AND mas.date <= (now_ts - interval '1 day')::date
        AND COALESCE(mas.campaign_name, '') !~* '\mpakketadvies\M'
        AND COALESCE(mas.campaign_name, '') !~* '\menergie\M';
    ELSE
      SELECT COALESCE(SUM(mas.spend), 0) INTO p_spend
      FROM meta_ad_spend mas
      WHERE mas.date >= p_start::date
        AND COALESCE(mas.campaign_name, '') !~* '\mpakketadvies\M'
        AND COALESCE(mas.campaign_name, '') !~* '\menergie\M';

      SELECT COALESCE(SUM(mas.spend), 0) INTO p_prev_spend
      FROM meta_ad_spend mas
      WHERE mas.date >= prev_start::date AND mas.date < prev_end::date
        AND COALESCE(mas.campaign_name, '') !~* '\mpakketadvies\M'
        AND COALESCE(mas.campaign_name, '') !~* '\menergie\M';
    END IF;

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
