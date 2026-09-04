-- Correctie op migratie 157: `reconcile_batch_delivered()` mag uitsluitend
-- ACTIEVE batches aanraken, en nooit een afgesloten batch heropenen.
--
-- WAAROM
-- ------
-- De eerste versie herrekende ook `completed` en `paused` batches. Bij de eerste
-- uitvoering op 4 september 2026 zette dat negen historische batches (zes van
-- Mediabink, plus Van Dooren Stefan en nu-isoleren.be) terug op `active`, omdat
-- hun teller hoger stond dan het werkelijke aantal unieke leads. Die batches
-- waren maanden eerder bewust afgesloten en konden daardoor opnieuw verse leads
-- opsnoepen. Er is niets weggelekt (nul toewijzingen in dat venster) en de oude
-- waarden zijn meteen teruggezet, maar de functie moet dit nooit meer kunnen.
--
-- De les: een teller die afwijkt op een afgesloten batch is boekhouding uit het
-- verleden en geen reden om die batch weer open te zetten. Alleen een batch die
-- nú leads ontvangt, mag worden bijgewerkt — en dan uitsluitend de kant op die
-- veilig is: dichter bij de waarheid, en zo nodig dicht.

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
      COALESCE(cb.leads_delivered_external, 0) AS extern,
      COALESCE(cb.delivery_model, 'capped') AS model,
      (
        SELECT COUNT(DISTINCT la.lead_id)::integer
        FROM lead_assignments la
        WHERE la.batch_id = cb.id
      ) AS distinct_leads
    FROM customer_batches cb
    -- Alleen actieve batches. Afgesloten en gepauzeerde batches blijven zoals
    -- ze zijn; die worden nooit heropend en hun teller blijft ongemoeid.
    WHERE cb.status = 'active'
  ),
  doel AS (
    SELECT
      w.*,
      (w.distinct_leads + w.extern) AS geleverd,
      CASE
        WHEN w.model = 'capped'
             AND (w.distinct_leads + w.extern) >= w.batch_size THEN 'completed'
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
        ELSE cb.completed_at
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
  'Trekt leads_delivered van ACTIEVE batches gelijk met het werkelijke aantal '
  'unieke toegewezen leads en sluit volle batches. Raakt completed/paused nooit '
  'aan en heropent niets. Draait elke ronde vanuit /api/cron/distribute.';
