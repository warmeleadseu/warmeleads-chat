-- Sequential invoice number generator
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START WITH 1 INCREMENT BY 1;

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number text UNIQUE NOT NULL,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  batch_order_id uuid REFERENCES batch_orders(id) ON DELETE SET NULL,
  batch_id uuid REFERENCES customer_batches(id) ON DELETE SET NULL,

  -- Snapshot of details at time of invoicing
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_address text,
  customer_vat_id text,

  description text NOT NULL,
  line_items jsonb NOT NULL DEFAULT '[]',

  subtotal decimal(10,2) NOT NULL,
  btw_percentage decimal(5,2) NOT NULL DEFAULT 21,
  btw_amount decimal(10,2) NOT NULL,
  total_incl_btw decimal(10,2) NOT NULL,

  mollie_payment_id text,
  status text DEFAULT 'paid' CHECK (status IN ('paid', 'credit_note')),
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices(created_at DESC);

-- Company details for invoices (stored in app_settings)
INSERT INTO app_settings (key, value) VALUES
  ('company_name', 'WarmeLeads'),
  ('company_address', ''),
  ('company_postcode', ''),
  ('company_city', ''),
  ('company_kvk', ''),
  ('company_btw', ''),
  ('company_iban', ''),
  ('company_email', 'info@warmeleads.eu')
ON CONFLICT (key) DO NOTHING;
