-- De CPL in Leads CRM (leads.lead_cost) komt voortaan uit dezelfde berekening
-- als de winst per batch (lead_kosten, per campagne per week).
--
-- De oude berekening in de Meta-sync deelde de uitgaven van de laatste 7
-- dagen door de leads van een veel langere periode per campagne; de CPL kwam
-- daardoor gemiddeld rond 3 euro uit, terwijl een lead ons rond 15 tot 20
-- euro kost.

BEGIN;

CREATE OR REPLACE FUNCTION herbereken_lead_kosten(p_vanaf date)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  aantal integer;
BEGIN
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
  SELECT count(*)::integer INTO aantal FROM bijgewerkt;

  /* CPL in Leads CRM gelijktrekken; alleen waar hij verandert. Vóór de
     boekhoudstart blijft de oude waarde staan. */
  UPDATE leads AS ld
  SET lead_cost = CASE WHEN lk.bron = 'meta' THEN round(lk.kosten, 2) ELSE NULL END
  FROM lead_kosten lk
  WHERE lk.lead_id = ld.id
    AND lk.bron <> 'voor_boekhoudstart'
    AND lk.dag >= date_trunc('week', p_vanaf)::date
    AND ld.lead_cost IS DISTINCT FROM (CASE WHEN lk.bron = 'meta' THEN round(lk.kosten, 2) ELSE NULL END);

  RETURN aantal;
END;
$$;

COMMIT;
