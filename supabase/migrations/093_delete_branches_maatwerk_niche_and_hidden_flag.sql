-- Verwijderen van admin-branches met FK-cascade, plus verborgen systeem-branche voor
-- portal-FK (niche_research) zodat die niet meer in de admin-lijst staat.

ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS hidden_from_admin BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.delete_branch_cascade(p_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_slug IS NULL OR btrim(p_slug) = '' THEN
    RAISE EXCEPTION 'invalid slug';
  END IF;

  UPDATE customers
  SET branches = array_remove(COALESCE(branches, '{}'), p_slug)
  WHERE COALESCE(branches, '{}') @> ARRAY[p_slug]::text[];

  UPDATE prospects
  SET branches = array_remove(COALESCE(branches, '{}'), p_slug)
  WHERE COALESCE(branches, '{}') @> ARRAY[p_slug]::text[];

  UPDATE prospect_imports
  SET default_branches = array_remove(COALESCE(default_branches, '{}'), p_slug)
  WHERE default_branches IS NOT NULL
    AND p_slug = ANY(COALESCE(default_branches, '{}'));

  DELETE FROM webhook_keys WHERE branch = p_slug;
  DELETE FROM leads WHERE branch = p_slug;

  DELETE FROM appointments WHERE branch = p_slug;
  DELETE FROM appointment_orders WHERE branch = p_slug;
  DELETE FROM appointment_batches WHERE branch = p_slug;

  DELETE FROM customer_appointment_pricing WHERE branch_slug = p_slug;
  DELETE FROM customer_pricing WHERE branch_slug = p_slug;

  DELETE FROM batch_orders WHERE branch = p_slug;
  DELETE FROM customer_batches WHERE branch = p_slug;

  DELETE FROM branches WHERE slug = p_slug;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_branch_cascade(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_branch_cascade(text) TO service_role;

-- Opruimen: maatwerk (demo/systeem) volledig; niche_research data + rij, daarna opnieuw als verborgen stub.
SELECT public.delete_branch_cascade('maatwerk');
SELECT public.delete_branch_cascade('niche_research');

INSERT INTO branches (
  slug,
  name,
  color,
  description,
  sort_order,
  pricing_tiers,
  min_batch_size,
  nationwide_discount,
  is_active,
  hidden_from_admin
)
VALUES (
  'niche_research',
  'Niche-onderzoek',
  'violet',
  'Eenmalig onderzoek en validatie voor een maatwerk-niche buiten onze standaardverticals. Het bedrag wordt 100% gecrediteerd in leads zodra de campagne live gaat.',
  999,
  '[{"min_leads": 1, "price_per_lead": 1000}]'::jsonb,
  1,
  0,
  true,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  hidden_from_admin = EXCLUDED.hidden_from_admin,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  pricing_tiers = EXCLUDED.pricing_tiers,
  min_batch_size = EXCLUDED.min_batch_size,
  nationwide_discount = EXCLUDED.nationwide_discount,
  is_active = EXCLUDED.is_active,
  updated_at = now();
