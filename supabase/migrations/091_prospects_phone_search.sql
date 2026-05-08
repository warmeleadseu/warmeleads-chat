-- Zoeken op telefoon onafhankelijk van opmaak (spaties, streepjes, +31, etc.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'prospects'
      AND column_name = 'phone_digits'
  ) THEN
    ALTER TABLE public.prospects
      ADD COLUMN phone_digits text
      GENERATED ALWAYS AS (regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')) STORED;
  END IF;
END $$;

COMMENT ON COLUMN public.prospects.phone_digits IS 'Alleen cijfers uit phone; gebruikt voor prospect-zoek (ILIKE onafhankelijk van opmaak).';
