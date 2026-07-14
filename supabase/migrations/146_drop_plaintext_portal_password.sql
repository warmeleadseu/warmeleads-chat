-- Fase 1 (security): plaintext-wachtwoordkolom verwijderen.
--
-- `customers.portal_password` bewaarde het wachtwoord in leesbare vorm (soms de
-- bcrypt-hash, soms plaintext). Alle code schrijft/leest deze kolom niet meer:
-- - aanmaken/bewerken van klanten zet alleen `password_hash` (bcrypt);
-- - wachtwoord-reset en self-service zetten alleen `password_hash`;
-- - herinnerings-/welkomstmails sturen een veilige set/reset-link i.p.v. het
--   wachtwoord in leesbare tekst;
-- - de admin-API geeft de kolom niet meer terug.
--
-- Voer uit ná deploy van de bijbehorende code.

ALTER TABLE customers DROP COLUMN IF EXISTS portal_password;
