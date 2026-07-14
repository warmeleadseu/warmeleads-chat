-- Fase 1 (security): celebration_events / live_test_events dichtzetten.
--
-- Oud: `FOR ALL USING (true) WITH CHECK (true)` gaf ELKE rol (incl. de publieke
-- anon-key die in de browser zit) volledige lees/schrijf-toegang. Daardoor kon
-- iedereen met de anon-key sale-/omzet-payloads lezen én valse celebratie-events
-- injecteren. De admin-live-dashboard leest deze events nu via de admin-API
-- (service-role) i.p.v. realtime, dus anon heeft hier niets meer te zoeken.
--
-- Nieuw: alleen de service-role (server) mag lezen/schrijven. De service-role
-- omzeilt RLS sowieso, maar we maken het expliciet en verwijderen de brede
-- policies zodat anon/authenticated geen toegang meer hebben. Tevens halen we de
-- tabellen uit de realtime-publication zodat anon-realtime niet meer werkt.

-- celebration_events -------------------------------------------------------
ALTER TABLE celebration_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access on celebration_events" ON celebration_events;
CREATE POLICY "celebration_events service-role only"
  ON celebration_events FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- live_test_events ---------------------------------------------------------
ALTER TABLE live_test_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access on live_test_events" ON live_test_events;
CREATE POLICY "live_test_events service-role only"
  ON live_test_events FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Anon-realtime dichtzetten: tabellen uit de publication halen (idempotent).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'celebration_events'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE celebration_events';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'live_test_events'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE live_test_events';
  END IF;
END $$;
