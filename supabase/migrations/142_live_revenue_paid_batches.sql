-- ============================================================================
-- 142 — Live-omzet baseren op daadwerkelijk betaalde batches
--
-- De live-omzet (`live_revenue_stats`) telde `batch_revenue` op basis van
-- status IN ('active','completed'). Dat klopte niet:
--   * Een betaalde batch die op `paused` staat is gewoon omzet (klant heeft
--     betaald), maar viel uit de teller -> omzet daalde zonder dat er geld weg
--     was.
--   * Een batch in `pending_payment` is juist nog NIET betaald, maar zou bij
--     een statuswissel ten onrechte kunnen meetellen.
--
-- Batches worden altijd volledig vooraf betaald en gaan daarna pas draaien.
-- "Omzet" = wat de klant betaald heeft = som van total_price waar is_paid = true
-- (cancelled uitgesloten). Dit is tevens stabiel: pauzeren verandert de omzet
-- niet meer; hij stijgt alleen als er een nieuwe betaling binnenkomt.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.live_revenue_stats()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
  SELECT jsonb_build_object(
    'batch_revenue', COALESCE((
      SELECT SUM(cb.total_price)
      FROM customer_batches cb
      WHERE cb.is_paid = true
        AND COALESCE(cb.status, '') <> 'cancelled'
        AND cb.total_price IS NOT NULL
    ), 0),
    'bulk_revenue', COALESCE((
      SELECT SUM(c.bulk_price_per_lead)
      FROM lead_assignments la
      JOIN customers c ON c.id = la.customer_id
      WHERE la.batch_id IS NULL
        AND c.bulk_price_per_lead IS NOT NULL
    ), 0),
    'total_assignments', COALESCE((
      SELECT COUNT(*)
      FROM lead_assignments la
      INNER JOIN leads l ON l.id = la.lead_id
      WHERE COALESCE(la.source, 'distribution') NOT IN ('bulk_export', 'demo')
        AND l.bron NOT IN ('excel_import', 'demo')
    ), 0),
    'unique_assigned_leads', COALESCE((
      SELECT COUNT(DISTINCT la.lead_id)
      FROM lead_assignments la
      INNER JOIN leads l ON l.id = la.lead_id
      WHERE COALESCE(la.source, 'distribution') NOT IN ('bulk_export', 'demo')
        AND l.bron NOT IN ('excel_import', 'demo')
    ), 0),
    'bulk_assignment_count', COALESCE((
      SELECT COUNT(*)
      FROM lead_assignments
      WHERE batch_id IS NULL
    ), 0)
  )
$function$;
