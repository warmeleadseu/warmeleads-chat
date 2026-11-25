-- Terugbelfunctie in het portaal (25 nov 2026). Eerst alleen voor klanten met
-- customers.terugbellen = true (proef: Infinite Scale). Standaard uit: voor
-- alle andere klanten verandert er niets.

BEGIN;

-- 1. Aan of uit per klant.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS terugbellen boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN customers.terugbellen IS 'Terugbelfunctie in het portaal aan voor deze klant. Zie src/lib/terugbellen.ts.';

-- 2. De status "terugbellen" op een toewijzing.
ALTER TABLE lead_assignments DROP CONSTRAINT IF EXISTS lead_assignments_status_check;
ALTER TABLE lead_assignments ADD CONSTRAINT lead_assignments_status_check
  CHECK (status = ANY (ARRAY['nieuw', 'gecontacteerd', 'geen_gehoor', 'terugbellen', 'offerte', 'afspraak', 'verkocht', 'afgewezen']));

-- 3. Terugbelmomenten: hooguit één open moment per toewijzing.
CREATE TABLE IF NOT EXISTS lead_terugbelmomenten (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   uuid NOT NULL REFERENCES lead_assignments(id) ON DELETE CASCADE,
  lead_id         uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  customer_id     uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  terug_op        timestamptz NOT NULL,
  notitie         text,
  -- Wie het seintje krijgt: een gebruiker, of (bij één gedeelde login) de
  -- browser waarin het is ingepland, of iedereen op het account.
  portal_user_id  uuid REFERENCES portal_users(id) ON DELETE SET NULL,
  apparaat        text,
  voor_iedereen   boolean NOT NULL DEFAULT false,
  gepland_door    text,
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'afgehandeld')),
  uitkomst        text,
  herinnerd_op    timestamptz,
  keer_verzet     integer NOT NULL DEFAULT 0,
  afgehandeld_op  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS lead_terugbelmomenten_een_open ON lead_terugbelmomenten (assignment_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS lead_terugbelmomenten_klant ON lead_terugbelmomenten (customer_id, terug_op) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS lead_terugbelmomenten_seintje ON lead_terugbelmomenten (terug_op) WHERE status = 'open' AND herinnerd_op IS NULL;
CREATE INDEX IF NOT EXISTS lead_terugbelmomenten_lead ON lead_terugbelmomenten (lead_id);
ALTER TABLE lead_terugbelmomenten ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE lead_terugbelmomenten IS 'Geplande terugbelmomenten van klanten. Alleen via de server (service role).';

-- 4. Krijgt de lead een andere status, waar dan ook, dan is het moment afgehandeld.
CREATE OR REPLACE FUNCTION terugbelmoment_afronden() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE lead_terugbelmomenten
  SET status = 'afgehandeld', uitkomst = NEW.status, afgehandeld_op = now(), updated_at = now()
  WHERE assignment_id = NEW.id AND status = 'open';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_terugbelmoment_afronden ON lead_assignments;
CREATE TRIGGER trg_terugbelmoment_afronden
  AFTER UPDATE OF status ON lead_assignments
  FOR EACH ROW
  WHEN (OLD.status = 'terugbellen' AND NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION terugbelmoment_afronden();

-- 5. Pushmeldingen per gebruiker of browser (bestaande aanmeldingen blijven werken).
ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS portal_user_id uuid REFERENCES portal_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS apparaat text;

COMMIT;
