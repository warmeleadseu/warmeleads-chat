-- Klantkaart lead_count: ook leads met leads.customer_id meenemen
-- die (nog) geen lead_assignments-rij hebben (legacy / handmatige toewijzing).
CREATE OR REPLACE FUNCTION count_assignments_by_customer(customer_ids uuid[])
RETURNS TABLE(customer_id uuid, total_count bigint, bulk_count bigint)
LANGUAGE sql STABLE
AS $$
  WITH assignment_counts AS (
    SELECT
      la.customer_id,
      COUNT(*)::bigint AS total_count,
      COUNT(*) FILTER (WHERE la.batch_id IS NULL)::bigint AS bulk_count
    FROM lead_assignments la
    WHERE la.customer_id = ANY(customer_ids)
    GROUP BY la.customer_id
  ),
  orphan_counts AS (
    SELECT
      l.customer_id,
      COUNT(*)::bigint AS orphan_count
    FROM leads l
    WHERE l.customer_id = ANY(customer_ids)
      AND NOT EXISTS (
        SELECT 1
        FROM lead_assignments la
        WHERE la.lead_id = l.id
          AND la.customer_id = l.customer_id
      )
    GROUP BY l.customer_id
  )
  SELECT
    COALESCE(a.customer_id, o.customer_id) AS customer_id,
    (COALESCE(a.total_count, 0) + COALESCE(o.orphan_count, 0))::bigint AS total_count,
    (COALESCE(a.bulk_count, 0) + COALESCE(o.orphan_count, 0))::bigint AS bulk_count
  FROM assignment_counts a
  FULL OUTER JOIN orphan_counts o ON a.customer_id = o.customer_id;
$$;
