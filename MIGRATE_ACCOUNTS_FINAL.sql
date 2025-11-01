-- =============================================
-- FORCE SCHEMA CACHE REFRESH + MIGRATE ACCOUNTS
-- =============================================
-- Run this in Supabase SQL Editor

-- Step 1: Force PostgREST to reload schema cache
COMMENT ON TABLE users IS 'User accounts - force cache reload';
COMMENT ON TABLE companies IS 'Company records - force cache reload';
NOTIFY pgrst, 'reload schema';

-- Step 2: Migrate hardcoded accounts
-- Account 1: demo@warmeleads.eu
INSERT INTO users (
  email, password_hash, name, company, phone, role,
  can_view_leads, can_view_orders, can_manage_employees, can_checkout,
  is_active, needs_password_reset, created_at, updated_at
) VALUES (
  'demo@warmeleads.eu',
  '$2b$10$P8Lkq49/h65qIeLl7mTaTO0eYcYHtXxnbgy4kVsfFOJHGFUByqTPi',
  'Demo User',
  'Demo Company',
  '+31 85 047 7067',
  'owner',
  true, true, true, true,
  true, false, NOW(), NOW()
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  name = EXCLUDED.name,
  company = EXCLUDED.company,
  phone = EXCLUDED.phone,
  updated_at = NOW();

INSERT INTO companies (owner_email, company_name, created_at, updated_at)
VALUES ('demo@warmeleads.eu', 'Demo Company', NOW(), NOW())
ON CONFLICT (owner_email) DO UPDATE SET
  company_name = EXCLUDED.company_name,
  updated_at = NOW();

-- Account 2: h.schlimback@gmail.com
INSERT INTO users (
  email, password_hash, name, company, phone, role,
  can_view_leads, can_view_orders, can_manage_employees, can_checkout,
  is_active, needs_password_reset, created_at, updated_at
) VALUES (
  'h.schlimback@gmail.com',
  '$2b$10$OyWQjIrUog3XOqff5CdjTeTERzrdUhsN34OSEW6FQpkDEgxJRawde',
  'H Schlimback',
  'WarmeLeads BV',
  '+31 61 392 7338',
  'owner',
  true, true, true, true,
  true, false, NOW(), NOW()
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  name = EXCLUDED.name,
  company = EXCLUDED.company,
  phone = EXCLUDED.phone,
  updated_at = NOW();

INSERT INTO companies (owner_email, company_name, created_at, updated_at)
VALUES ('h.schlimback@gmail.com', 'WarmeLeads BV', NOW(), NOW())
ON CONFLICT (owner_email) DO UPDATE SET
  company_name = EXCLUDED.company_name,
  updated_at = NOW();

-- Account 3: rick@warmeleads.eu
INSERT INTO users (
  email, password_hash, name, company, phone, role,
  can_view_leads, can_view_orders, can_manage_employees, can_checkout,
  is_active, needs_password_reset, created_at, updated_at
) VALUES (
  'rick@warmeleads.eu',
  '$2b$10$U71yztto2Tuj/1OPWHEvYOg6nYToBznblpRjXuLPVLgMvb/eGYujO',
  'Rick',
  'WarmeLeads BV',
  '+31 61 392 7338',
  'owner',
  true, true, true, true,
  true, false, NOW(), NOW()
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  name = EXCLUDED.name,
  company = EXCLUDED.company,
  phone = EXCLUDED.phone,
  updated_at = NOW();

INSERT INTO companies (owner_email, company_name, created_at, updated_at)
VALUES ('rick@warmeleads.eu', 'WarmeLeads BV', NOW(), NOW())
ON CONFLICT (owner_email) DO UPDATE SET
  company_name = EXCLUDED.company_name,
  updated_at = NOW();

-- Step 3: Verify migration
SELECT 
  email, 
  name, 
  role, 
  company,
  created_at
FROM users 
ORDER BY created_at DESC;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Migration complete! All hardcoded accounts have been migrated to Supabase.';
  RAISE NOTICE 'You can now remove the hardcoded accounts from your code.';
END $$;

