-- ============================================================================
-- 095 — Prospects: 'mail_verstuurd'-status
--
-- Tussen 'contact' en 'gekwalificeerd': expliciet vastleggen dat er al mail
-- is uitgegaan vanuit het CRM.
-- ============================================================================

ALTER TABLE prospects
  DROP CONSTRAINT IF EXISTS prospects_status_check;

ALTER TABLE prospects
  ADD CONSTRAINT prospects_status_check
  CHECK (status IN (
    'nieuw',
    'voicemail',
    'contact',
    'mail_verstuurd',
    'gekwalificeerd',
    'voorstel',
    'gewonnen',
    'verloren',
    'niet_relevant'
  ));
