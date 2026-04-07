-- Fix: cast text date params to date type for wervingsdatum comparisons
CREATE OR REPLACE FUNCTION get_lead_facets(
  p_branches text[] DEFAULT NULL,
  p_customers text[] DEFAULT NULL,
  p_statuses text[] DEFAULT NULL,
  p_provinces text[] DEFAULT NULL,
  p_sources text[] DEFAULT NULL,
  p_phone_valid text DEFAULT NULL,
  p_date_from text DEFAULT NULL,
  p_date_to text DEFAULT NULL,
  p_search text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  sub_result jsonb;
BEGIN
  -- Branch facets (all filters EXCEPT branch)
  SELECT COALESCE(jsonb_object_agg(val, cnt), '{}'::jsonb) INTO sub_result
  FROM (
    SELECT branch AS val, count(*)::int AS cnt FROM leads
    WHERE branch IS NOT NULL AND branch != ''
      AND (p_customers IS NULL OR customer_id::text = ANY(p_customers))
      AND (p_statuses IS NULL OR status = ANY(p_statuses))
      AND (p_provinces IS NULL OR provincie = ANY(p_provinces))
      AND (p_sources IS NULL OR bron = ANY(p_sources))
      AND (p_phone_valid IS NULL
           OR (p_phone_valid = 'true' AND phone_valid = true)
           OR (p_phone_valid = 'false' AND phone_valid = false))
      AND (p_date_from IS NULL OR wervingsdatum >= p_date_from::date)
      AND (p_date_to IS NULL OR wervingsdatum <= p_date_to::date)
      AND (p_search IS NULL
           OR naam_klant ILIKE '%' || p_search || '%'
           OR email ILIKE '%' || p_search || '%'
           OR telefoonnummer ILIKE '%' || p_search || '%'
           OR postcode ILIKE '%' || p_search || '%')
    GROUP BY branch
  ) t;
  result := jsonb_set(result, '{branch}', sub_result);

  -- Customer facets (all filters EXCEPT customer_id)
  SELECT COALESCE(jsonb_object_agg(val, cnt), '{}'::jsonb) INTO sub_result
  FROM (
    SELECT customer_id::text AS val, count(*)::int AS cnt FROM leads
    WHERE customer_id IS NOT NULL
      AND (p_branches IS NULL OR branch = ANY(p_branches))
      AND (p_statuses IS NULL OR status = ANY(p_statuses))
      AND (p_provinces IS NULL OR provincie = ANY(p_provinces))
      AND (p_sources IS NULL OR bron = ANY(p_sources))
      AND (p_phone_valid IS NULL
           OR (p_phone_valid = 'true' AND phone_valid = true)
           OR (p_phone_valid = 'false' AND phone_valid = false))
      AND (p_date_from IS NULL OR wervingsdatum >= p_date_from::date)
      AND (p_date_to IS NULL OR wervingsdatum <= p_date_to::date)
      AND (p_search IS NULL
           OR naam_klant ILIKE '%' || p_search || '%'
           OR email ILIKE '%' || p_search || '%'
           OR telefoonnummer ILIKE '%' || p_search || '%'
           OR postcode ILIKE '%' || p_search || '%')
    GROUP BY customer_id
  ) t;
  result := jsonb_set(result, '{customer_id}', sub_result);

  -- Status facets (all filters EXCEPT status)
  SELECT COALESCE(jsonb_object_agg(val, cnt), '{}'::jsonb) INTO sub_result
  FROM (
    SELECT status AS val, count(*)::int AS cnt FROM leads
    WHERE status IS NOT NULL AND status != ''
      AND (p_branches IS NULL OR branch = ANY(p_branches))
      AND (p_customers IS NULL OR customer_id::text = ANY(p_customers))
      AND (p_provinces IS NULL OR provincie = ANY(p_provinces))
      AND (p_sources IS NULL OR bron = ANY(p_sources))
      AND (p_phone_valid IS NULL
           OR (p_phone_valid = 'true' AND phone_valid = true)
           OR (p_phone_valid = 'false' AND phone_valid = false))
      AND (p_date_from IS NULL OR wervingsdatum >= p_date_from::date)
      AND (p_date_to IS NULL OR wervingsdatum <= p_date_to::date)
      AND (p_search IS NULL
           OR naam_klant ILIKE '%' || p_search || '%'
           OR email ILIKE '%' || p_search || '%'
           OR telefoonnummer ILIKE '%' || p_search || '%'
           OR postcode ILIKE '%' || p_search || '%')
    GROUP BY status
  ) t;
  result := jsonb_set(result, '{status}', sub_result);

  -- Province facets (all filters EXCEPT province)
  SELECT COALESCE(jsonb_object_agg(val, cnt), '{}'::jsonb) INTO sub_result
  FROM (
    SELECT provincie AS val, count(*)::int AS cnt FROM leads
    WHERE provincie IS NOT NULL AND provincie != ''
      AND (p_branches IS NULL OR branch = ANY(p_branches))
      AND (p_customers IS NULL OR customer_id::text = ANY(p_customers))
      AND (p_statuses IS NULL OR status = ANY(p_statuses))
      AND (p_sources IS NULL OR bron = ANY(p_sources))
      AND (p_phone_valid IS NULL
           OR (p_phone_valid = 'true' AND phone_valid = true)
           OR (p_phone_valid = 'false' AND phone_valid = false))
      AND (p_date_from IS NULL OR wervingsdatum >= p_date_from::date)
      AND (p_date_to IS NULL OR wervingsdatum <= p_date_to::date)
      AND (p_search IS NULL
           OR naam_klant ILIKE '%' || p_search || '%'
           OR email ILIKE '%' || p_search || '%'
           OR telefoonnummer ILIKE '%' || p_search || '%'
           OR postcode ILIKE '%' || p_search || '%')
    GROUP BY provincie
  ) t;
  result := jsonb_set(result, '{province}', sub_result);

  -- Source facets (all filters EXCEPT source)
  SELECT COALESCE(jsonb_object_agg(val, cnt), '{}'::jsonb) INTO sub_result
  FROM (
    SELECT bron AS val, count(*)::int AS cnt FROM leads
    WHERE bron IS NOT NULL AND bron != ''
      AND (p_branches IS NULL OR branch = ANY(p_branches))
      AND (p_customers IS NULL OR customer_id::text = ANY(p_customers))
      AND (p_statuses IS NULL OR status = ANY(p_statuses))
      AND (p_provinces IS NULL OR provincie = ANY(p_provinces))
      AND (p_phone_valid IS NULL
           OR (p_phone_valid = 'true' AND phone_valid = true)
           OR (p_phone_valid = 'false' AND phone_valid = false))
      AND (p_date_from IS NULL OR wervingsdatum >= p_date_from::date)
      AND (p_date_to IS NULL OR wervingsdatum <= p_date_to::date)
      AND (p_search IS NULL
           OR naam_klant ILIKE '%' || p_search || '%'
           OR email ILIKE '%' || p_search || '%'
           OR telefoonnummer ILIKE '%' || p_search || '%'
           OR postcode ILIKE '%' || p_search || '%')
    GROUP BY bron
  ) t;
  result := jsonb_set(result, '{source}', sub_result);

  RETURN result;
END;
$$;
