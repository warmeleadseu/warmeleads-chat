-- ============================================================================
-- 137 — Bulk-branche als partner-branche markeren + bestaande leads → prospects
-- ============================================================================
-- Aanleiding: branche `bulk` is aangemaakt voor partner-acquisitie maar er
-- bestond nog geen `is_partner_branch=true`-vlag op deze rij. De webhook-
-- routing kijkt sinds deze release naar die DB-vlag (in plaats van een
-- hardcoded slug-lijst), dus markering hier zorgt dat nieuwe `bulk`-leads
-- automatisch in `prospects` belanden.
--
-- Daarnaast verplaatsen we de 3 bestaande leads die al binnenkwamen toen de
-- vlag nog niet stond (zelfde patroon als migratie 132).

-- 1. Markeer `bulk` als partner-branche.
UPDATE public.branches
SET is_partner_branch = true,
    updated_at = now()
WHERE slug = 'bulk'
  AND is_partner_branch IS DISTINCT FROM true;

-- 2. Verplaats bestaande `bulk`-leads naar prospects (met behoud van metadata).
WITH moved AS (
  DELETE FROM public.leads
  WHERE branch = 'bulk'
  RETURNING *
),
ins AS (
  INSERT INTO public.prospects (
    company_name,
    contact_person,
    email,
    phone,
    postcode,
    city,
    country,
    branches,
    status,
    source,
    source_metadata,
    account_manager_id,
    notes,
    created_at,
    updated_at
  )
  SELECT
    COALESCE(
      NULLIF(TRIM(COALESCE(m.custom_fields ->> 'bedrijfsnaam', m.custom_fields ->> 'company_name')), ''),
      NULLIF(TRIM(m.naam_klant), ''),
      'Onbekend'
    ),
    CASE
      WHEN
        NULLIF(TRIM(COALESCE(m.custom_fields ->> 'bedrijfsnaam', m.custom_fields ->> 'company_name')), '')
        IS NOT NULL
        AND NULLIF(TRIM(m.naam_klant), '') IS NOT NULL
        AND LOWER(TRIM(m.naam_klant))
        <> LOWER(
          TRIM(COALESCE(m.custom_fields ->> 'bedrijfsnaam', m.custom_fields ->> 'company_name'))
        )
      THEN TRIM(m.naam_klant)
      ELSE NULL
    END,
    NULLIF(LOWER(TRIM(m.email)), ''),
    NULLIF(TRIM(m.telefoonnummer), ''),
    NULLIF(TRIM(m.postcode), ''),
    NULLIF(TRIM(m.plaatsnaam), ''),
    COALESCE(NULLIF(TRIM(m.land), ''), 'NL'),
    ARRAY['bulk'::text],
    'nieuw',
    'meta_partner',
    jsonb_strip_nulls(
      jsonb_build_object(
        'partner_branch', 'bulk',
        'migrated_from_lead_id', m.id,
        'meta_campaign_id', m.meta_campaign_id,
        'meta_adset_id', m.meta_adset_id,
        'meta_ad_id', m.meta_ad_id,
        'orig_custom_fields', m.custom_fields,
        'orig_wervingsdatum', m.wervingsdatum
      )
    ),
    '64cad239-1eaf-497e-9c2b-d2ea60cb0512'::uuid,
    CASE
      WHEN NULLIF(TRIM(m.notities), '') IS NOT NULL THEN
        TRIM(m.notities) || E'\n\n(Gemigreerd van leads / Bulk.)'
      ELSE 'Gemigreerd van leads (Bulk).'
    END,
    m.created_at,
    now()
  FROM moved m
  RETURNING id
)
INSERT INTO public.prospect_activities (prospect_id, admin_user_id, type, title, body, metadata)
SELECT
  i.id,
  NULL,
  'import',
  'Bulk (gemigreerd)',
  'Deze prospect kwam binnen als lead en is automatisch naar de prospect-pijplijn verplaatst.',
  jsonb_build_object('migration', '137_bulk_partner_branch_and_lead_migration')
FROM ins i;
