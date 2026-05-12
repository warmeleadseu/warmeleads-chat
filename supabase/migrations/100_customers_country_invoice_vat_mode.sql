-- Facturatie: Belgische B2B met BTW-nummer → intracommunautaire levering (BTW verlegd).
-- customers.country: NL (default) of BE
-- invoices.vat_mode: vastleggen op moment van facturering

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'NL';

ALTER TABLE customers
  DROP CONSTRAINT IF EXISTS customers_country_check;

ALTER TABLE customers
  ADD CONSTRAINT customers_country_check
  CHECK (country IN ('NL', 'BE'));

COMMENT ON COLUMN customers.country IS 'Facturatie-land: NL = 21% NL-BTW; BE + geldig BE-BTW-nr = verleggingsregeling (0% NL-BTW op factuur).';

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS vat_mode text NOT NULL DEFAULT 'domestic_nl';

ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_vat_mode_check;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_vat_mode_check
  CHECK (vat_mode IN ('domestic_nl', 'reverse_charge_be'));

COMMENT ON COLUMN invoices.vat_mode IS 'domestic_nl: 21% NL-BTW; reverse_charge_be: BTW verlegd (intracommunautair, Belgische afnemer met BTW-nr).';
