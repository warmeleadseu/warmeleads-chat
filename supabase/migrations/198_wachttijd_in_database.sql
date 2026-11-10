-- De wachttijd tussen twee klanten van één lead ook in de database bewaken.
--
-- Afgesproken 10 nov 2026. De verdeling bij binnenkomst en de verdeelronde
-- van elk kwartier konden dezelfde lead tegelijk verdelen: beide keken vóórdat
-- de ander iets had opgeslagen, en zo kregen twee klanten de lead binnen een
-- seconde (18 keer, het laatst op 8 okt 2026). De code kan dat niet sluiten;
-- de database wel, met het slot per lead dat migratie 169 al zet.
--
-- Regel (dezelfde als src/lib/wachttijdKlanten.ts): een automatische
-- toewijzing (bron 'distribution') wordt geweigerd zolang een andere externe
-- klant de lead korter dan 12 uur geleden kreeg, of 8 uur als er al twee
-- andere klanten zijn. Interne klanten tellen niet mee (migratie 197).
--
-- Niet bewaakt:
--  - handwerk en exports (manual, bulk_export, bulk_assign, demo) en elke
--    andere bron dan 'distribution';
--  - niche-onderzoek: dat blokkeert anderen niet en wordt niet geblokkeerd,
--    net als in de verdeling;
--  - een lead die al van deze klant is (leads.customer_id): dat is herstel
--    van een ontbrekende toewijzing, geen nieuwe levering.
--
-- Een weigering laat de lead staan voor de volgende ronde; de wachtrij
-- toetst de wachttijd vóór het leveren al zelf en schuift dan door.
--
-- Terugdraaien: migratie 197 opnieuw uitvoeren.

CREATE OR REPLACE FUNCTION bewaak_toewijzingsplafond()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  max_klanten integer := 3;
  eigen_max   text;
  aantal      integer;
  anderen     integer;
  laatste     timestamptz;
  eigenaar    uuid;
  wacht       integer;
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

  SELECT custom_fields ->> 'max_customer_assignments', customer_id
    INTO eigen_max, eigenaar
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

  /* Wachttijd: alleen de automatische verdeling, niet voor niche-onderzoek
     en niet voor herstel bij de eigen klant. */
  IF coalesce(NEW.source, 'distribution') = 'distribution'
     AND eigenaar IS DISTINCT FROM NEW.customer_id
     AND NOT EXISTS (
       SELECT 1 FROM customer_batches b WHERE b.id = NEW.batch_id AND b.batch_kind = 'niche_research'
     )
  THEN
    SELECT count(DISTINCT la.customer_id), max(la.assigned_at)
      INTO anderen, laatste
      FROM lead_assignments la
      LEFT JOIN customers c ON c.id = la.customer_id
      LEFT JOIN customer_batches b ON b.id = la.batch_id
     WHERE la.lead_id = NEW.lead_id
       AND coalesce(la.source, '') NOT IN ('mirror', 'demo')
       AND la.customer_id <> NEW.customer_id
       AND NOT coalesce(c.intern, false)
       AND coalesce(b.batch_kind, '') <> 'niche_research';

    wacht := CASE WHEN anderen >= 2 THEN 8 ELSE 12 END;
    IF laatste IS NOT NULL AND laatste > now() - make_interval(hours => wacht) THEN
      RAISE EXCEPTION 'Lead % kreeg % geleden al een andere klant; wachttijd is % uur',
        NEW.lead_id, date_trunc('minute', now() - laatste), wacht
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
