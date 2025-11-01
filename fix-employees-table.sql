-- Force PostgREST schema cache refresh voor employees table
-- Run dit in Supabase SQL Editor

-- Method 1: Force cache reload
COMMENT ON TABLE employees IS 'Employee management - cache refresh';
NOTIFY pgrst, 'reload schema';

-- Method 2: Recreate if needed (safe - won't delete data if exists)
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  owner_email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee',
  
  -- Permissions
  can_view_leads BOOLEAN DEFAULT true,
  can_view_orders BOOLEAN DEFAULT true,
  can_manage_employees BOOLEAN DEFAULT false,
  can_checkout BOOLEAN DEFAULT true,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  needs_password_reset BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Verify it exists
SELECT COUNT(*) as employee_count FROM employees;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Employees table verified/created successfully';
END $$;

