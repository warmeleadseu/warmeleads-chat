-- Portaal: voorkeur CRM-systeem per klant (integraties-tab)
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS preferred_crm_provider text;

COMMENT ON COLUMN customers.preferred_crm_provider IS
  'Gekozen CRM voor portaal-integraties (bijv. teamleader, hubspot).';
