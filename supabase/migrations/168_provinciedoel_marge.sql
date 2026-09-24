-- Marge rond een provinciedoel.
--
-- WAAROM
-- ------
-- Een straaldoel heeft `radius_km` en kon dus opgerekt worden; een
-- provinciedoel was alles of niets. Bij vdz brigade (Utrecht + Zuid-Holland)
-- betekende dat: een lead in Sleeuwijk die 1 km over de provinciegrens ligt
-- viel eruit, terwijl de adviseur er langs rijdt.
--
-- Met een marge in kilometers rond de provinciegrens kan zo'n doel net zo
-- soepel worden gemaakt als een straaldoel, zonder een hele aangrenzende
-- provincie erbij te nemen.
--
-- Nul (de standaard) betekent: precies de provincie, zoals het nu werkt.

ALTER TABLE customer_targets
  ADD COLUMN IF NOT EXISTS marge_km integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN customer_targets.marge_km IS
  'Extra kilometers rond een provinciedoel. Een lead net buiten de provincie telt mee zolang hij binnen deze marge van de grens ligt. Alleen zinvol bij target_type = province; bij een straaldoel gebruik je radius_km.';

ALTER TABLE customer_targets
  DROP CONSTRAINT IF EXISTS customer_targets_marge_km_check;
ALTER TABLE customer_targets
  ADD CONSTRAINT customer_targets_marge_km_check
  CHECK (marge_km >= 0 AND marge_km <= 100);
