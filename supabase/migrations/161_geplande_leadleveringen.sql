-- ============================================================================
-- 161 — Wachtrij voor geplande leadleveringen
--
-- Aanleiding: het verzoek om een inhaalslag niet in één keer te leveren maar
-- gedoseerd, bijvoorbeeld één lead per dag gedurende een week. Dat gedoseerd
-- afleveren gebeurde tot nu toe met een script op een laptop, en dat overleeft
-- geen herstart of slaapstand. Deze tabel legt het plan vast in de database,
-- waarna /api/cron/distribute (elke 15 minuten) de rijen afwerkt die aan de
-- beurt zijn. Zo loopt de planning door zonder dat er iets openstaat.
--
-- Bewust simpel gehouden: één rij is één voorgenomen levering van één lead aan
-- één klant. De gewone verdeelregels blijven gelden op het moment van leveren
-- (doelgebied, branche, plafond van drie klanten, 30-dagen dedup). Kan een rij
-- op zijn moment niet geleverd worden, dan wordt hij gemarkeerd met de reden in
-- plaats van stilletjes te verdwijnen.
-- ============================================================================

CREATE TABLE IF NOT EXISTS geplande_leadleveringen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES customer_batches(id) ON DELETE SET NULL,

  -- Vanaf dit moment mag de cron hem leveren.
  gepland_voor timestamptz NOT NULL,

  -- gepland | geleverd | overgeslagen | geannuleerd
  status text NOT NULL DEFAULT 'gepland',
  pogingen integer NOT NULL DEFAULT 0,
  laatste_reden text,

  -- Waarom deze levering is ingepland, voor navolgbaarheid achteraf.
  reden text,
  aangemaakt_door text,

  geleverd_op timestamptz,
  assignment_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT geplande_leadleveringen_status_check
    CHECK (status IN ('gepland', 'geleverd', 'overgeslagen', 'geannuleerd')),
  -- Dezelfde lead nooit twee keer voor dezelfde klant inplannen.
  CONSTRAINT geplande_leadleveringen_uniek UNIQUE (lead_id, customer_id)
);

-- De cron zoekt telkens op "wat is er nu aan de beurt".
CREATE INDEX IF NOT EXISTS idx_geplande_leveringen_due
  ON geplande_leadleveringen (gepland_voor)
  WHERE status = 'gepland';

CREATE INDEX IF NOT EXISTS idx_geplande_leveringen_klant
  ON geplande_leadleveringen (customer_id, status);

COMMENT ON TABLE geplande_leadleveringen IS
  'Voorgenomen leadleveringen die gedoseerd worden afgewerkt door '
  '/api/cron/distribute. Zie migratie 161.';
