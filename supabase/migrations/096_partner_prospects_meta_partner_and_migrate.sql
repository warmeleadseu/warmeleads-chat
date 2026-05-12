-- ============================================================================
-- 096 — Partner-prospects: bron 'meta_partner' + migratie Thuisbatterij Partners
--
-- 1) prospects.source uitbreiden met meta_partner (Meta/Zapier partner-campagnes).
-- 2) Bestaande leads met branch thuisbatterij_partners → prospects + activiteit,
--    gekoppeld aan accountmanager Rick Schlimback (admin_users.id).
-- 3) Alle prospects met deze branche in branches[] aan Rick koppelen (idempotent).
-- ============================================================================

-- --- 1) Source CHECK ----------------------------------------------------------------
ALTER TABLE prospects DROP CONSTRAINT IF EXISTS prospects_source_check;

ALTER TABLE prospects
  ADD CONSTRAINT prospects_source_check
  CHECK (
    source = ANY (
      ARRAY[
        'manual',
        'csv_import',
        'xlsx_import',
        'website',
        'referral',
        'other',
        'meta_partner'
      ]::text[]
    )
  );

-- --- 2) Leads → prospects (partner-branch) -------------------------------------------
WITH moved AS (
  DELETE FROM leads
  WHERE branch = 'thuisbatterij_partners'
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
    ARRAY['thuisbatterij_partners'::text],
    'nieuw',
    'meta_partner',
    jsonb_strip_nulls(
      jsonb_build_object(
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
        TRIM(m.notities) || E'\n\n(Gemigreerd van leads / Thuisbatterij Partners.)'
      ELSE 'Gemigreerd van leads (Thuisbatterij Partners).'
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
  'Thuisbatterij Partners (gemigreerd)',
  'Deze prospect kwam binnen als lead en is automatisch naar de prospect-pijplijn verplaatst.',
  jsonb_build_object('migration', '096_partner_leads_to_prospects')
FROM ins i;

-- --- 3) Bestaande partner-prospects aan Rick ----------------------------------------
UPDATE prospects
SET
  account_manager_id = '64cad239-1eaf-497e-9c2b-d2ea60cb0512'::uuid,
  updated_at = now()
WHERE branches @> ARRAY['thuisbatterij_partners']::text[];
