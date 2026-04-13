-- 1. Add bulk pricing column to customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS bulk_price_per_lead numeric(10,2) DEFAULT NULL;

-- 2. Rewrite live_revenue_stats() to:
--    - Use leads_delivered × price_per_lead for batch revenue (ground truth)
--    - Calculate bulk revenue from NULL-batch assignments × customer bulk price
--    - Only count batch-linked assignments for avg toewijzingen / eff. CPL
CREATE OR REPLACE FUNCTION live_revenue_stats()
RETURNS jsonb
LANGUAGE sql STABLE
AS $$
  SELECT jsonb_build_object(
    'batch_revenue', COALESCE((
      SELECT SUM(cb.leads_delivered * cb.price_per_lead)
      FROM customer_batches cb
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
