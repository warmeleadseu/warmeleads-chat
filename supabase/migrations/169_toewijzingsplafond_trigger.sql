-- Het plafond van drie klanten per lead afdwingen in de database.
--
-- De verdeler controleert het plafond zelf, maar controleren en invoegen zijn
-- twee losse stappen. Draait er een tweede verdeelronde tegelijk, dan lezen
-- allebei "deze lead heeft er twee" en voegen ze er allebei een toe.
--
-- Dat is geen theorie: sinds 1 augustus kreeg 52 keer dezelfde lead binnen vijf
-- seconden twee klanten, en zes leads belandden daardoor bij vier klanten. In
-- de applicatie is dat niet dicht te krijgen zolang er meer dan één proces kan
-- draaien. De database is het enige punt waar alle schrijvers langs moeten.
--
-- Bewust alleen het plafond, niet de cooldown van twaalf uur. Die cooldown is
-- verdeelbeleid dat een beheerder met opzet overschrijft: vanaf de
-- Restleads-pagina deel je juist een verse lead alsnog aan een tweede klant
-- uit. Dat moet mogelijk blijven. De wedloop zelf wordt aangepakt door de
-- verdeelronde niet meer over zichzelf heen te laten lopen.

CREATE OR REPLACE FUNCTION bewaak_toewijzingsplafond()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  max_klanten integer := 3;
  eigen_max   text;
  aantal      integer;
BEGIN
  -- Spiegelrijen zijn geen echte levering en tellen nergens voor mee.
  IF coalesce(NEW.source, '') = 'mirror' THEN
    RETURN NEW;
  END IF;

  /* Bewuste handelingen van een beheerder blijven mogelijk. In de admin zit
     een knop om de vangrails te overrulen; die stilzwijgend blokkeren vanuit
     de database zou onnavolgbaar zijn. De wedloop die we hier dichten zit in
     de automatische verdeling, niet in handwerk. Demo-data telt evenmin: dat
     zijn geen echte leveringen en die mogen de demo-omgeving niet breken. */
  IF coalesce(NEW.source, '') IN ('manual', 'bulk_export', 'demo') THEN
    RETURN NEW;
  END IF;

  /* Serialiseer per lead. Een tweede transactie voor dezelfde lead wacht hier
     tot wij klaar zijn en telt daarna onze rij wél mee. Precies de wedloop die
     we dichten, en het houdt andere leads ongemoeid. */
  PERFORM pg_advisory_xact_lock(hashtext(NEW.lead_id::text));

  -- Per lead kan het plafond verlaagd zijn (nooit verhoogd).
  SELECT custom_fields ->> 'max_customer_assignments'
    INTO eigen_max
    FROM leads WHERE id = NEW.lead_id;

  IF eigen_max IS NOT NULL AND eigen_max ~ '^[0-9]+$' THEN
    max_klanten := LEAST(max_klanten, GREATEST(1, eigen_max::integer));
  END IF;

  SELECT count(DISTINCT customer_id)
    INTO aantal
    FROM lead_assignments
   WHERE lead_id = NEW.lead_id
     AND coalesce(source, '') <> 'mirror'
     AND customer_id <> NEW.customer_id;

  IF aantal >= max_klanten THEN
    RAISE EXCEPTION 'Lead % staat al bij % klanten, plafond is %', NEW.lead_id, aantal, max_klanten
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bewaak_toewijzingsplafond ON lead_assignments;
CREATE TRIGGER trg_bewaak_toewijzingsplafond
  BEFORE INSERT ON lead_assignments
  FOR EACH ROW
  EXECUTE FUNCTION bewaak_toewijzingsplafond();

COMMENT ON FUNCTION bewaak_toewijzingsplafond() IS
  'Max. 3 klanten per lead, afgedwongen in de database. Sluit de wedloop tussen gelijktijdige verdeelrondes.';
