CREATE OR REPLACE FUNCTION count_assignments_by_customer(customer_ids uuid[])
RETURNS TABLE(customer_id uuid, total_count bigint, bulk_count bigint)
LANGUAGE sql STABLE
AS $$
  SELECT
    la.customer_id,
    COUNT(*)::bigint AS total_count,
    COUNT(*) FILTER (WHERE la.batch_id IS NULL)::bigint AS bulk_count
  FROM lead_assignments la
  WHERE la.customer_id = ANY(customer_ids)
  GROUP BY la.customer_id;
$$;
