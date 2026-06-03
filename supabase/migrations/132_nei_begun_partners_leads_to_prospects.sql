-- ============================================================================
-- 132 — Nei Begun Partners: bestaande leads → prospects (zelfde patroon als 129)
-- ============================================================================
-- Aanleiding: nei_begun_partners stond niet in PARTNER_PROSPECT_BRANCH_SLUGS, dus
-- bestaande leads op deze partner-branche zijn nooit naar de prospects-pijplijn
-- verplaatst. Vanaf migratie 131 is `is_partner_branch=true` gezet en is de
-- runtime-ingest aangepast, maar bestaande leads moeten ook met terugwerkende
-- kracht omgezet.

WITH moved AS (
  DELETE FROM leads
  WHERE branch = 'nei_begun_partners'
  RETURNING *
),
ins AS (
  INSERT INTO prospects (
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
    ARRAY['nei_begun_partners'::text],
    'nieuw',
    'meta_partner',
    jsonb_strip_nulls(
      jsonb_build_object(
        'partner_branch', 'nei_begun_partners',
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
        TRIM(m.notities) || E'\n\n(Gemigreerd van leads / Nei Begun Partners.)'
      ELSE 'Gemigreerd van leads (Nei Begun Partners).'
    END,
    m.created_at,
    now()
  FROM moved m
  RETURNING id
)
INSERT INTO prospect_activities (prospect_id, admin_user_id, type, title, body, metadata)
SELECT
  i.id,
  NULL,
  'import',
  'Nei Begun Partners (gemigreerd)',
  'Deze prospect kwam binnen als lead en is automatisch naar de prospect-pijplijn verplaatst.',
  jsonb_build_object('migration', '132_nei_begun_partners_leads_to_prospects')
FROM ins i;
