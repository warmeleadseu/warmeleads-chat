-- 138 — customer_targets.country fallback op customers.country
--
-- Aanleiding: in migratie 136 is `country` toegevoegd op
-- `customer_targets`, maar alleen gebackfilled voor:
--   * province-targets met mono-prefix (BE:* of NL:*)
--   * radius-targets met label "Heel Nederland" / "Heel België"
--
-- Andere radius-targets (bv. "Eindhoven, 50km", "Lochristi, 30km")
-- bleven bewust op NULL. Dat bleek in praktijk niet veilig:
--   * Groene Thuisbatterijen (NL, "Eindhoven, 50km") sloeg
--     Belivert (BE) een Belgische lead voor de neus weg
--     omdat de 50-km radius BE-Limburg raakt en NULL als
--     "geen restrictie" wordt geïnterpreteerd.
--
-- Veilige standaard: een NL-klant target standaard alleen NL,
-- een BE-klant standaard alleen BE. Wie expliciet grensoverschrijdend
-- wil targeten zet `country` in de UI op NULL.
--
-- Deze migratie:
--   1. Backfilt alle targets waar `country IS NULL` met
--      `customers.country` als die NL of BE is.
--   2. Province-targets met gemengde prefixes (NL: + BE:) blijven
--      op NULL — daar bepalen de tokens al wat matcht.
--
-- Gevolg: bestaande klanten met een radius-target dat over de grens
-- mocht reiken, krijgen nu strakke land-restrictie. Indien een klant
-- bewust grensoverschrijdend was, moet de admin dat in de UI weer
-- terugzetten naar geen restrictie.

------------------------------------------------------------------------
-- STAP 1: backfill alle targets met country IS NULL
------------------------------------------------------------------------

-- Province-targets met gemengde prefixes laten we expliciet met rust:
-- die hebben handmatig zowel NL als BE provincies geselecteerd, en
-- moeten zonder country-filter blijven werken (lead.land match via
-- de provincie-tokens zelf).
UPDATE public.customer_targets t
SET country = c.country
FROM public.customers c
WHERE t.customer_id = c.id
  AND t.country IS NULL
  AND c.country IN ('NL', 'BE')
  AND NOT (
    -- province-target met provincies in zowel NL als BE
    COALESCE(t.target_type, 'radius') = 'province'
    AND t.provinces IS NOT NULL
    AND array_length(t.provinces, 1) > 0
    AND EXISTS (SELECT 1 FROM unnest(t.provinces) AS p WHERE p LIKE 'NL:%')
    AND EXISTS (SELECT 1 FROM unnest(t.provinces) AS p WHERE p LIKE 'BE:%')
  );
