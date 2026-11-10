-- Interne klanten tellen niet mee voor het plafond van drie klanten per lead.
--
-- Afgesproken 10 nov 2026. Interne klanten (customers.intern: WarmeLeads.eu,
-- Warme Leads Afspraakleads) zijn geen vakspecialisten: intern gebruik is
-- geen delen (privacyverklaring, hoofdstuk A). Ze bezetten wel een van de
-- drie plekken, zodat een lead met één interne klant maar naar twee betalende
-- klanten kon. Een afspraakpartner zoals Infinite Scale is een externe partij
-- en telt gewoon mee, want de privacyverklaring belooft maximaal drie.
--
-- De verdeling in de code telt op dezelfde manier (src/lib/interneKlanten.ts).
-- Ook een interne klant zelf kan geen vierde plek krijgen: het plafond geldt
-- voor elke nieuwe toewijzing, alleen de telling laat de interne weg.
--
-- Terugdraaien: migratie 171 opnieuw uitvoeren.

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

  /* Bewuste handelingen van een beheerder blijven mogelijk, net als demo-data
     (zie migratie 171). */
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

  SELECT count(DISTINCT la.customer_id)
    INTO aantal
    FROM lead_assignments la
    LEFT JOIN customers c ON c.id = la.customer_id
   WHERE la.lead_id = NEW.lead_id
     AND coalesce(la.source, '') NOT IN ('mirror', 'demo')
     AND la.customer_id <> NEW.customer_id
     AND NOT coalesce(c.intern, false);

  IF aantal >= max_klanten THEN
    RAISE EXCEPTION 'Lead % staat al bij % klanten, plafond is %', NEW.lead_id, aantal, max_klanten
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
