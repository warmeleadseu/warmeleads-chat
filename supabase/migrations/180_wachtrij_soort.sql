-- Soort levering in de wachtrij. Een inhaalslag (terugkijkperiode van een
-- batch) wordt sinds 12 okt 2026 niet meer in één klap geleverd maar over 8
-- uur ingepland. Bij het leveren gelden voor die rijen extra regels: 12 uur
-- tussen twee klanten, geen derde klant en het dagmaximum van de batch.

ALTER TABLE geplande_leadleveringen ADD COLUMN IF NOT EXISTS soort text;
COMMENT ON COLUMN geplande_leadleveringen.soort IS
  'inhaalslag: levering uit de terugkijkperiode van een batch (extra regels bij leveren). Leeg: restleads of handmatig ingepland.';
