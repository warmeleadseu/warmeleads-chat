-- Direct leveren: een klant (of één batch) krijgt een passende lead bij
-- binnenkomst altijd als eerste, binnen een minuut. Plus wat nodig is om te
-- meten of dat, samen met de WhatsApp-opvolging van Snelraak, betere
-- resultaten geeft.
--
-- Alleen toevoegingen: zolang niemand op direct staat verandert er niets aan
-- de verdeling.

BEGIN;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS direct_leveren boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS direct_leveren_sinds timestamptz;

COMMENT ON COLUMN customers.direct_leveren IS
  'Klant krijgt passende leads bij binnenkomst altijd als eerste (binnen een minuut). Per batch te overschrijven.';
COMMENT ON COLUMN customers.direct_leveren_sinds IS
  'Sinds wanneer direct leveren aan staat; begin van de "na"-periode in de vergelijking.';

ALTER TABLE customer_batches
  ADD COLUMN IF NOT EXISTS direct_leveren text
    CHECK (direct_leveren IS NULL OR direct_leveren IN ('aan', 'uit'));

COMMENT ON COLUMN customer_batches.direct_leveren IS
  'aan: altijd direct; uit: nooit direct; leeg: volgt de klantkaart.';

ALTER TABLE lead_assignments
  ADD COLUMN IF NOT EXISTS via_direct boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN lead_assignments.via_direct IS
  'Deze levering ging via direct leveren (vastgelegd op het moment van toewijzen).';

/* Statusgeschiedenis van leveringen. Er was alleen terminal_status_at, en
   alleen voor verkocht en afgewezen; zonder geschiedenis is "hoe snel volgt
   de klant een lead op" niet te meten. De trigger dekt elke schrijfroute. */
CREATE TABLE IF NOT EXISTS lead_status_wijzigingen (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES lead_assignments(id) ON DELETE CASCADE,
  lead_id       uuid NOT NULL,
  customer_id   uuid NOT NULL,
  van           text,
  naar          text,
  gewijzigd_op  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lead_status_wijzigingen_assignment_idx
  ON lead_status_wijzigingen (assignment_id, gewijzigd_op);
CREATE INDEX IF NOT EXISTS lead_status_wijzigingen_klant_idx
  ON lead_status_wijzigingen (customer_id, gewijzigd_op);
ALTER TABLE lead_status_wijzigingen ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION log_lead_status_wijziging()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO lead_status_wijzigingen (assignment_id, lead_id, customer_id, van, naar)
    VALUES (NEW.id, NEW.lead_id, NEW.customer_id, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lead_status_wijziging ON lead_assignments;
CREATE TRIGGER trg_lead_status_wijziging
  AFTER UPDATE OF status ON lead_assignments
  FOR EACH ROW EXECUTE FUNCTION log_lead_status_wijziging();

COMMIT;
