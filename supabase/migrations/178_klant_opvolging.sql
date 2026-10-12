-- Opvolging van klanten zonder lopende batch (tabblad "Klanten terugwinnen").
-- Eén regel per contactmoment; de nieuwste regel is de huidige stand. Zo blijft
-- zichtbaar wie wanneer belde en wat er is afgesproken.

BEGIN;

CREATE TABLE IF NOT EXISTS klant_opvolging (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id    uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  status         text NOT NULL CHECK (status IN ('gebeld', 'terugbellen', 'offerte', 'niet_bereikbaar', 'geen_interesse')),
  notitie        text,
  terugbellen_op date,
  admin_id       uuid,
  admin_naam     text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS klant_opvolging_klant_idx ON klant_opvolging (customer_id, created_at DESC);
ALTER TABLE klant_opvolging ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE klant_opvolging IS
  'Contactmomenten met klanten zonder lopende batch; de nieuwste regel per klant is de huidige opvolgstatus.';

COMMIT;
