-- Unify the revenue model: switch live_revenue_stats() from
-- leads_delivered * price_per_lead (batch-level counter) to
-- counting individual lead_assignment rows (same model as period_profit_stats).
--
-- This fixes the discrepancy where the hero KPI showed different revenue
-- than the year period card, because leads_delivered on some batches was
-- higher than the actual number of lead_assignment rows.

CREATE OR REPLACE FUNCTION live_revenue_stats()
RETURNS jsonb
LANGUAGE sql STABLE
AS $$
  SELECT jsonb_build_object(
    'batch_revenue', COALESCE((
      SELECT SUM(cb.price_per_lead)
      FROM lead_assignments la
      JOIN customer_batches cb ON cb.id = la.batch_id
      WHERE cb.status IN ('active', 'completed')
        AND cb.price_per_lead IS NOT NULL
    ), 0),
    'bulk_revenue', COALESCE((
      SELECT SUM(c.bulk_price_per_lead)
      FROM lead_assignments la
      JOIN customers c ON c.id = la.customer_id
      WHERE la.batch_id IS NULL
        AND c.bulk_price_per_lead IS NOT NULL
    ), 0),
    'total_assignments', (
      SELECT COUNT(*)
      FROM lead_assignments
      WHERE batch_id IS NOT NULL
    ),
    'unique_assigned_leads', (
      SELECT COUNT(DISTINCT lead_id)
      FROM lead_assignments
      WHERE batch_id IS NOT NULL
    ),
    'bulk_assignment_count', (
      SELECT COUNT(*)
      FROM lead_assignments
      WHERE batch_id IS NULL
    )
  )
$$;
