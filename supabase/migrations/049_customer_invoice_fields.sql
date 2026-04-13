-- Add address and VAT fields to customers for invoice generation
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS vat_id text;
