-- Winst per batch.
--
-- 1. lead_kosten: wat elke lead aan advertentiegeld kostte. Per campagne per
--    week (maandag t/m zondag): de uitgaven van die week gedeeld door het
--    aantal leads dat die campagne die week bij ons opleverde (ook nepnummers
--    en dubbele: die kosten evengoed geld). Per dag bleef 14.000 euro liggen op
--    dagen dat een campagne uitgaf maar die dag toevallig geen lead opleverde;
--    per week is dat 1.700 euro. Volgt de afspraken uit metaCpl.ts: uitgaven tellen vanaf
--    1 mei 2026, en campagnes met het losse woord "pakketadvies" of "energie"
--    in de naam horen niet bij dit CRM.
-- 2. batch_winst_kosten(): per batch het aantal geleverde leads en de
--    toegerekende kosten. Een lead die naar drie klanten ging, telt voor elke
--    batch voor een derde.
-- 3. Twee velden voor batches die buiten het systeem om zijn gefactureerd.

BEGIN;

CREATE TABLE IF NOT EXISTS lead_kosten (
  lead_id     uuid PRIMARY KEY REFERENCES leads(id) ON DELETE CASCADE,
  campagne_id text,
  dag         date NOT NULL,
  kosten      numeric(12,4) NOT NULL DEFAULT 0,
  -- meta: berekend uit de uitgaven; geen_campagne: lead zonder campagne-id;
  -- geen_uitgaven: campagne had die week geen (meetellende) uitgaven;
  -- voor_boekhoudstart: vóór 1 mei 2026.
  bron        text NOT NULL CHECK (bron IN ('meta', 'geen_campagne', 'geen_uitgaven', 'voor_boekhoudstart')),
  berekend_op timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lead_kosten_dag_idx ON lead_kosten (dag);
ALTER TABLE lead_kosten ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE lead_kosten IS
  'Advertentiekosten per lead (uitgaven campagne/dag gedeeld door leads campagne/dag). Bijgewerkt door herbereken_lead_kosten().';

/* Herberekent de kosten van alle leads die vanaf p_vanaf binnenkwamen.
   Meta corrigeert uitgaven achteraf nog een paar dagen; daarom draait dit na
   elke spend-sync over de laatste 30 dagen (vanaf het begin van die week). */
CREATE OR REPLACE FUNCTION herbereken_lead_kosten(p_vanaf date)
RETURNS integer
LANGUAGE sql
AS $$
  WITH uitgaven AS (
    SELECT campaign_id, date_trunc('week', date)::date AS week, sum(spend) AS spend
    FROM meta_ad_spend
    WHERE date >= greatest(date_trunc('week', p_vanaf)::date, date '2026-05-01')
      AND coalesce(campaign_name, '') !~* '\m(pakketadvies|energie)\M'
    GROUP BY 1, 2
  ),
  l AS (
    SELECT id, meta_campaign_id, (created_at AT TIME ZONE 'Europe/Amsterdam')::date AS dag,
           date_trunc('week', (created_at AT TIME ZONE 'Europe/Amsterdam'))::date AS week
    FROM leads
    WHERE bron IS DISTINCT FROM 'demo'
      /* Vanaf het begin van de week van p_vanaf: een halve week zou de
         uitgaven van die week over te weinig leads verdelen. */
      AND created_at >= (date_trunc('week', p_vanaf)::timestamp AT TIME ZONE 'Europe/Amsterdam')
  ),
  n AS (
    SELECT meta_campaign_id, week, count(*) AS aantal
    FROM l WHERE meta_campaign_id IS NOT NULL
    GROUP BY 1, 2
  ),
  bijgewerkt AS (
    INSERT INTO lead_kosten (lead_id, campagne_id, dag, kosten, bron, berekend_op)
    SELECT
      l.id,
      l.meta_campaign_id,
      l.dag,
      CASE WHEN l.dag < date '2026-05-01' THEN 0
           ELSE coalesce(u.spend / nullif(n.aantal, 0), 0) END,
      CASE WHEN l.dag < date '2026-05-01' THEN 'voor_boekhoudstart'
           WHEN l.meta_campaign_id IS NULL THEN 'geen_campagne'
           WHEN u.spend IS NULL THEN 'geen_uitgaven'
           ELSE 'meta' END,
      now()
    FROM l
    LEFT JOIN n ON n.meta_campaign_id = l.meta_campaign_id AND n.week = l.week
    LEFT JOIN uitgaven u ON u.campaign_id = l.meta_campaign_id AND u.week = l.week
    ON CONFLICT (lead_id) DO UPDATE SET
      campagne_id = EXCLUDED.campagne_id,
      dag = EXCLUDED.dag,
      kosten = EXCLUDED.kosten,
      bron = EXCLUDED.bron,
      berekend_op = EXCLUDED.berekend_op
    RETURNING 1
  )
  SELECT count(*)::integer FROM bijgewerkt;
$$;

/* Per batch: geleverde leads en toegerekende kosten. Spiegel- en
   demotoewijzingen tellen niet; het aantal klanten per lead wel. */
CREATE OR REPLACE FUNCTION batch_winst_kosten(p_batch_ids uuid[] DEFAULT NULL)
RETURNS TABLE (batch_id uuid, geleverd integer, kosten numeric, leads_zonder_kosten integer, gedeeld_gemiddeld numeric)
LANGUAGE sql
STABLE
AS $$
  WITH a AS (
    SELECT lead_id, customer_id, batch_id
    FROM lead_assignments
    WHERE coalesce(source, '') NOT IN ('mirror', 'demo')
  ),
  k AS (
    SELECT lead_id, count(DISTINCT customer_id) AS klanten
    FROM a GROUP BY 1
  )
  SELECT
    a.batch_id,
    count(*)::integer,
    coalesce(sum(coalesce(lk.kosten, 0) / k.klanten), 0)::numeric,
    count(*) FILTER (WHERE lk.lead_id IS NULL OR lk.bron <> 'meta')::integer,
    round(avg(k.klanten), 2)
  FROM a
  JOIN k USING (lead_id)
  LEFT JOIN lead_kosten lk USING (lead_id)
  WHERE a.batch_id IS NOT NULL
    AND (p_batch_ids IS NULL OR a.batch_id = ANY (p_batch_ids))
  GROUP BY a.batch_id;
$$;

/* Waar het advertentiegeld van een periode heen ging. Telt op tot de totale
   (meetellende) uitgaven: acquisitie (campagnes die nooit een lead bij ons
   opleverden, zoals de partnercampagnes die nieuwe klanten werven), kosten
   van leads in batches, van leads buiten een batch om (bulk), van onverkochte
   leads, en wat overblijft (uitgaven zonder lead, en verschil door de
   weekverdeling aan de randen van de periode). */
CREATE OR REPLACE FUNCTION winst_lekkage(p_van date, p_tot date)
RETURNS TABLE (uitgaven numeric, acquisitie numeric, aan_batches numeric, buiten_batch numeric, onverkocht numeric, rest numeric)
LANGUAGE sql
STABLE
AS $
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
    SELECT la.lead_id, la.customer_id, la.batch_id
    FROM lead_assignments la
    JOIN lk USING (lead_id)
    WHERE coalesce(la.source, '') NOT IN ('mirror', 'demo')
  ),
  k AS (SELECT lead_id, count(DISTINCT customer_id) AS n FROM a GROUP BY 1),
  verdeeld AS (
    SELECT
      coalesce(sum(lk.kosten / k.n) FILTER (WHERE a.batch_id IS NOT NULL), 0) AS aan_batches,
      coalesce(sum(lk.kosten / k.n) FILTER (WHERE a.batch_id IS NULL), 0) AS buiten_batch
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
    round(verdeeld.buiten_batch, 2),
    round(onv.onverkocht, 2),
    round(tot.uitgaven - tot.acquisitie - verdeeld.aan_batches - verdeeld.buiten_batch - onv.onverkocht, 2)
  FROM tot, verdeeld, onv;
$;

ALTER TABLE customer_batches
  ADD COLUMN IF NOT EXISTS extern_factuurnummer text,
  ADD COLUMN IF NOT EXISTS extern_bedrag_excl numeric(12,2)
    CHECK (extern_bedrag_excl IS NULL OR extern_bedrag_excl >= 0);

COMMENT ON COLUMN customer_batches.extern_bedrag_excl IS
  'Gefactureerd bedrag excl. btw als de factuur buiten het systeem om ging. Leeg: de batchprijs geldt.';

COMMIT;
