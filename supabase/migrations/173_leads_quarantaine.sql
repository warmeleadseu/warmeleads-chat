-- Quarantaine voor leads die de scheldwoordfilter tegenhoudt.
--
-- Tot nu toe werd zo'n lead verwijderd (verdeel-cron), geweigerd met een
-- foutcode (binnenkomende webhook) of overgeslagen (Meta-inhaalslag), zonder
-- enig spoor. De woordenlijst bevat ook gewone achternamen ("Pik", "Van
-- Reet"); een echte lead kon zo ongemerkt verdwijnen. Nu wordt hij hier
-- volledig bewaard en beslist een beheerder: vrijgeven of afwijzen.

BEGIN;

CREATE TABLE IF NOT EXISTS leads_quarantaine (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at             timestamptz NOT NULL DEFAULT now(),
  -- Waar de lead werd tegengehouden: webhook, verdeel_cron, meta_inhaalslag.
  route                  text NOT NULL,
  -- Welk woord in welk veld, bijvoorbeeld: "pik" in naam_klant.
  reden                  text NOT NULL,
  -- De volledige lead, zoals hij zou zijn opgeslagen of zoals hij er stond.
  lead                   jsonb NOT NULL,
  oorspronkelijk_lead_id uuid,
  meta_leadgen_id        text,
  status                 text NOT NULL DEFAULT 'open'
                           CHECK (status IN ('open', 'vrijgegeven', 'afgewezen')),
  beoordeeld_op          timestamptz,
  beoordeeld_door        text,
  vrijgegeven_lead_id    uuid
);

-- De inhaalslag probeert een ontbrekende Meta-lead elke dag opnieuw; één
-- quarantainerij per Meta-lead is genoeg.
CREATE UNIQUE INDEX IF NOT EXISTS leads_quarantaine_leadgen_uniek
  ON leads_quarantaine (meta_leadgen_id)
  WHERE meta_leadgen_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS leads_quarantaine_status_idx
  ON leads_quarantaine (status, created_at DESC);

-- Alleen de server (service role) mag erbij; persoonsgegevens.
ALTER TABLE leads_quarantaine ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE leads_quarantaine IS
  'Leads tegengehouden door de scheldwoordfilter; bewaard tot een beheerder ze vrijgeeft of afwijst.';

COMMIT;
