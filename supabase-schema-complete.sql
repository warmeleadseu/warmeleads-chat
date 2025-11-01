-- Uitgebreid WarmeLeads Database Schema voor Supabase
-- Volledige migratie van Blob Storage naar Supabase

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS & AUTHENTICATION
-- ============================================

-- Users table (accounts) - ALREADY CREATED
-- Keeping existing structure

-- ============================================
-- CUSTOMERS & CRM
-- ============================================

-- Customers table - voor CRM systeem
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  phone TEXT,
  company TEXT,
  status TEXT NOT NULL DEFAULT 'lead' CHECK (status IN ('lead', 'contacted', 'customer', 'inactive')),
  source TEXT NOT NULL DEFAULT 'direct' CHECK (source IN ('chat', 'direct', 'landing_page')),
  
  -- Account koppeling
  has_account BOOLEAN DEFAULT false,
  account_created_at TIMESTAMPTZ,
  
  -- Google Sheets integratie
  google_sheet_id TEXT,
  google_sheet_url TEXT,
  
  -- Email notificaties
  email_notifications_enabled BOOLEAN DEFAULT true,
  email_notifications_new_leads BOOLEAN DEFAULT true,
  last_notification_sent TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('lisa', 'user')),
  content TEXT NOT NULL,
  step TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Data changes history
CREATE TABLE IF NOT EXISTS data_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('chat', 'form', 'admin')),
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ORDERS & INVOICES
-- ============================================

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_email TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_company TEXT,
  
  -- Package details
  package_id TEXT NOT NULL,
  package_name TEXT NOT NULL,
  industry TEXT NOT NULL,
  lead_type TEXT NOT NULL CHECK (lead_type IN ('exclusive', 'shared')),
  quantity INTEGER NOT NULL,
  
  -- Pricing (all in cents)
  price_per_lead INTEGER NOT NULL,
  total_amount INTEGER NOT NULL, -- excl VAT
  vat_amount INTEGER NOT NULL,
  total_amount_incl_vat INTEGER NOT NULL,
  vat_percentage DECIMAL(5,2) NOT NULL DEFAULT 21,
  currency TEXT DEFAULT 'EUR',
  
  -- Payment
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'delivered', 'cancelled')),
  payment_method TEXT,
  payment_intent_id TEXT,
  session_id TEXT,
  stripe_session_id TEXT,
  stripe_payment_intent_id TEXT,
  
  -- Invoice
  invoice_number TEXT,
  invoice_url TEXT,
  
  -- Delivery
  leads_delivered INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  delivered_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Open invoices (draft orders waiting for payment)
CREATE TABLE IF NOT EXISTS open_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  customer_email TEXT NOT NULL,
  industry TEXT NOT NULL,
  lead_type TEXT NOT NULL,
  quantity TEXT NOT NULL,
  amount TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'overdue', 'abandoned')),
  reminder_count INTEGER DEFAULT 0,
  last_reminder_sent TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- LEADS
-- ============================================

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Contact info
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  company TEXT,
  address TEXT,
  city TEXT,
  
  -- Lead details
  interest TEXT NOT NULL,
  budget TEXT,
  timeline TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'converted', 'deal_closed', 'lost')),
  
  -- Financial
  deal_value DECIMAL(10,2),
  profit DECIMAL(10,2),
  
  -- Assignment
  assigned_to TEXT,
  source TEXT NOT NULL DEFAULT 'campaign' CHECK (source IN ('campaign', 'manual', 'import')),
  sheet_row_number INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Branch-specific lead data (thuisbatterijen, zonnepanelen, etc.)
CREATE TABLE IF NOT EXISTS lead_branch_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  
  -- Thuisbatterijen
  datum_interesse TEXT,
  postcode TEXT,
  huisnummer TEXT,
  zonnepanelen TEXT,
  dynamisch_contract TEXT,
  stroomverbruik TEXT,
  nieuwsbrief TEXT,
  reden_thuisbatterij TEXT,
  koopintentie TEXT,
  
  -- Zonnepanelen
  dakoppervlak TEXT,
  dakrichting TEXT,
  schaduw TEXT,
  
  -- Warmtepompen
  huisgrootte TEXT,
  isolatie TEXT,
  huidige_verwarming TEXT,
  
  -- Financial Lease
  bedrijfsomvang TEXT,
  branche TEXT,
  krediet_score TEXT,
  
  -- Generic fields (JSON for flexibility)
  custom_data JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USER PREFERENCES
-- ============================================

CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  preferences JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(customer_id)
);

-- ============================================
-- LEAD RECLAMATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS lead_reclamations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  sheet_row_number INTEGER NOT NULL,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PRICING CONFIGURATION
-- ============================================

CREATE TABLE IF NOT EXISTS pricing_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id TEXT UNIQUE NOT NULL,
  branch_name TEXT NOT NULL,
  
  -- Exclusive pricing
  exclusive_base_price DECIMAL(10,2) NOT NULL,
  exclusive_tiers JSONB NOT NULL, -- Array of {minQuantity, pricePerLead, discount}
  
  -- Shared pricing
  shared_base_price DECIMAL(10,2) NOT NULL,
  shared_min_quantity INTEGER NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Customers
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_source ON customers(source);
CREATE INDEX IF NOT EXISTS idx_customers_has_account ON customers(has_account);

-- Chat messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_customer_id ON chat_messages(customer_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp DESC);

-- Orders
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);

-- Leads
CREATE INDEX IF NOT EXISTS idx_leads_customer_id ON leads(customer_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);

-- Lead branch data
CREATE INDEX IF NOT EXISTS idx_lead_branch_data_lead_id ON lead_branch_data(lead_id);

-- Open invoices
CREATE INDEX IF NOT EXISTS idx_open_invoices_customer_id ON open_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_open_invoices_status ON open_invoices(status);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function om updated_at automatisch bij te werken
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at timestamps
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lead_branch_data_updated_at BEFORE UPDATE ON lead_branch_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_open_invoices_updated_at BEFORE UPDATE ON open_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lead_reclamations_updated_at BEFORE UPDATE ON lead_reclamations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pricing_config_updated_at BEFORE UPDATE ON pricing_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE open_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_branch_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_reclamations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_config ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access" ON customers FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON chat_messages FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON data_changes FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON orders FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON open_invoices FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON leads FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON lead_branch_data FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON user_preferences FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON lead_reclamations FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON pricing_config FOR ALL USING (auth.role() = 'service_role');

-- Users can view their own data
CREATE POLICY "Users can view own customer data" ON customers FOR SELECT 
  USING (email = current_setting('request.jwt.claims', true)::json->>'email');

CREATE POLICY "Users can view own orders" ON orders FOR SELECT 
  USING (customer_email = current_setting('request.jwt.claims', true)::json->>'email');

CREATE POLICY "Users can view own leads" ON leads FOR SELECT 
  USING (customer_id IN (SELECT id FROM customers WHERE email = current_setting('request.jwt.claims', true)::json->>'email'));

