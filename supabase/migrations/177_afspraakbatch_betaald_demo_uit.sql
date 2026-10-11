-- Een betaalde afspraakbatch haalt de klant uit het demoportaal.
--
-- Bij leadbatches ruimt de betaalafhandeling de demo-leads op en zet
-- demo_mode uit. Bij afspraakbatches gebeurde dat nergens: een klant die
-- alleen afspraken kocht bleef demo-leads zien (RJ CV Optimalisatie, en nog
-- vier anderen). Een afspraakbatch kan op vijf manieren op betaald komen
-- (Mollie, factuur handmatig betaald, aanmaken, bewerken, bestelling); een
-- trigger dekt ze allemaal.

BEGIN;

CREATE OR REPLACE FUNCTION afspraakbatch_betaald_demo_uit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_paid IS TRUE AND (TG_OP = 'INSERT' OR OLD.is_paid IS DISTINCT FROM TRUE) THEN
    DELETE FROM lead_assignments WHERE customer_id = NEW.customer_id AND source = 'demo';
    UPDATE customers SET demo_mode = false WHERE id = NEW.customer_id AND demo_mode IS DISTINCT FROM false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_afspraakbatch_betaald_demo_uit ON appointment_batches;
CREATE TRIGGER trg_afspraakbatch_betaald_demo_uit
  AFTER INSERT OR UPDATE OF is_paid ON appointment_batches
  FOR EACH ROW EXECUTE FUNCTION afspraakbatch_betaald_demo_uit();

/* Eenmalig: klanten die al een betaalde afspraakbatch hebben. */
DELETE FROM lead_assignments a
USING appointment_batches ab
WHERE ab.customer_id = a.customer_id AND ab.is_paid AND a.source = 'demo';

UPDATE customers c
SET demo_mode = false
WHERE demo_mode IS DISTINCT FROM false
  AND EXISTS (SELECT 1 FROM appointment_batches ab WHERE ab.customer_id = c.id AND ab.is_paid);

COMMIT;
