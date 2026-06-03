-- Voegt drie nieuwe lead-branches toe: Glas, Kozijnen, Isolatie.
-- Geselecteerd door AM in "Branches om uit te lichten" (mail-compose) en
-- bruikbaar als reguliere lead-branche met standaard staffel (min 30 @ €37,50/lead,
-- gelijk aan Zonnepanelen/Warmtepomp). Niet-partner; gewone verkoopbranches.

INSERT INTO public.branches (
  slug, name, color, description, sort_order,
  pricing_tiers, min_batch_size, nationwide_discount,
  is_active, hidden_from_admin, is_partner_branch
)
VALUES
  (
    'glas',
    'Glas',
    'sky',
    'Leads voor glaszetters / glasmontage- en glasvervangingsprojecten.',
    6,
    '[{"min_leads": 30, "price_per_lead": 37.5}]'::jsonb,
    30,
    0,
    true,
    false,
    false
  ),
  (
    'kozijnen',
    'Kozijnen',
    'purple',
    'Leads voor kozijnen-vervanging en kozijnenmontage (kunststof / aluminium / hout).',
    7,
    '[{"min_leads": 30, "price_per_lead": 37.5}]'::jsonb,
    30,
    0,
    true,
    false,
    false
  ),
  (
    'isolatie',
    'Isolatie',
    'lime',
    'Leads voor isolatie van woningen (vloer-, dak-, spouw- en gevelisolatie).',
    8,
    '[{"min_leads": 30, "price_per_lead": 37.5}]'::jsonb,
    30,
    0,
    true,
    false,
    false
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  color = EXCLUDED.color,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  hidden_from_admin = false,
  is_partner_branch = false,
  updated_at = now();
