-- Koppel onderzoeksbatches aan de inbound lead-branche (Zapier/Meta), niet aan `niche_research` FK.

ALTER TABLE public.customer_batches
  ADD COLUMN IF NOT EXISTS lead_branch_slug text;

ALTER TABLE public.batch_orders
  ADD COLUMN IF NOT EXISTS lead_branch_slug text;

COMMENT ON COLUMN public.customer_batches.lead_branch_slug IS
  'Bij batch_kind=niche_research: slug van de echte lead-branche waar inbound leads vandaan komen.';
COMMENT ON COLUMN public.batch_orders.lead_branch_slug IS
  'Bij niche-onderzoek bestelling: inbound branche voor de onderzoeksbatch.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customer_batches_lead_branch_slug_fkey'
  ) THEN
    ALTER TABLE public.customer_batches
      ADD CONSTRAINT customer_batches_lead_branch_slug_fkey
      FOREIGN KEY (lead_branch_slug) REFERENCES public.branches(slug)
      ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'batch_orders_lead_branch_slug_fkey'
  ) THEN
    ALTER TABLE public.batch_orders
      ADD CONSTRAINT batch_orders_lead_branch_slug_fkey
      FOREIGN KEY (lead_branch_slug) REFERENCES public.branches(slug)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_customer_batches_niche_lead_branch_active
  ON public.customer_batches (lead_branch_slug)
  WHERE batch_kind = 'niche_research' AND status = 'active' AND lead_branch_slug IS NOT NULL;

-- Inbound-branche voor De Gouden Poort / detailing (Zapier)
INSERT INTO public.branches (
  slug, name, color, description, sort_order, pricing_tiers, min_batch_size, nationwide_discount, is_active, hidden_from_admin
)
VALUES (
  'detailing_onderhoud',
  'Detailing & Onderhoud',
  'cyan',
  'Inbound leads voor detailing en onderhoud (niche-onderzoek / maatwerk).',
  85,
  '[{"min_leads": 10, "price_per_lead": 45}]'::jsonb,
  10,
  0,
  true,
  false
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = true,
  updated_at = now();

-- De Gouden Poort: koppel onderzoeksbatch aan detailing + active voor lead-inname
UPDATE public.customer_batches cb
SET
  lead_branch_slug = 'detailing_onderhoud',
  status = 'active',
  notes = COALESCE(cb.notes, '') || E'\n[Migratie 125] lead_branch_slug=detailing_onderhoud; status active voor automatische onderzoeksleads.'
WHERE cb.batch_kind = 'niche_research'
  AND (
    cb.notes LIKE '%[Migratie 109] De Gouden Poort BV — onderzoeksbatch%'
    OR cb.niche_title ILIKE '%Gouden Poort%'
  )
  AND (cb.lead_branch_slug IS NULL OR cb.lead_branch_slug <> 'detailing_onderhoud');

UPDATE public.customers c
SET branches = (
  SELECT ARRAY(
    SELECT DISTINCT unnest(COALESCE(c.branches, '{}'::text[]) || ARRAY['detailing_onderhoud']::text[])
  )
)
WHERE EXISTS (
  SELECT 1 FROM public.customer_batches cb
  WHERE cb.customer_id = c.id
    AND cb.batch_kind = 'niche_research'
    AND cb.lead_branch_slug = 'detailing_onderhoud'
    AND (
      cb.notes LIKE '%[Migratie 109] De Gouden Poort BV — onderzoeksbatch%'
      OR cb.niche_title ILIKE '%Gouden Poort%'
    )
);
