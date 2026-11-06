-- Geschiedenis van de Meta-links: welke campagne wanneer aan welke batch hing.
--
-- Een batch bewaart alleen de huidige koppeling (customer_batches.meta_campaign_ids).
-- Wordt een slecht lopende campagne ontkoppeld en een nieuwe gekoppeld, dan
-- was niet meer te zien dat de leads van de oude campagne in die weken uit de
-- eigen campagne kwamen. Deze tabel legt elke koppeling vast met een begin en
-- (na ontkoppelen) een eind. De campagnepagina en het blok "Herkomst leads"
-- bij een batch tellen een lead als "uit de eigen campagne" als de campagne
-- aan de batch hing op het moment dat de lead binnenkwam.
--
-- Een trigger houdt de tabel bij, voor elke schrijfroute naar
-- meta_campaign_ids. De koppelingen van vóór deze migratie kennen we niet
-- precies: die leggen we vast vanaf het aanmaken van de batch, met
-- bron = 'startstand', zodat schermen ze als geschat kunnen tonen.
--
-- Terugdraaien:
--   DROP TRIGGER IF EXISTS meta_koppeling_bijhouden ON customer_batches;
--   DROP FUNCTION IF EXISTS meta_koppeling_bijhouden();
--   DROP TABLE IF EXISTS meta_campagne_koppelingen;

BEGIN;

CREATE TABLE IF NOT EXISTS meta_campagne_koppelingen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES customer_batches(id) ON DELETE CASCADE,
  campaign_id text NOT NULL,
  van timestamptz NOT NULL DEFAULT now(),
  tot timestamptz,
  bron text NOT NULL DEFAULT 'wijziging' CHECK (bron IN ('startstand', 'wijziging')),
  CHECK (tot IS NULL OR tot >= van)
);

COMMENT ON TABLE meta_campagne_koppelingen IS
  'Wanneer welke Meta-campagne aan welke batch gekoppeld was. tot = null: nog gekoppeld. bron startstand: van vóór 6 nov 2026, begin geschat op het aanmaken van de batch.';

CREATE UNIQUE INDEX IF NOT EXISTS meta_campagne_koppelingen_open_uniek
  ON meta_campagne_koppelingen (batch_id, campaign_id) WHERE tot IS NULL;
CREATE INDEX IF NOT EXISTS meta_campagne_koppelingen_campagne_idx
  ON meta_campagne_koppelingen (campaign_id, van);
CREATE INDEX IF NOT EXISTS meta_campagne_koppelingen_batch_idx
  ON meta_campagne_koppelingen (batch_id, van);

ALTER TABLE meta_campagne_koppelingen ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION meta_koppeling_bijhouden() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  nieuw text[] := coalesce(NEW.meta_campaign_ids, '{}');
BEGIN
  /* Ontkoppeld: de open koppeling krijgt een eind. */
  UPDATE meta_campagne_koppelingen
  SET tot = now()
  WHERE batch_id = NEW.id AND tot IS NULL AND NOT (campaign_id = ANY (nieuw));

  /* Nieuw gekoppeld: een open koppeling vanaf nu. */
  INSERT INTO meta_campagne_koppelingen (batch_id, campaign_id, van, bron)
  SELECT NEW.id, c, now(), 'wijziging'
  FROM (SELECT DISTINCT unnest(nieuw) AS c) x
  WHERE c IS NOT NULL AND c <> ''
    AND NOT EXISTS (
      SELECT 1 FROM meta_campagne_koppelingen k
      WHERE k.batch_id = NEW.id AND k.campaign_id = x.c AND k.tot IS NULL
    );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS meta_koppeling_bijhouden ON customer_batches;
CREATE TRIGGER meta_koppeling_bijhouden
  AFTER INSERT OR UPDATE OF meta_campaign_ids ON customer_batches
  FOR EACH ROW EXECUTE FUNCTION meta_koppeling_bijhouden();

/* Startstand: de koppelingen van nu, vanaf het aanmaken van de batch. */
INSERT INTO meta_campagne_koppelingen (batch_id, campaign_id, van, bron)
SELECT b.id, c, b.created_at, 'startstand'
FROM customer_batches b
CROSS JOIN LATERAL (SELECT DISTINCT unnest(b.meta_campaign_ids) AS c) x
WHERE x.c IS NOT NULL AND x.c <> ''
ON CONFLICT DO NOTHING;

COMMIT;
