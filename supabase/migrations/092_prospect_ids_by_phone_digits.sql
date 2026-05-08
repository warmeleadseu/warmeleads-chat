-- Zoek prospects op telefoon op basis van alleen cijfers (geen phone_digits-kolom nodig in PostgREST-filter).
CREATE OR REPLACE FUNCTION public.prospect_ids_by_phone_digits(
  digits text,
  p_am_id uuid DEFAULT NULL
)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT p.id
  FROM public.prospects p
  WHERE char_length(regexp_replace(coalesce(digits, ''), '[^0-9]', '', 'g')) >= 3
    AND regexp_replace(coalesce(p.phone, ''), '[^0-9]', '', 'g')
        ILIKE '%' || regexp_replace(coalesce(digits, ''), '[^0-9]', '', 'g') || '%'
    AND (p_am_id IS NULL OR p.account_manager_id = p_am_id);
$$;

COMMENT ON FUNCTION public.prospect_ids_by_phone_digits(text, uuid) IS
  'Prospect-IDs waarvan genormaliseerd telefoonnummer de gezochte cijferreeks bevat; AM-scope via p_am_id.';

GRANT EXECUTE ON FUNCTION public.prospect_ids_by_phone_digits(text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.prospect_ids_by_phone_digits(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.prospect_ids_by_phone_digits(text, uuid) TO service_role;
