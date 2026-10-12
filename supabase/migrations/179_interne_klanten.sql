-- Interne klanten: klanten die WarmeLeads zelf is, zoals het masterportaal
-- (WarmeLeads.eu) en de batch die leads verzamelt voor afspraken (Warme Leads
-- Afspraakleads). Hun batches zijn geen omzet van buiten: in de winst per
-- batch tellen ze niet als omzet, hun leadkosten staan apart.
--
-- Aanleiding: "Warme Leads Afspraakleads" had een factuur van 2.400 euro
-- die in de winst per batch als omzet meetelde.

BEGIN;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS intern boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN customers.intern IS
  'Klant is WarmeLeads zelf (masterportaal, afsprakenverzameling). Telt niet als omzet in de winst per batch.';

UPDATE customers SET intern = true
WHERE id IN ('c427431f-ac33-43cd-be22-43b46cb7b0bd', 'e40bae10-e7f5-4824-a40f-b2937878170e');

/* Waar het advertentiegeld heen ging: de kosten van leads in batches van
   interne klanten apart, zodat "leads in batches" alleen echte verkoop is. */
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
    SELECT la.lead_id, la.customer_id, la.batch_id, coalesce(c.intern, false) AS intern
    FROM lead_assignments la
    JOIN lk USING (lead_id)
    LEFT JOIN customers c ON c.id = la.customer_id
    WHERE coalesce(la.source, '') NOT IN ('mirror', 'demo')
  ),
  k AS (SELECT lead_id, count(DISTINCT customer_id) AS n FROM a GROUP BY 1),
  verdeeld AS (
    SELECT
      coalesce(sum(lk.kosten / k.n) FILTER (WHERE a.batch_id IS NOT NULL AND NOT a.intern), 0) AS aan_batches,
      coalesce(sum(lk.kosten / k.n) FILTER (WHERE a.intern), 0) AS intern,
      coalesce(sum(lk.kosten / k.n) FILTER (WHERE a.batch_id IS NULL AND NOT a.intern), 0) AS buiten_batch
    FROM a JOIN k USING (lead_id) JOIN lk USING (lead_id)
  ),
  onv AS (
    SELECT coalesce(sum(lk.kosten), 0) AS onverkocht
    FROM lk WHERE NOT EXISTS (SELECT 1 FROM a WHERE a.lead_id = lk.lead_id)
  )
  SELECT
    round(tot.uitgaven, 2),
    round(tot.acquisitie, 2),
    round(verdeeld.aan_batches, 2),
    round(verdeeld.intern, 2),
    round(verdeeld.buiten_batch, 2),
    round(onv.onverkocht, 2),
    round(tot.uitgaven - tot.acquisitie - verdeeld.aan_batches - verdeeld.intern - verdeeld.buiten_batch - onv.onverkocht, 2)
  FROM tot, verdeeld, onv;
$$;

COMMIT;
