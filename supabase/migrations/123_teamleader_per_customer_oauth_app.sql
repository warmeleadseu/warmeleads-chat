-- Bring-Your-Own OAuth-app per klant.
-- Klanten registreren zelf een (gratis) private integratie in hun eigen
-- Teamleader Focus, plakken client_id + client_secret in het portaal en
-- doen daarna OAuth. Warme Leads heeft geen eigen Teamleader-account nodig.

ALTER TABLE customer_integrations
  ADD COLUMN IF NOT EXISTS client_id_enc text,
  ADD COLUMN IF NOT EXISTS client_secret_enc text;

COMMENT ON COLUMN customer_integrations.client_id_enc IS
  'OAuth client_id van de klant-eigen Teamleader integratie (encrypted).';
COMMENT ON COLUMN customer_integrations.client_secret_enc IS
  'OAuth client_secret van de klant-eigen Teamleader integratie (encrypted).';
