-- ============================================================================
-- 141 — Team-agenda: afspraakbevestiging per mail
--
-- Wanneer een accountmanager een afspraak (klantbezoek / prospect-bezoek)
-- inplant met een gekoppelde klant of prospect, kan er optioneel een
-- bevestigingsmail naar die klant/prospect verstuurd worden. De AM ziet
-- eerst een preview en akkordeert daarna pas de verzending.
--
-- We slaan het verzendtijdstip + de email_log-koppeling op aan de event-rij,
-- net als bij de videocall-uitnodiging (085), zodat we achteraf kunnen zien
-- of (en wanneer) de bevestiging verstuurd is en niet per ongeluk dubbel
-- versturen.
-- ============================================================================

ALTER TABLE team_calendar_events
  ADD COLUMN IF NOT EXISTS confirmation_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmation_email_log_id uuid REFERENCES email_log(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tce_confirmation_sent_at
  ON team_calendar_events (confirmation_sent_at)
  WHERE confirmation_sent_at IS NOT NULL;
