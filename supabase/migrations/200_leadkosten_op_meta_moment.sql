-- Kosten per lead op het moment dat de lead bij Meta binnenkwam, niet op het
-- moment dat hij bij ons werd ingeladen.
--
-- Afgesproken 10 nov 2026. De inhaalslag (cron meta-inhaalslag) laadt leads
-- die Meta wel had en wij niet, soms weken later. Die leads kregen created_at =
-- het moment van inladen, en daarmee de kosten van de verkeerde week: in
-- september kwamen sommige weken op 143 euro per lead uit en andere op 10
-- euro. Over alle weken samen klopte het bedrag wel.
--
-- Nieuw: leads.meta_aangemaakt_op, het tijdstip waarop de lead bij Meta
-- binnenkwam. De inhaalslag vult het in (ook achteraf voor wat hij al eerder
-- inlaadde). herbereken_lead_kosten gebruikt het waar het er is. created_at
-- blijft ongewijzigd en stuurt nog steeds de verdeling.
--
-- Terugdraaien: de functie uit migratie 176 opnieuw uitvoeren; de kolom mag
-- blijven staan.

ALTER TABLE leads ADD COLUMN IF NOT EXISTS meta_aangemaakt_op timestamptz;
COMMENT ON COLUMN leads.meta_aangemaakt_op IS
  'Wanneer de lead bij Meta binnenkwam, als dat afwijkt van created_at (inhaalslag). Bepaalt de week voor de leadkosten.';

CREATE OR REPLACE FUNCTION public.herbereken_lead_kosten(p_vanaf date)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
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
    SELECT id, meta_campaign_id, (coalesce(meta_aangemaakt_op, created_at) AT TIME ZONE 'Europe/Amsterdam')::date AS dag,
           date_trunc('week', (coalesce(meta_aangemaakt_op, created_at) AT TIME ZONE 'Europe/Amsterdam'))::date AS week
    FROM leads
    WHERE bron IS DISTINCT FROM 'demo'
      /* Vanaf het begin van de week van p_vanaf: een halve week zou de
         uitgaven van die week over te weinig leads verdelen. */
      AND coalesce(meta_aangemaakt_op, created_at) >= (date_trunc('week', p_vanaf)::timestamp AT TIME ZONE 'Europe/Amsterdam')
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
$function$
;
