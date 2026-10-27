-- Dagdosering per batch: het dagmaximum gelijkmatig verdelen tussen 08:00 en
-- 16:00, en een lead zonder klant die langer dan 18 uur wacht niet meer aan
-- deze batch geven (die gaat naar Restleads). Standaard aan; per batch uit te
-- zetten bij het dagmaximum. Zonder dagmaximum heeft het geen effect.
-- Zie src/lib/dagDosering.ts.

ALTER TABLE customer_batches
  ADD COLUMN IF NOT EXISTS dagdosering boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN customer_batches.dagdosering IS
  'Dagmaximum gelijkmatig over 08:00-16:00, en geen leads die langer dan 18 uur op een klant wachten. Alleen van belang met leads_per_day.';
