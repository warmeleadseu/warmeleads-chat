-- Integriteit van de leadverdeling: zelfherstel voor batches waarvan de
-- geleverd-teller afwijkt of die vol zijn maar nog openstaan.
--
-- AANLEIDING (incident 16 augustus – 4 september 2026)
-- ----------------------------------------------------
-- Op 14 augustus ontstond door een race één dubbele rij in `lead_assignments`
-- (zelfde lead, zelfde batch, zelfde tijdstempel). Vanaf dat moment liepen twee
-- tellingen uit elkaar:
--   * `customer_batches.leads_delivered` telde DISTINCT lead_id  -> 99
--   * de veiligheidscheck in `distributeLead` telde rijen        -> 100
-- Bij een batch_size van 100 betekende dat: "nog ruimte" volgens de teller,
-- "vol" volgens de check. De batch bleef actief, won bij elke lead de sortering
-- (provinciedekking Zuid-Holland, Noord-Holland, Noord-Brabant, Flevoland,
-- Gelderland en Groningen) en werd daarna geweigerd. Omdat er per lead maar één
-- kandidaat werd geprobeerd, viel de lead volledig op de grond. Negentien dagen
-- lang werd in die zes provincies vrijwel niets meer geleverd.
--
-- De code telt nu overal DISTINCT leads (src/lib/batchDelivered.ts) en probeert
-- bij afwijzing de volgende kandidaat. Deze migratie voegt de derde laag toe:
-- een afwijkende teller herstelt zichzelf, elke cronronde, vóór de verdeling.

CREATE OR REPLACE FUNCTION reconcile_batch_delivered()
RETURNS TABLE(
  batch_id uuid,
  oude_teller integer,
  nieuwe_teller integer,
  oude_status text,
  nieuwe_status text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH werkelijk AS (
    SELECT
      cb.id,
      cb.leads_delivered AS teller,
      cb.status,
      cb.batch_size,
      cb.is_paid,
      COALESCE(cb.leads_delivered_external, 0) AS extern,
      COALESCE(cb.delivery_model, 'capped') AS model,
      (
        SELECT COUNT(DISTINCT la.lead_id)::integer
        FROM lead_assignments la
        WHERE la.batch_id = cb.id
      ) AS distinct_leads
    FROM customer_batches cb
    WHERE cb.status IN ('active', 'paused', 'completed')
  ),
  doel AS (
    SELECT
      w.*,
      (w.distinct_leads + w.extern) AS geleverd,
      CASE
        WHEN w.model <> 'capped' THEN w.status
        WHEN (w.distinct_leads + w.extern) >= w.batch_size
             AND w.status IN ('active', 'paused') THEN 'completed'
        WHEN (w.distinct_leads + w.extern) < w.batch_size
             AND w.status = 'completed' THEN
               CASE WHEN w.is_paid THEN 'active' ELSE 'pending_payment' END
        ELSE w.status
      END AS gewenste_status
    FROM werkelijk w
  ),
  bijgewerkt AS (
    UPDATE customer_batches cb
    SET
      leads_delivered = d.geleverd,
      status = d.gewenste_status,
      completed_at = CASE
        WHEN d.gewenste_status = 'completed' THEN COALESCE(cb.completed_at, now())
        ELSE NULL
      END
    FROM doel d
    WHERE cb.id = d.id
      AND (cb.leads_delivered IS DISTINCT FROM d.geleverd
           OR cb.status IS DISTINCT FROM d.gewenste_status)
    RETURNING cb.id AS id, d.teller AS teller, d.geleverd AS geleverd,
              d.status AS status, d.gewenste_status AS gewenste_status
  )
  SELECT b.id, b.teller, b.geleverd, b.status, b.gewenste_status
  FROM bijgewerkt b;
END;
$$;

COMMENT ON FUNCTION reconcile_batch_delivered() IS
  'Trekt customer_batches.leads_delivered gelijk met het werkelijke aantal unieke '
  'toegewezen leads en sluit volle batches. Draait elke ronde vanuit '
  '/api/cron/distribute. Zie migratie 157 voor de aanleiding.';
