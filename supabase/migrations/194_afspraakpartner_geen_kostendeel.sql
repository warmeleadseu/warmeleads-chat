-- Afspraakpartners en interne klanten dragen geen leadkosten in de winst per batch.
--
-- Infinite Scale krijgt leads in zijn portaal om er afspraken van te maken.
-- Die afspraken tellen niet als omzet (net als alle afsprakenbatches en de
-- afspraakfacturen in Rompslomp). Tot nu toe telde Infinite Scale wel mee in
-- het aantal klanten per lead: een lead die naar Solaris Prime en Infinite
-- Scale ging, kostte Solaris de helft. Zo drukte een klant zonder omzet de
-- kosten van de betalende batches (samen ruim 8.000 euro sinds mei 2026).
--
-- Nu verdelen we de kosten van een lead alleen over de klanten die ervoor
-- betalen: niet over interne klanten (WarmeLeads.eu, Warme Leads
-- Afspraakleads) en niet over afspraakpartners. Een lead die alleen naar
-- zulke klanten ging, telt in het winstoverzicht onder "intern en afspraken".
-- Met terugwerkende kracht: de functies rekenen altijd over alle toewijzingen.

BEGIN;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS afspraakpartner boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN customers.afspraakpartner IS
  'Krijgt leads om afspraken van te maken (zoals Infinite Scale). Draagt geen leadkosten en staat niet in de winst per batch.';

UPDATE customers SET afspraakpartner = true
WHERE id IN ('5bb1dfc6-def7-4067-9723-e0713cc08c74', '490d3bc8-c975-4811-a3ee-4038ef65e821');

DROP FUNCTION IF EXISTS batch_winst_kosten(uuid[]);

CREATE FUNCTION batch_winst_kosten(p_batch_ids uuid[] DEFAULT NULL)
RETURNS TABLE (
  batch_id uuid, geleverd integer, kosten numeric, leads_zonder_kosten integer, gedeeld_gemiddeld numeric,
  leads_nog_niet_berekend integer, leads_lopende_week integer
)
LANGUAGE sql
STABLE
AS $$
  WITH a AS (
    SELECT la.lead_id, la.customer_id, la.batch_id,
           NOT (coalesce(c.intern, false) OR coalesce(c.afspraakpartner, false)) AS betaalt
    FROM lead_assignments la
    LEFT JOIN customers c ON c.id = la.customer_id
    WHERE coalesce(la.source, '') NOT IN ('mirror', 'demo')
  ),
  k AS (
    SELECT lead_id, count(DISTINCT customer_id) FILTER (WHERE betaalt) AS klanten
    FROM a GROUP BY 1
  ),
  week AS (
    SELECT date_trunc('week', now() AT TIME ZONE 'Europe/Amsterdam')::date AS start
  )
  SELECT
    a.batch_id,
    count(*)::integer,
    coalesce(sum(CASE WHEN a.betaalt THEN coalesce(lk.kosten, 0) / k.klanten ELSE 0 END), 0)::numeric,
    count(*) FILTER (
      WHERE lk.lead_id IS NOT NULL AND lk.bron <> 'meta'
        AND NOT (lk.bron = 'geen_uitgaven' AND lk.dag >= week.start)
    )::integer,
    round(avg(k.klanten) FILTER (WHERE a.betaalt), 2),
    count(*) FILTER (
      WHERE lk.lead_id IS NULL OR (lk.bron = 'geen_uitgaven' AND lk.dag >= week.start)
    )::integer,
    count(*) FILTER (WHERE lk.lead_id IS NULL OR lk.dag >= week.start)::integer
  FROM a
  JOIN k USING (lead_id)
  CROSS JOIN week
  LEFT JOIN lead_kosten lk USING (lead_id)
  WHERE a.batch_id IS NOT NULL
    AND (p_batch_ids IS NULL OR a.batch_id = ANY (p_batch_ids))
  GROUP BY a.batch_id;
$$;

/* Waar het advertentiegeld heen ging, met dezelfde verdeling: alleen over
   betalende klanten. "intern" = leads die alleen naar interne klanten of
   afspraakpartners gingen. */
DROP FUNCTION IF EXISTS winst_lekkage(date, date);
CREATE FUNCTION winst_lekkage(p_van date, p_tot date)
RETURNS TABLE (uitgaven numeric, acquisitie numeric, aan_batches numeric, intern numeric, buiten_batch numeric, onverkocht numeric, rest numeric)
LANGUAGE sql
STABLE
AS $$
  WITH s AS (
    SELECT campaign_id, sum(spend) AS spend
    FROM meta_ad_spend
    WHERE date BETWEEN greatest(p_van, date '2026-05-01') AND p_tot
      AND coalesce(campaign_name, '') !~* '\m(pakketadvies|energie)\M'
    GROUP BY 1
  ),
  tot AS (
    SELECT
      coalesce(sum(spend), 0) AS uitgaven,
      coalesce(sum(spend) FILTER (WHERE NOT EXISTS (SELECT 1 FROM leads l WHERE l.meta_campaign_id = s.campaign_id)), 0) AS acquisitie
    FROM s
  ),
  lk AS (
    SELECT lead_id, kosten FROM lead_kosten WHERE dag BETWEEN p_van AND p_tot
  ),
  a AS (
    SELECT la.lead_id, la.customer_id, la.batch_id,
           NOT (coalesce(c.intern, false) OR coalesce(c.afspraakpartner, false)) AS betaalt
    FROM lead_assignments la
    JOIN lk USING (lead_id)
    LEFT JOIN customers c ON c.id = la.customer_id
    WHERE coalesce(la.source, '') NOT IN ('mirror', 'demo')
  ),
  k AS (SELECT lead_id, count(DISTINCT customer_id) FILTER (WHERE betaalt) AS n FROM a GROUP BY 1),
  verdeeld AS (
    SELECT
      coalesce(sum(lk.kosten / k.n) FILTER (WHERE a.betaalt AND a.batch_id IS NOT NULL), 0) AS aan_batches,
      coalesce(sum(lk.kosten / k.n) FILTER (WHERE a.betaalt AND a.batch_id IS NULL), 0) AS buiten_batch
    FROM a JOIN k USING (lead_id) JOIN lk USING (lead_id)
    WHERE k.n > 0
  ),
  intr AS (
    SELECT coalesce(sum(lk.kosten), 0) AS intern
    FROM lk JOIN k USING (lead_id) WHERE k.n = 0
  ),
  onv AS (
    SELECT coalesce(sum(lk.kosten), 0) AS onverkocht
    FROM lk WHERE NOT EXISTS (SELECT 1 FROM a WHERE a.lead_id = lk.lead_id)
  )
  SELECT
    round(tot.uitgaven, 2),
    round(tot.acquisitie, 2),
    round(verdeeld.aan_batches, 2),
    round(intr.intern, 2),
    round(verdeeld.buiten_batch, 2),
    round(onv.onverkocht, 2),
    round(tot.uitgaven - tot.acquisitie - verdeeld.aan_batches - intr.intern - verdeeld.buiten_batch - onv.onverkocht, 2)
  FROM tot, verdeeld, intr, onv;
$$;

COMMIT;
