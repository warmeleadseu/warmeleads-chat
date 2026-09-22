-- Reclamatie op een afspraak.
--
-- WAAROM
-- ------
-- Voor leads bestond een compleet reclamatieproces, voor afspraken helemaal
-- niets. Terwijl een installateur juist voor een afspraak betaalt (85 euro per
-- stuk bij Nl-verduurzaamt), en een no-show of een adres buiten het afgesproken
-- gebied precies het geval is waarvoor je gecompenseerd wilt worden. Dat weegt
-- zwaarder nu een gekoppeld portaal afspraken voor je kan inplannen: de
-- kwaliteit ligt dan buiten je eigen controle.
--
-- Opzet gespiegeld aan lead_reclamations, zodat het beoordelen in de admin
-- dezelfde vorm heeft en niemand twee processen hoeft te leren.

CREATE TABLE IF NOT EXISTS afspraak_reclamaties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  reason text NOT NULL,
  description text,

  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  resolved_at timestamptz,

  -- Wie hem indiende, voor het geval een medewerker het deed.
  ingediend_door_portal_user_id uuid REFERENCES portal_users(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT afspraak_reclamaties_status_check
    CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT afspraak_reclamaties_reason_check
    CHECK (reason IN ('niet_verschenen', 'buiten_gebied', 'geen_interesse', 'verkeerde_gegevens', 'dubbele_afspraak', 'anders'))
);

-- Eén reclamatie per afspraak. Twee zou betekenen dat dezelfde afspraak twee
-- keer gecompenseerd kan worden.
CREATE UNIQUE INDEX IF NOT EXISTS idx_afspraak_reclamaties_uniek
  ON afspraak_reclamaties(appointment_id);

CREATE INDEX IF NOT EXISTS idx_afspraak_reclamaties_klant_status
  ON afspraak_reclamaties(customer_id, status);

COMMENT ON TABLE afspraak_reclamaties IS
  'Reclamaties op geleverde afspraken. Bij goedkeuring krijgt de klant een extra afspraak in zijn batch, net als bij leads.';

-- Compensatie: een goedgekeurde reclamatie verhoogt de batchgrootte met één,
-- zodat de klant alsnog het aantal afspraken krijgt waarvoor hij betaalde.
ALTER TABLE appointment_batches
  ADD COLUMN IF NOT EXISTS compensatie_afspraken integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN appointment_batches.compensatie_afspraken IS
  'Aantal extra afspraken toegekend uit goedgekeurde reclamaties. Telt op bij batch_size voor de werkelijke doelstelling.';
