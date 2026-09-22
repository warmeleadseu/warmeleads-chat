-- Herstel van de dealbedrag-controle uit migratie 162.
--
-- De eerste versie luidde:
--   CHECK (deal_value IS NULL OR (deal_value >= 0 AND outcome = 'deal'))
--
-- Staat `outcome` op NULL, dan levert `outcome = 'deal'` niet FALSE op maar
-- NULL. Een CHECK faalt alleen op FALSE en laat NULL dus door. Gevolg: een
-- dealbedrag zonder deal glipte er gewoon langs, precies wat de constraint had
-- moeten tegenhouden. Bij het natrekken op productie schreef een testwaarde van
-- 500 euro zich zonder morren weg op een bestaande afspraak; die is meteen
-- teruggezet en er stond verder nergens een bedrag.
--
-- COALESCE maakt er een harde vergelijking van, zodat NULL net zo goed wordt
-- geweigerd als een verkeerde uitkomst.

ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_deal_value_check;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_deal_value_check
  CHECK (
    deal_value IS NULL
    OR (deal_value >= 0 AND COALESCE(outcome, '') = 'deal')
  );

COMMENT ON CONSTRAINT appointments_deal_value_check ON appointments IS
  'Een dealbedrag mag alleen bestaan bij outcome = deal. COALESCE is nodig omdat '
  'een CHECK NULL doorlaat en outcome = ''deal'' NULL oplevert zodra outcome leeg is.';
