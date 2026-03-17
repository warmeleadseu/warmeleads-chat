-- Drop old tables from previous portal implementation
DROP TABLE IF EXISTS leads CASCADE;
DROP TABLE IF EXISTS pipeline_stages CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================================
-- Admin users
-- ============================================================
CREATE TABLE admin_users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  name text NOT NULL,
  role text DEFAULT 'admin' CHECK (role IN ('admin', 'superadmin')),
  is_active boolean DEFAULT true,
  last_login timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_admin_users_email ON admin_users(email);

-- ============================================================
-- Customers (bedrijven waarvoor we leads genereren)
-- ============================================================
CREATE TABLE customers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  contact_person text,
  email text,
  phone text,
  branches text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_customers_name ON customers(name);
CREATE INDEX idx_customers_is_active ON customers(is_active);

-- ============================================================
-- Leads (unified table, branch-specific fields nullable)
-- ============================================================
CREATE TABLE leads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  branch text NOT NULL CHECK (branch IN ('thuisbatterij', 'airco')),
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,

  -- Gemeenschappelijke velden
  naam_klant text NOT NULL,
  email text,
  telefoonnummer text,
  postcode text,
  huisnummer text,
  plaatsnaam text,
  provincie text,
  wervingsdatum date DEFAULT CURRENT_DATE,
  status text DEFAULT 'nieuw' CHECK (status IN ('nieuw', 'gecontacteerd', 'offerte', 'verkocht', 'afgewezen')),
  notities text,
  bron text DEFAULT 'handmatig' CHECK (bron IN ('handmatig', 'excel_import', 'zapier')),

  -- Thuisbatterij-specifiek
  zonnepanelen text,
  dynamisch_contract text,
  stroomverbruik text,
  budget text,
  reden_thuisbatterij text,

  -- Airco-specifiek
  type_airco text,
  koelen_verwarmen text,
  hoeveel_ruimtes text,
  zakelijk text,
  koop_of_huur text,
  boorwerkzaamheden_toegestaan text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_leads_branch ON leads(branch);
CREATE INDEX idx_leads_customer_id ON leads(customer_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_bron ON leads(bron);
CREATE INDEX idx_leads_provincie ON leads(provincie);
CREATE INDEX idx_leads_wervingsdatum ON leads(wervingsdatum);
CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX idx_leads_naam_klant ON leads(naam_klant);

-- ============================================================
-- Webhook keys (voor Zapier / externe integraties)
-- ============================================================
CREATE TABLE webhook_keys (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  branch text NOT NULL CHECK (branch IN ('thuisbatterij', 'airco')),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  is_active boolean DEFAULT true,
  last_used_at timestamptz,
  request_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_webhook_keys_key ON webhook_keys(key);
CREATE INDEX idx_webhook_keys_is_active ON webhook_keys(is_active);

-- ============================================================
-- Trigger for updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER set_admin_users_updated_at
  BEFORE UPDATE ON admin_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
