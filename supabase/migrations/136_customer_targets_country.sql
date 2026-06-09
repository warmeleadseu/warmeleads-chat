-- 136 — Optionele land-restrictie op customer_targets
--
-- Aanleiding: NL-klanten met een radius-target "Heel Nederland" (200km
-- vanaf Utrecht) krijgen ongewild Belgische leads omdat die radius
-- delen van noord-België bestrijkt. Voorbeeld:
--   * Mediabink (NL, "Heel Nederland" 200km) → 7 BE-leads
--   * Den Held Dakwerk (NL, "Heel Nederland" 200km) → 1 BE-lead
-- De geometrische match klopt, maar functioneel wil de klant alleen
-- NL-leads. Voor sommige andere klanten (bv. Total Energy BE met
-- "Eindhoven 50km") is een grensoverschrijdende radius juist gewenst.
-- Daarom wordt land een OPTIONELE restrictie per target.
--
-- Semantiek:
--   country = NULL        → geen restrictie (geometrie + provincies bepalen)
--   country = 'NL' / 'BE' → strikte filter: lead.land moet exact matchen
--
-- Backfill-heuristiek:
--   * province-target met provs alleen `NL:`  → country = 'NL'
--   * province-target met provs alleen `BE:`  → country = 'BE'
--   * province-target met gemengde provs      → blijft NULL
--   * radius-target met label "Heel Nederland" → country = 'NL'
--   * radius-target met label "Heel België"    → country = 'BE'
--   * andere radius-targets blijven NULL: hun radius is bewust
--     gekozen rond een specifieke locatie (Eindhoven, Lochristi, …)
--     en mag dus expliciet over de grens gaan tenzij de gebruiker
--     dat handmatig anders zet.

------------------------------------------------------------------------
-- STAP 1: kolom toevoegen
------------------------------------------------------------------------

ALTER TABLE public.customer_targets
  ADD COLUMN IF NOT EXISTS country text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'customer_targets'
      AND constraint_name = 'customer_targets_country_chk'
  ) THEN
    ALTER TABLE public.customer_targets
      ADD CONSTRAINT customer_targets_country_chk
      CHECK (country IS NULL OR country IN ('NL', 'BE'));
  END IF;
END$$;

COMMENT ON COLUMN public.customer_targets.country IS
  'Optionele land-restrictie voor deze target. NULL = geen restrictie (geometrie/provincies bepalen). NL/BE = lead.land moet exact matchen.';

------------------------------------------------------------------------
-- STAP 2: backfill provincie-targets op basis van token-prefix
------------------------------------------------------------------------

UPDATE public.customer_targets
SET country = 'NL'
WHERE country IS NULL
  AND COALESCE(target_type, 'radius') = 'province'
  AND provinces IS NOT NULL
  AND array_length(provinces, 1) > 0
  AND NOT EXISTS (
    SELECT 1 FROM unnest(provinces) AS p
    WHERE p NOT LIKE 'NL:%'
  );

UPDATE public.customer_targets
SET country = 'BE'
WHERE country IS NULL
  AND COALESCE(target_type, 'radius') = 'province'
  AND provinces IS NOT NULL
  AND array_length(provinces, 1) > 0
  AND NOT EXISTS (
    SELECT 1 FROM unnest(provinces) AS p
    WHERE p NOT LIKE 'BE:%'
  );

------------------------------------------------------------------------
-- STAP 3: backfill radius-targets op basis van label-tekst
------------------------------------------------------------------------

UPDATE public.customer_targets
SET country = 'NL'
WHERE country IS NULL
  AND COALESCE(target_type, 'radius') = 'radius'
  AND label IS NOT NULL
  AND lower(label) ~ '(heel\s+nederland|hele\s+nederland|geheel\s+nederland|heel\s+nl\b)';

UPDATE public.customer_targets
SET country = 'BE'
WHERE country IS NULL
  AND COALESCE(target_type, 'radius') = 'radius'
  AND label IS NOT NULL
  AND lower(label) ~ '(heel\s+belg|hele\s+belg|geheel\s+belg|heel\s+be\b)';
