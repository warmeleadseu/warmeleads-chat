-- ============================================================================
-- 086 — Prospects: 'voicemail'-status
--
-- Voegt 'voicemail' toe als interim-status tussen 'nieuw' en 'contact'. Wordt
-- gebruikt wanneer een AM gebeld heeft maar enkel de voicemail heeft kunnen
-- inspreken — dan is de prospect nog niet écht gecontacteerd.
-- ============================================================================

ALTER TABLE prospects
  DROP CONSTRAINT IF EXISTS prospects_status_check;

ALTER TABLE prospects
  ADD CONSTRAINT prospects_status_check
  CHECK (status IN (
    'nieuw',
    'voicemail',
    'contact',
    'gekwalificeerd',
    'voorstel',
    'gewonnen',
    'verloren',
    'niet_relevant'
  ));
