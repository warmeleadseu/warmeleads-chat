-- ============================================================================
-- 098 — Partner-prospects: lead_ingest_snapshot + adres backfill
--
-- Vult source_metadata.lead_ingest_snapshot voor bestaande meta_partner-
-- prospects (o.a. gemigreerd in 096) vanuit orig_* en orig_custom_fields.
-- Zet address alleen als die nu nog leeg is.
-- ============================================================================

UPDATE prospects p
SET
  source_metadata =
    jsonb_set(
      COALESCE(p.source_metadata, '{}'::jsonb),
      '{lead_ingest_snapshot}',
      COALESCE(p.source_metadata -> 'lead_ingest_snapshot', '{}'::jsonb)
      || jsonb_strip_nulls(
        jsonb_build_object(
          'wervingsdatum',
          p.source_metadata -> 'orig_wervingsdatum',
          'meta_campaign_id',
          NULLIF(btrim(p.source_metadata ->> 'meta_campaign_id'), ''),
          'meta_adset_id',
          NULLIF(btrim(p.source_metadata ->> 'meta_adset_id'), ''),
          'meta_ad_id',
          NULLIF(btrim(p.source_metadata ->> 'meta_ad_id'), ''),
          'migrated_from_lead_id',
          p.source_metadata -> 'migrated_from_lead_id',
          'huisnummer',
          NULLIF(
            btrim(COALESCE(p.source_metadata -> 'orig_custom_fields' ->> 'huisnummer', '')),
            ''
          ),
          'provincie',
          NULLIF(
            btrim(COALESCE(p.source_metadata -> 'orig_custom_fields' ->> 'provincie', '')),
            ''
          ),
          'straat',
          NULLIF(
            btrim(
              COALESCE(
                p.source_metadata -> 'orig_custom_fields' ->> 'straat',
                p.source_metadata -> 'orig_custom_fields' ->> 'street',
                p.source_metadata -> 'orig_custom_fields' ->> 'adres',
                ''
              )
            ),
            ''
          ),
          'bron',
          NULLIF(btrim(COALESCE(p.source_metadata -> 'orig_custom_fields' ->> 'bron', '')), ''),
          'lead_status',
          NULLIF(btrim(COALESCE(p.source_metadata -> 'orig_custom_fields' ->> 'status', '')), ''),
          'lat',
          CASE
            WHEN
              (p.source_metadata -> 'orig_custom_fields' ->> 'lat') ~ '^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$'
            THEN to_jsonb((p.source_metadata -> 'orig_custom_fields' ->> 'lat')::double precision)
            ELSE NULL::jsonb
          END,
          'lng',
          CASE
            WHEN
              (p.source_metadata -> 'orig_custom_fields' ->> 'lng') ~ '^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$'
            THEN to_jsonb((p.source_metadata -> 'orig_custom_fields' ->> 'lng')::double precision)
            ELSE NULL::jsonb
          END,
          'phone_valid',
          CASE
            WHEN jsonb_typeof(p.source_metadata -> 'orig_custom_fields' -> 'phone_valid') = 'boolean'
            THEN p.source_metadata -> 'orig_custom_fields' -> 'phone_valid'
            WHEN lower(COALESCE(p.source_metadata -> 'orig_custom_fields' ->> 'phone_valid', '')) IN ('true', '1', 'ja', 'yes')
            THEN to_jsonb(true)
            WHEN lower(COALESCE(p.source_metadata -> 'orig_custom_fields' ->> 'phone_valid', '')) IN ('false', '0', 'nee', 'no')
            THEN to_jsonb(false)
            ELSE NULL::jsonb
          END,
          'quality_score',
          CASE
            WHEN
              (p.source_metadata -> 'orig_custom_fields' ->> 'quality_score') ~ '^[0-9]+(\.[0-9]+)?$'
            THEN to_jsonb((p.source_metadata -> 'orig_custom_fields' ->> 'quality_score')::double precision)
            ELSE NULL::jsonb
          END,
          'lead_customer_id',
          NULLIF(btrim(COALESCE(p.source_metadata -> 'orig_custom_fields' ->> 'customer_id', '')), '')
        )
      ),
      true
    ),
  address = COALESCE(
    NULLIF(btrim(COALESCE(p.address, '')), ''),
    CASE
      WHEN
        NULLIF(
          btrim(
            COALESCE(
              p.source_metadata -> 'orig_custom_fields' ->> 'straat',
              p.source_metadata -> 'orig_custom_fields' ->> 'street',
              p.source_metadata -> 'orig_custom_fields' ->> 'adres',
              ''
            )
          ),
          ''
        )
        IS NOT NULL
        AND NULLIF(btrim(COALESCE(p.source_metadata -> 'orig_custom_fields' ->> 'huisnummer', '')), '')
        IS NOT NULL
      THEN
        btrim(
          COALESCE(
            p.source_metadata -> 'orig_custom_fields' ->> 'straat',
            p.source_metadata -> 'orig_custom_fields' ->> 'street',
            p.source_metadata -> 'orig_custom_fields' ->> 'adres',
            ''
          )
        )
        || ' '
        || btrim(p.source_metadata -> 'orig_custom_fields' ->> 'huisnummer')
      WHEN
        NULLIF(
          btrim(
            COALESCE(
              p.source_metadata -> 'orig_custom_fields' ->> 'straat',
              p.source_metadata -> 'orig_custom_fields' ->> 'street',
              p.source_metadata -> 'orig_custom_fields' ->> 'adres',
              ''
            )
          ),
          ''
        )
        IS NOT NULL
      THEN btrim(
        COALESCE(
          p.source_metadata -> 'orig_custom_fields' ->> 'straat',
          p.source_metadata -> 'orig_custom_fields' ->> 'street',
          p.source_metadata -> 'orig_custom_fields' ->> 'adres',
          ''
        )
      )
      WHEN NULLIF(btrim(COALESCE(p.source_metadata -> 'orig_custom_fields' ->> 'huisnummer', '')), '') IS NOT NULL
      THEN 'Huisnr. ' || btrim(p.source_metadata -> 'orig_custom_fields' ->> 'huisnummer')
      ELSE p.address
    END
  ),
  updated_at = now()
WHERE p.source = 'meta_partner'
  AND p.branches @> ARRAY['thuisbatterij_partners']::text[];
