-- Winst per batch: "nog niet berekend" apart van "echt geen kosten".
--
-- De kosten per lead (lead_kosten) worden bij elke Meta-sync herberekend. Een
-- lead die na de laatste sync binnenkwam, had nog geen rij en telde als "zonder
-- bekende kosten (geen campagne of vóór 1 mei)", met 0 euro kosten. Op 4 nov
-- 2026 stonden zo 's avonds 9 leads van Solaris Prime op 0 euro, terwijl ze
-- gewoon uit een Meta-campagne kwamen.
--
-- Nu per batch drie tellingen:
-- - leads_zonder_kosten: echt geen advertentiekosten (geen campagne, zoals een
--   Excel-import of handmatige lead; campagne zonder uitgaven; vóór 1 mei).
-- - leads_nog_niet_berekend: nog geen kosten berekend (binnen sinds de laatste
--   sync), of een campagne waarvan deze week nog geen uitgaven binnen zijn.
-- - leads_lopende_week: leads uit de lopende week (maandag t/m zondag). Hun
--   kosten verschuiven nog: de weekuitgaven worden gedeeld door alle leads van
--   die week.
-- De berekening van de kosten zelf verandert niet.

BEGIN;

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
    SELECT lead_id, customer_id, batch_id
    FROM lead_assignments
    WHERE coalesce(source, '') NOT IN ('mirror', 'demo')
  ),
  k AS (
    SELECT lead_id, count(DISTINCT customer_id) AS klanten
    FROM a GROUP BY 1
  ),
  week AS (
    SELECT date_trunc('week', now() AT TIME ZONE 'Europe/Amsterdam')::date AS start
  )
  SELECT
    a.batch_id,
    count(*)::integer,
    coalesce(sum(coalesce(lk.kosten, 0) / k.klanten), 0)::numeric,
    count(*) FILTER (
      WHERE lk.lead_id IS NOT NULL AND lk.bron <> 'meta'
        AND NOT (lk.bron = 'geen_uitgaven' AND lk.dag >= week.start)
    )::integer,
    round(avg(k.klanten), 2),
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

COMMIT;
