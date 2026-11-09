-- Toestemming ingetrokken: een aanvrager die (bijvoorbeeld per mail) zijn
-- toestemming intrekt, wordt nooit meer met een klant gedeeld.
--
-- Drie velden op de lead en een trigger op lead_assignments die elke nieuwe
-- toewijzing (en elke omhanging naar een andere klant) van zo'n lead weigert.
-- Zo geldt de regel voor alle routes tegelijk, ook toekomstige: verdeling,
-- geplande leveringen, Restleads, Extra leads, bulk, handmatig, exports naar
-- het portaal. Bestaande toewijzingen blijven staan.
--
-- Terugdraaien:
--   DROP TRIGGER IF EXISTS lead_toestemming_bewaken ON lead_assignments;
--   DROP FUNCTION IF EXISTS lead_toestemming_bewaken();
--   ALTER TABLE leads DROP COLUMN IF EXISTS toestemming_ingetrokken_op,
--     DROP COLUMN IF EXISTS toestemming_ingetrokken_door,
--     DROP COLUMN IF EXISTS toestemming_ingetrokken_reden;

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS toestemming_ingetrokken_op timestamptz,
  ADD COLUMN IF NOT EXISTS toestemming_ingetrokken_door text,
  ADD COLUMN IF NOT EXISTS toestemming_ingetrokken_reden text;

CREATE INDEX IF NOT EXISTS idx_leads_toestemming_ingetrokken
  ON leads (toestemming_ingetrokken_op)
  WHERE toestemming_ingetrokken_op IS NOT NULL;

CREATE OR REPLACE FUNCTION lead_toestemming_bewaken()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.lead_id IS NOT DISTINCT FROM OLD.lead_id
     AND NEW.customer_id IS NOT DISTINCT FROM OLD.customer_id THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM leads
    WHERE id = NEW.lead_id AND toestemming_ingetrokken_op IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'toestemming_ingetrokken: lead % mag niet meer worden gedeeld', NEW.lead_id
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lead_toestemming_bewaken ON lead_assignments;
CREATE TRIGGER lead_toestemming_bewaken
  BEFORE INSERT OR UPDATE OF lead_id, customer_id ON lead_assignments
  FOR EACH ROW EXECUTE FUNCTION lead_toestemming_bewaken();
