-- Boeken in andermans agenda toestaan.
--
-- Migratie 164 maakte het mogelijk om via een portaalkoppeling een afspraak in
-- de agenda van een andere klant te zetten. De API slaat zo'n afspraak op met
-- source 'partner_booked', maar de CHECK uit 074 kende die waarde niet. Elke
-- boeking voor een ander strandde daardoor op de insert ("Aanmaken mislukt").

BEGIN;

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_source_check;

ALTER TABLE appointments ADD CONSTRAINT appointments_source_check
  CHECK (source IN (
    'admin_booked',
    'portal_owner_booked',
    'agent_booked',
    'public_self_booked',
    'partner_booked'
  ));

COMMIT;
