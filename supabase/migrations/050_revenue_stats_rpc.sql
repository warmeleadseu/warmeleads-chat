-- RPC to calculate revenue & assignment stats directly in PostgreSQL,
-- avoiding the default 1000-row fetch limit of PostgREST.
CREATE OR REPLACE FUNCTION live_revenue_stats()
RETURNS jsonb
LANGUAGE sql STABLE
AS $$
  SELECT jsonb_build_object(
    'total_revenue', COALESCE((
      SELECT SUM(cb.price_per_lead)
      FROM lead_assignments la
      JOIN customer_batches cb ON cb.id = la.batch_id
      WHERE la.batch_id IS NOT NULL
    ), 0),
    'total_assignments', (SELECT COUNT(*) FROM lead_assignments),
    'unique_assigned_leads', (SELECT COUNT(DISTINCT lead_id) FROM lead_assignments)
  )
$$;
