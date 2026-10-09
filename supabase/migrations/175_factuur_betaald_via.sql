-- Hoe een factuur op "betaald" kwam: doordat de klant via Mollie betaalde, of
-- doordat wij hem met de hand op betaald zetten (bijvoorbeeld omdat de klant
-- een factuur uit Rompslomp betaalde). Voor de boekhouding moet dat te
-- scheiden zijn: een handmatig betaald gezette factuur staat ook in
-- Rompslomp en mag niet dubbel worden meegenomen.
--
-- Tot nu toe was het niet terug te zien: "Markeer als betaald" liet een
-- eventueel Mollie-ID van de betaallink gewoon staan.

BEGIN;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS betaald_via text
    CHECK (betaald_via IS NULL OR betaald_via IN ('mollie', 'handmatig')),
  ADD COLUMN IF NOT EXISTS betaald_door text;

COMMENT ON COLUMN invoices.betaald_via IS
  'mollie: klant betaalde via Mollie; handmatig: door ons op betaald gezet. Leeg bij een betaalde factuur: nog niet vastgesteld (controle bij Mollie).';

/* Wat al zeker is: een factuur zonder Mollie-betaling, of met de markering
   die het beheer zet bij een batch die met de hand op betaald gaat. */
UPDATE invoices
SET betaald_via = 'handmatig'
WHERE status = 'paid'
  AND betaald_via IS NULL
  AND (mollie_payment_id IS NULL OR mollie_payment_id LIKE 'admin-manual%');

COMMIT;
