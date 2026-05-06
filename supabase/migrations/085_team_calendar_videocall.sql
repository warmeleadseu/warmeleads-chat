-- ============================================================================
-- 085 — Team-agenda: videocall-events
--
-- Voegt een 'videocall'-type toe aan de team-agenda. Voor zo'n event
-- genereren we automatisch een Jitsi Meet-room en (optioneel) sturen we
-- de gekoppelde klant of prospect een uitnodiging per mail. We slaan de
-- meeting-URL en het tijdstip van de uitnodiging op aan de event-rij,
-- zodat we ook achteraf kunnen zien of er een uitnodiging verstuurd is.
-- ============================================================================

-- 1) CHECK-constraint herzien zodat 'videocall' is toegestaan.
ALTER TABLE team_calendar_events
  DROP CONSTRAINT IF EXISTS team_calendar_events_event_type_check;

ALTER TABLE team_calendar_events
  ADD CONSTRAINT team_calendar_events_event_type_check
  CHECK (event_type IN (
    'customer_visit',
    'prospect_visit',
    'videocall',
    'internal',
    'external_event',
    'vacation',
    'other'
  ));

-- 2) Nieuwe kolommen.
ALTER TABLE team_calendar_events
  ADD COLUMN IF NOT EXISTS meeting_url text,
  ADD COLUMN IF NOT EXISTS meeting_invite_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS meeting_invite_email_log_id uuid REFERENCES email_log(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tce_meeting_invite_sent_at
  ON team_calendar_events (meeting_invite_sent_at)
  WHERE meeting_invite_sent_at IS NOT NULL;
