-- WarmeLeads Database Schema voor Supabase
-- Run dit SQL script in je Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (accounts)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, -- bcrypt hash
  name TEXT NOT NULL,
  company TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'employee')),
  company_id TEXT, -- Email of the owner (voor employee accounts)
  owner_email TEXT, -- Email of the owner (voor employee accounts)
  
  -- Permissions
  can_view_leads BOOLEAN DEFAULT true,
  can_view_orders BOOLEAN DEFAULT true,
  can_manage_employees BOOLEAN DEFAULT false,
  can_checkout BOOLEAN DEFAULT true,
  
  -- Employee account fields
  is_active BOOLEAN DEFAULT true,
  needs_password_reset BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_email TEXT UNIQUE NOT NULL,
  company_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Employees table (employee accounts linked to companies)
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  owner_email TEXT NOT NULL,
  employee_email TEXT UNIQUE NOT NULL,
  employee_name TEXT NOT NULL,
  
  -- Permissions
  can_view_leads BOOLEAN DEFAULT true,
  can_view_orders BOOLEAN DEFAULT true,
  can_manage_employees BOOLEAN DEFAULT false,
  can_checkout BOOLEAN DEFAULT false,
  
  -- Status
  is_active BOOLEAN DEFAULT false,
  needs_password_reset BOOLEAN DEFAULT true,
  
  -- Timestamps
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes voor performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_owner_email ON users(owner_email);
CREATE INDEX IF NOT EXISTS idx_companies_owner_email ON companies(owner_email);
CREATE INDEX IF NOT EXISTS idx_employees_owner_email ON employees(owner_email);
CREATE INDEX IF NOT EXISTS idx_employees_employee_email ON employees(employee_email);
CREATE INDEX IF NOT EXISTS idx_employees_company_id ON employees(company_id);

-- Function om updated_at automatisch bij te werken
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers voor updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Policy: Users kunnen alleen hun eigen data lezen
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid()::text = email OR email = current_setting('request.jwt.claims', true)::json->>'email');

-- Policy: Service role kan alles (voor API routes)
CREATE POLICY "Service role can do everything" ON users
  FOR ALL USING (auth.role() = 'service_role');

-- Policy: Companies kunnen alleen bekeken worden door de owner
CREATE POLICY "Companies viewable by owner" ON companies
  FOR SELECT USING (
    owner_email = current_setting('request.jwt.claims', true)::json->>'email' OR
    auth.role() = 'service_role'
  );

-- Policy: Service role kan alles voor companies
CREATE POLICY "Service role can manage companies" ON companies
  FOR ALL USING (auth.role() = 'service_role');

-- Policy: Employees kunnen alleen bekeken worden door de owner
CREATE POLICY "Employees viewable by owner" ON employees
  FOR SELECT USING (
    owner_email = current_setting('request.jwt.claims', true)::json->>'email' OR
    employee_email = current_setting('request.jwt.claims', true)::json->>'email' OR
    auth.role() = 'service_role'
  );

-- Policy: Service role kan alles voor employees
CREATE POLICY "Service role can manage employees" ON employees
  FOR ALL USING (auth.role() = 'service_role');

