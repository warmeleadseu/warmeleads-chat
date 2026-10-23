-- Exclusieve en uitgesloten Meta-campagnes per batch.
--
-- Bij een gekoppelde campagne kan per campagne worden gekozen:
--   '24u'    leads uit deze campagne gaan de eerste 24 uur na binnenkomst
--            alleen naar deze batch, daarna ook naar anderen;
--   'altijd' leads uit deze campagne gaan nooit naar een andere klant.
-- Daarnaast campagnes die deze batch nooit krijgt (uitgesloten).
--
-- Opgeslagen als { "<campagne-id>": "24u" | "altijd" } en een lijst
-- campagne-id's. De applicatie bewaakt dat exclusieve campagnes ook
-- gekoppeld zijn en dat een campagne niet bij twee klanten exclusief is.
-- De standaardcampagnes per klant en branche krijgen dezelfde velden, zodat
-- een vervolgbatch de keuze overneemt.

ALTER TABLE customer_batches
  ADD COLUMN IF NOT EXISTS meta_campagne_exclusief jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS meta_campagne_uitgesloten text[] NOT NULL DEFAULT '{}';

ALTER TABLE customer_branch_meta_defaults
  ADD COLUMN IF NOT EXISTS meta_campagne_exclusief jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS meta_campagne_uitgesloten text[] NOT NULL DEFAULT '{}';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_batches_campagne_exclusief_object') THEN
    ALTER TABLE customer_batches ADD CONSTRAINT customer_batches_campagne_exclusief_object
      CHECK (jsonb_typeof(meta_campagne_exclusief) = 'object');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'meta_defaults_campagne_exclusief_object') THEN
    ALTER TABLE customer_branch_meta_defaults ADD CONSTRAINT meta_defaults_campagne_exclusief_object
      CHECK (jsonb_typeof(meta_campagne_exclusief) = 'object');
  END IF;
END $$;

-- Snel de batches vinden die een regel hebben (de verdeling leest ze per ronde).
CREATE INDEX IF NOT EXISTS idx_customer_batches_campagne_regels
  ON customer_batches (status)
  WHERE meta_campagne_exclusief <> '{}'::jsonb OR meta_campagne_uitgesloten <> '{}';

COMMENT ON COLUMN customer_batches.meta_campagne_exclusief IS
  'Per gekoppelde Meta-campagne: 24u (eerste 24 uur na binnenkomst alleen deze batch) of altijd (nooit naar een andere klant).';
COMMENT ON COLUMN customer_batches.meta_campagne_uitgesloten IS
  'Meta-campagnes waarvan deze batch nooit leads krijgt.';
