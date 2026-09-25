-- Demo-data buiten het toewijzingsplafond houden.
--
-- Migratie 169 dwingt het plafond van drie klanten per lead af. De demo-omgeving
-- werkt met leads die bij tientallen klanten staan; dat zijn geen echte
-- leveringen maar etalagemateriaal. Zonder deze uitzondering breekt het opnieuw
-- opbouwen van die demo-data.

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

  /* Bewuste handelingen van een beheerder blijven mogelijk. In de admin zit een
     knop om de vangrails te overrulen; die stilzwijgend blokkeren vanuit de
     database zou onnavolgbaar zijn. De wedloop die we hier dichten zit in de
     automatische verdeling, niet in handwerk. Demo-data telt evenmin: dat zijn
     geen echte leveringen en die mogen de demo-omgeving niet breken. */
  IF coalesce(NEW.source, '') IN ('manual', 'bulk_export', 'demo') THEN
    RETURN NEW;
  END IF;

  /* Serialiseer per lead. Een tweede transactie voor dezelfde lead wacht hier
     tot wij klaar zijn en telt daarna onze rij wél mee. */
  PERFORM pg_advisory_xact_lock(hashtext(NEW.lead_id::text));

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
     AND coalesce(source, '') NOT IN ('mirror', 'demo')
     AND customer_id <> NEW.customer_id;

  IF aantal >= max_klanten THEN
    RAISE EXCEPTION 'Lead % staat al bij % klanten, plafond is %', NEW.lead_id, aantal, max_klanten
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
