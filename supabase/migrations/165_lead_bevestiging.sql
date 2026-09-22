-- De lead kan zijn eigen afspraak bevestigen, verzetten of afzeggen.
--
-- WAAROM
-- ------
-- Er gingen al herinneringen naar de lead, maar een herinnering zonder knop is
-- alleen een mededeling. Wie niet kan komen doet dan niets, en de adviseur rijdt
-- voor niets. Met een link in de bevestiging kan de lead zelf reageren, en weet
-- de klant het vóór vertrek in plaats van erna.

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS lead_bevestigd_at timestamptz,
  ADD COLUMN IF NOT EXISTS lead_reactie text;

COMMENT ON COLUMN appointments.lead_bevestigd_at IS
  'Wanneer de lead zelf via zijn persoonlijke link bevestigde dat hij er zal zijn.';
COMMENT ON COLUMN appointments.lead_reactie IS
  'Wat de lead zelf deed: bevestigd, verzet of afgezegd. Onderscheidt een reactie van de consument van een handeling van de klant.';

ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_lead_reactie_check;
ALTER TABLE appointments
  ADD CONSTRAINT appointments_lead_reactie_check
  CHECK (lead_reactie IS NULL OR lead_reactie IN ('bevestigd', 'verzet', 'afgezegd'));
