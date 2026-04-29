-- Update get_lead_facets zodat het customer-filter en de customer-facet werken
-- via leads.assigned_customer_ids in plaats van de oudere leads.customer_id
-- kolom. Daarmee kloppen counts ook voor leads die via lead_assignments aan
-- klanten zijn uitgedeeld.
--
-- Toegevoegd: p_assignment ('assigned' | 'unassigned' | NULL) en
-- p_exclude_customers (uitsluiten van klanten waar leads aan toegewezen zijn).

CREATE OR REPLACE FUNCTION get_lead_facets(
  p_branches text[] DEFAULT NULL,
  p_customers text[] DEFAULT NULL,
  p_statuses text[] DEFAULT NULL,
  p_provinces text[] DEFAULT NULL,
  p_sources text[] DEFAULT NULL,
  p_phone_valid text DEFAULT NULL,
  p_date_from text DEFAULT NULL,
  p_date_to text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_assignment text DEFAULT NULL,
  p_exclude_customers text[] DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  sub_result jsonb;
  v_customer_uuids uuid[] := CASE
    WHEN p_customers IS NULL THEN NULL
    ELSE ARRAY(SELECT x::uuid FROM unnest(p_customers) x)
  END;
  v_exclude_uuids uuid[] := CASE
    WHEN p_exclude_customers IS NULL THEN NULL
    ELSE ARRAY(SELECT x::uuid FROM unnest(p_exclude_customers) x)
  END;
BEGIN
  -- Branch facets (all filters EXCEPT branch)
  SELECT COALESCE(jsonb_object_agg(val, cnt), '{}'::jsonb) INTO sub_result
  FROM (
    SELECT branch AS val, count(*)::int AS cnt FROM leads
    WHERE branch IS NOT NULL AND branch != ''
      AND (v_customer_uuids IS NULL OR assigned_customer_ids && v_customer_uuids)
      AND (v_exclude_uuids IS NULL OR NOT (assigned_customer_ids && v_exclude_uuids))
      AND (p_assignment IS NULL
           OR (p_assignment = 'assigned' AND is_assigned = true)
           OR (p_assignment = 'unassigned' AND is_assigned = false))
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

  -- Customer facets (all filters EXCEPT customer)
  -- Tellen via UNNEST zodat een lead die bij meerdere klanten ligt ook bij elke
  -- klant 1x meetelt.
  SELECT COALESCE(jsonb_object_agg(val, cnt), '{}'::jsonb) INTO sub_result
  FROM (
    SELECT cid::text AS val, count(*)::int AS cnt
    FROM leads,
         LATERAL unnest(assigned_customer_ids) AS cid
    WHERE (v_exclude_uuids IS NULL OR NOT (assigned_customer_ids && v_exclude_uuids))
      AND (p_assignment IS NULL
           OR (p_assignment = 'assigned' AND is_assigned = true)
           OR (p_assignment = 'unassigned' AND is_assigned = false))
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
    GROUP BY cid
  ) t;
  result := jsonb_set(result, '{customer_id}', sub_result);

  -- Status facets
  SELECT COALESCE(jsonb_object_agg(val, cnt), '{}'::jsonb) INTO sub_result
  FROM (
    SELECT status AS val, count(*)::int AS cnt FROM leads
    WHERE status IS NOT NULL AND status != ''
      AND (v_customer_uuids IS NULL OR assigned_customer_ids && v_customer_uuids)
      AND (v_exclude_uuids IS NULL OR NOT (assigned_customer_ids && v_exclude_uuids))
      AND (p_assignment IS NULL
           OR (p_assignment = 'assigned' AND is_assigned = true)
           OR (p_assignment = 'unassigned' AND is_assigned = false))
      AND (p_branches IS NULL OR branch = ANY(p_branches))
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

  -- Province facets
  SELECT COALESCE(jsonb_object_agg(val, cnt), '{}'::jsonb) INTO sub_result
  FROM (
    SELECT provincie AS val, count(*)::int AS cnt FROM leads
    WHERE provincie IS NOT NULL AND provincie != ''
      AND (v_customer_uuids IS NULL OR assigned_customer_ids && v_customer_uuids)
      AND (v_exclude_uuids IS NULL OR NOT (assigned_customer_ids && v_exclude_uuids))
      AND (p_assignment IS NULL
           OR (p_assignment = 'assigned' AND is_assigned = true)
           OR (p_assignment = 'unassigned' AND is_assigned = false))
      AND (p_branches IS NULL OR branch = ANY(p_branches))
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

  -- Source facets
  SELECT COALESCE(jsonb_object_agg(val, cnt), '{}'::jsonb) INTO sub_result
  FROM (
    SELECT bron AS val, count(*)::int AS cnt FROM leads
    WHERE bron IS NOT NULL AND bron != ''
      AND (v_customer_uuids IS NULL OR assigned_customer_ids && v_customer_uuids)
      AND (v_exclude_uuids IS NULL OR NOT (assigned_customer_ids && v_exclude_uuids))
      AND (p_assignment IS NULL
           OR (p_assignment = 'assigned' AND is_assigned = true)
           OR (p_assignment = 'unassigned' AND is_assigned = false))
      AND (p_branches IS NULL OR branch = ANY(p_branches))
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

  -- Assignment facet (totalen voor de Toewijzing-filter)
  SELECT jsonb_build_object(
    'assigned', COALESCE(SUM(CASE WHEN is_assigned THEN 1 ELSE 0 END), 0)::int,
    'unassigned', COALESCE(SUM(CASE WHEN NOT is_assigned THEN 1 ELSE 0 END), 0)::int
  ) INTO sub_result
  FROM leads
  WHERE (v_customer_uuids IS NULL OR assigned_customer_ids && v_customer_uuids)
    AND (v_exclude_uuids IS NULL OR NOT (assigned_customer_ids && v_exclude_uuids))
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
         OR postcode ILIKE '%' || p_search || '%');
  result := jsonb_set(result, '{assignment}', sub_result);

  RETURN result;
END;
$$;
