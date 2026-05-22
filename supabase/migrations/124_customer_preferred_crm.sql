-- Portaal: voorkeur CRM (optioneel; primaire opslag is customer_integrations provider crm_preference)
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS preferred_crm_provider text;

COMMENT ON COLUMN customers.preferred_crm_provider IS
  'Optionele denormalisatie; live voorkeur staat in customer_integrations (provider crm_preference).';
