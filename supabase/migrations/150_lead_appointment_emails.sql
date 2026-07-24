-- Lead-facing thuisbatterij appointment confirmation + 3-day reminder tracking
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS lead_confirmation_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lead_reminder_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_appointments_lead_reminder
  ON appointments (starts_at)
  WHERE status = 'scheduled'
    AND lead_reminder_sent_at IS NULL
    AND contact_email IS NOT NULL;
