-- Winst en verlies: leads die als bestand naar een klant zijn geëxporteerd,
-- tellen niet meer als "onverkocht".
--
-- Afgesproken 10 nov 2026. Een export naar een klant (SGB, Solaris Prime,
-- Alpha ess) is een levering: die wordt als bulk gefactureerd en staat als
-- externe omzet in het overzicht. Toch telden die leads onder "Onverkochte
-- leads" (sinds mei 128 leads, ruim 2.250 euro), omdat winst_lekkage alleen
-- naar lead_assignments keek. De uitleg op de pagina zei al dat exports bij
-- "Leads buiten een batch" horen.
--
-- Nu, voor leads zonder betalende klant in lead_assignments:
--  - geëxporteerd naar een externe klant  -> buiten_batch;
--  - alleen geëxporteerd naar een interne klant -> intern;
--  - een export zonder klant blijft onverkocht.
-- Leads met een betalende klant blijven precies zo verdeeld als voorheen.
--
-- Terugdraaien: de functie uit migratie 194 opnieuw uitvoeren.

CREATE OR REPLACE FUNCTION winst_lekkage(p_van date, p_tot date)
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
  /* Exports met een klant, per lead: ging hij naar minstens één externe klant? */
  ex AS (
    SELECT x.lead_id, bool_or(NOT coalesce(c.intern, false)) AS extern
    FROM lead_exports e
    CROSS JOIN LATERAL unnest(e.lead_ids) AS x(lead_id)
    JOIN customers c ON c.id = e.customer_id
    WHERE x.lead_id IN (SELECT lead_id FROM lk)
    GROUP BY 1
  ),
  /* Leads zonder betalende klant in de toewijzingen (geen of alleen intern). */
  zonder AS (
    SELECT lk.lead_id, lk.kosten, (k.lead_id IS NOT NULL) AS toegewezen, ex.extern
    FROM lk
    LEFT JOIN k USING (lead_id)
    LEFT JOIN ex USING (lead_id)
    WHERE coalesce(k.n, 0) = 0
  ),
  verdeeld AS (
    SELECT
      coalesce(sum(lk.kosten / k.n) FILTER (WHERE a.betaalt AND a.batch_id IS NOT NULL), 0) AS aan_batches,
      coalesce(sum(lk.kosten / k.n) FILTER (WHERE a.betaalt AND a.batch_id IS NULL), 0) AS buiten_batch
    FROM a JOIN k USING (lead_id) JOIN lk USING (lead_id)
    WHERE k.n > 0
  ),
  rest_verdeeld AS (
    SELECT
      coalesce(sum(kosten) FILTER (WHERE extern IS TRUE), 0) AS export_extern,
      coalesce(sum(kosten) FILTER (WHERE extern IS NOT TRUE AND (toegewezen OR extern IS FALSE)), 0) AS intern,
      coalesce(sum(kosten) FILTER (WHERE extern IS NULL AND NOT toegewezen), 0) AS onverkocht
    FROM zonder
  )
  SELECT
    round(tot.uitgaven, 2),
    round(tot.acquisitie, 2),
    round(verdeeld.aan_batches, 2),
    round(rv.intern, 2),
    round(verdeeld.buiten_batch + rv.export_extern, 2),
    round(rv.onverkocht, 2),
    round(tot.uitgaven - tot.acquisitie - verdeeld.aan_batches - rv.intern - verdeeld.buiten_batch - rv.export_extern - rv.onverkocht, 2)
  FROM tot, verdeeld, rest_verdeeld rv;
$$;
