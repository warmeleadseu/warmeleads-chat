-- Hoe de lookback (terugkijkperiode) van een batch wordt geleverd.
--
-- Standaard gefaseerd: willekeurig verspreid over 8 uur (zie
-- src/lib/inhaalslagPlanning.ts). Met spoed: alles meteen. Spoed kiest een
-- admin of superadmin bij het aanmaken van een batch. Omdat de lookback bij
-- een onbetaalde batch pas bij de betaling (of bij een latere startdatum)
-- loopt, moet die keuze tot dat moment bewaard blijven. Na gebruik valt het
-- veld terug op gefaseerd, zodat een latere lookback weer gefaseerd gaat.

ALTER TABLE customer_batches
  ADD COLUMN IF NOT EXISTS lookback_levering text NOT NULL DEFAULT 'gefaseerd';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_batches_lookback_levering_check') THEN
    ALTER TABLE customer_batches
      ADD CONSTRAINT customer_batches_lookback_levering_check CHECK (lookback_levering IN ('gefaseerd', 'spoed'));
  END IF;
END $$;

COMMENT ON COLUMN customer_batches.lookback_levering IS
  'gefaseerd (standaard) of spoed: hoe de eerstvolgende lookback wordt geleverd. Valt na gebruik terug op gefaseerd.';
