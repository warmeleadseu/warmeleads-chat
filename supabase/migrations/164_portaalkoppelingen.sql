-- Afspraken inboeken bij een ánder klantportaal.
--
-- WAAROM
-- ------
-- Infinite Scale krijgt leads van ons in hun portaal, belt die na en maakt er
-- afspraken van. Die afspraak hoort niet in hun eigen agenda maar in die van de
-- klant die de afspraak bij ons afneemt: zij zijn het callcenter, niet de partij
-- die op bezoek gaat. Tot nu toe kon dat niet, en ging het buiten het systeem om.
--
-- Een koppeling is bewust gericht (van bron naar doel) en niet wederkerig: dat
-- Infinite Scale voor installateur X mag boeken, betekent niet dat X ook in de
-- agenda van Infinite Scale mag.
--
-- De twee instellingen die over geld en over gegevens gaan staan per koppeling
-- en niet globaal, omdat de afspraken per partij kunnen verschillen.

CREATE TABLE IF NOT EXISTS portaalkoppelingen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Wie mag boeken, en bij wie.
  bron_customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  doel_customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Leeg = alle branches. Anders alleen deze.
  branches text[],

  -- Telt een zo geboekte afspraak mee in de afsprakenbatch van de doelklant,
  -- en wordt hij dus gefactureerd? Standaard ja, want dat is de bedoeling.
  verbruikt_batch boolean NOT NULL DEFAULT true,

  -- Mag de doelklant de lead achter de afspraak inzien (naam, telefoon, adres)?
  -- Standaard nee: dat is feitelijk een leadlevering en moet een bewuste keuze
  -- zijn. Staat dit uit, dan krijgt de doelklant alleen de contactgegevens die
  -- bij de afspraak zelf horen.
  deelt_leadgegevens boolean NOT NULL DEFAULT false,

  -- Mag de bron de afspraak na het boeken nog verzetten of annuleren? Standaard
  -- alleen zolang de doelklant hem niet heeft bevestigd. Anders verandert een
  -- callcenter de agenda van een installateur zonder dat die het merkt.
  mag_wijzigen_tot_bevestiging boolean NOT NULL DEFAULT true,

  actief boolean NOT NULL DEFAULT true,
  notities text,
  aangemaakt_door_admin_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Bij zichzelf boeken is gewoon de bestaande agenda; dat is geen koppeling.
  CONSTRAINT portaalkoppelingen_niet_naar_zichzelf CHECK (bron_customer_id <> doel_customer_id)
);

-- Eén koppeling per richting per paar. Een tweede rij zou betekenen dat twee
-- verschillende sets instellingen tegelijk gelden, en dan is niet te zeggen
-- welke wint.
CREATE UNIQUE INDEX IF NOT EXISTS idx_portaalkoppelingen_paar
  ON portaalkoppelingen(bron_customer_id, doel_customer_id);

CREATE INDEX IF NOT EXISTS idx_portaalkoppelingen_bron
  ON portaalkoppelingen(bron_customer_id) WHERE actief;

COMMENT ON TABLE portaalkoppelingen IS
  'Geeft een klantportaal het recht afspraken in te boeken in de agenda van een ander klantportaal. Gericht, niet wederkerig.';

-- ── Herkomst van een afspraak ─────────────────────────────────────────────
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS geboekt_door_customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS geboekt_door_portal_user_id uuid REFERENCES portal_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bevestigd_at timestamptz,
  ADD COLUMN IF NOT EXISTS koppeling_id uuid REFERENCES portaalkoppelingen(id) ON DELETE SET NULL;

COMMENT ON COLUMN appointments.geboekt_door_customer_id IS
  'Gevuld wanneer een ander portaal deze afspraak heeft ingeboekt. Leeg bij een afspraak die de klant zelf maakte.';
COMMENT ON COLUMN appointments.bevestigd_at IS
  'Wanneer de ontvangende klant de afspraak bevestigde. Daarna mag de boekende partij hem niet meer wijzigen.';

-- Voor het overzicht "wat heb ik weggeboekt" aan de kant van de bron.
CREATE INDEX IF NOT EXISTS idx_appointments_geboekt_door
  ON appointments(geboekt_door_customer_id, starts_at)
  WHERE geboekt_door_customer_id IS NOT NULL;
