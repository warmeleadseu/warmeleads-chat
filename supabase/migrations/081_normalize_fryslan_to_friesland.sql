-- PDOK levert de provincie als 'Fryslân' (officiële Friese spelling), maar
-- voor exports, filters en dashboards hanteren we consequent 'Friesland'.
-- We zetten alle historische varianten om en repareren ook lead_history en
-- de provincie-velden in webhook_keys / customer_branches voor zover die
-- ergens 'Fryslân' bevatten.

UPDATE leads
SET provincie = 'Friesland'
WHERE provincie IN ('Fryslân', 'Fryslan', 'Fryslàn');

-- lead_history (snapshots van leadwijzigingen, voor zover aanwezig)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lead_history') THEN
    EXECUTE $sql$
      UPDATE lead_history
      SET provincie = 'Friesland'
      WHERE provincie IN ('Fryslân', 'Fryslan', 'Fryslàn')
    $sql$;
  END IF;
END $$;
