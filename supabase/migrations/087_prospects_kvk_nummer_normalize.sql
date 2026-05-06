-- ============================================================================
-- 087 — Prospects: lege strings naar NULL voor kvk_nummer + guard-constraint
--
-- De partial unique-index `idx_prospects_kvk` op `prospects(kvk_nummer)
-- WHERE kvk_nummer IS NOT NULL` indexeert wél lege strings (`''`), waardoor
-- twee prospects zonder KVK conflicteren als allebei een lege string in dat
-- veld krijgen. De UI stuurde tot nu toe `''` i.p.v. `NULL` bij een leeg
-- KVK-veld; daardoor faalde een tweede update met "KVK-nummer is al in
-- gebruik" terwijl er feitelijk geen KVK ingevuld werd.
--
-- 1. Bestaande `''`-waardes opschonen naar NULL.
-- 2. CHECK-constraint zodat een lege string nooit meer kan binnenkomen via
--    de DB-laag (de API normaliseert al, maar dit is een tweede vangnet).
-- ============================================================================

UPDATE prospects
   SET kvk_nummer = NULL
 WHERE kvk_nummer IS NOT NULL
   AND btrim(kvk_nummer) = '';

ALTER TABLE prospects
  DROP CONSTRAINT IF EXISTS prospects_kvk_nummer_not_blank;

ALTER TABLE prospects
  ADD CONSTRAINT prospects_kvk_nummer_not_blank
  CHECK (kvk_nummer IS NULL OR btrim(kvk_nummer) <> '');
