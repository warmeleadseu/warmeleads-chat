-- ============================================================================
-- 084 — Team-agenda
--
-- Gedeelde agenda waarin admins en account managers hun eigen afspraken
-- (klantbezoeken, prospect-bezoeken, beurzen, vakantie, intern overleg)
-- plannen en die van het hele team kunnen inzien.
--
-- Niet te verwarren met:
--   - `appointments`            (klant-afspraken die portal-gebruikers
--                                inplannen met huiseigenaren bij hun leads)
--   - `bookings`/agenda-pagina  (publieke plan-gesprek-boekingen via
--                                warmeleads.eu/plan-gesprek)
-- ============================================================================

CREATE TABLE IF NOT EXISTS team_calendar_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  description  text,
  event_type   text NOT NULL CHECK (event_type IN (
    'customer_visit',
    'prospect_visit',
    'internal',
    'external_event',
    'vacation',
    'other'
  )),
  starts_at    timestamptz NOT NULL,
  ends_at      timestamptz NOT NULL,
  all_day      boolean NOT NULL DEFAULT false,
  location     text,
  customer_id  uuid REFERENCES customers(id) ON DELETE SET NULL,
  prospect_id  uuid REFERENCES prospects(id) ON DELETE SET NULL,
  created_by   uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_calendar_events_time_order CHECK (ends_at >= starts_at),
  CONSTRAINT team_calendar_events_single_link CHECK (
    customer_id IS NULL OR prospect_id IS NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_tce_starts_at    ON team_calendar_events (starts_at);
CREATE INDEX IF NOT EXISTS idx_tce_ends_at      ON team_calendar_events (ends_at);
CREATE INDEX IF NOT EXISTS idx_tce_event_type   ON team_calendar_events (event_type);
CREATE INDEX IF NOT EXISTS idx_tce_customer_id  ON team_calendar_events (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tce_prospect_id  ON team_calendar_events (prospect_id) WHERE prospect_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tce_created_by   ON team_calendar_events (created_by);

CREATE TABLE IF NOT EXISTS team_calendar_event_participants (
  event_id      uuid NOT NULL REFERENCES team_calendar_events(id) ON DELETE CASCADE,
  admin_user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  added_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, admin_user_id)
);

CREATE INDEX IF NOT EXISTS idx_tcep_admin_user_id ON team_calendar_event_participants (admin_user_id);

-- updated_at trigger (hergebruikt de generieke functie touch_updated_at uit
-- migratie 074; we definiëren 'm hier nog eens met IF NOT EXISTS-patroon zodat
-- de migratie ook standalone draait op een schone database).
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_team_calendar_events_updated_at ON team_calendar_events;
CREATE TRIGGER trg_team_calendar_events_updated_at
  BEFORE UPDATE ON team_calendar_events
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
