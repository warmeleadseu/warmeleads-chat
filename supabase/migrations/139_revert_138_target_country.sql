-- 139 — Revert van 138_target_country_default_from_customer
--
-- Aanleiding: 138 vulde `customer_targets.country` automatisch met
-- `customers.country` voor radius-targets met NULL. In de praktijk
-- willen sommige klanten bewust grensoverschrijdend targeten (een
-- NL-klant kan een BE-batch willen, of omgekeerd). Het beleid is dus:
-- de klant kiest zelf per target/batch wat actief is, en `NULL` blijft
-- "geen country-restrictie".
--
-- Deze migratie zet alleen die rows terug die door 138 zijn aangeraakt:
--   * target_type = 'radius'
--   * label is NIET "Heel Nederland" / "Heel België" (die werden door 136 gezet)
--   * country = customers.country (de waarde die 138 erin schreef)
-- → terug naar NULL.
--
-- Province-targets blijven intact: 136 had die al correct gezet op basis
-- van token-prefixes; 138 raakte gemixte prefixes niet aan en mono-prefix
-- waren al door 136 ingevuld.

UPDATE public.customer_targets t
SET country = NULL
FROM public.customers c
WHERE t.customer_id = c.id
  AND t.country IS NOT NULL
  AND t.country = c.country
  AND COALESCE(t.target_type, 'radius') = 'radius'
  AND (
    t.label IS NULL
    OR lower(t.label) !~ '(heel\s+nederland|hele\s+nederland|geheel\s+nederland|heel\s+nl\b|heel\s+belg|hele\s+belg|geheel\s+belg|heel\s+be\b)'
  );
