-- Portal sub-users / agents system
-- Allows customer accounts to create team members with separate logins and configurable permissions

-- 1. portal_users table
CREATE TABLE IF NOT EXISTS portal_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('owner', 'manager', 'agent')),
  is_active BOOLEAN DEFAULT true,
  permissions TEXT[] DEFAULT '{}',
  assignment_rules JSONB DEFAULT '{}',
  last_login_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  login_count INTEGER DEFAULT 0,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email)
);

CREATE INDEX IF NOT EXISTS idx_portal_users_customer ON portal_users(customer_id);
CREATE INDEX IF NOT EXISTS idx_portal_users_email ON portal_users(email);
CREATE INDEX IF NOT EXISTS idx_portal_users_active ON portal_users(customer_id, is_active);

-- 2. Add portal_user_id to lead_assignments
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lead_assignments' AND column_name = 'portal_user_id'
  ) THEN
    ALTER TABLE lead_assignments ADD COLUMN portal_user_id UUID REFERENCES portal_users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_lead_assignments_portal_user ON lead_assignments(portal_user_id);

-- 3. Activity log
CREATE TABLE IF NOT EXISTS portal_user_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_user_id UUID NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pual_user ON portal_user_activity_log(portal_user_id);
CREATE INDEX IF NOT EXISTS idx_pual_customer ON portal_user_activity_log(customer_id);
CREATE INDEX IF NOT EXISTS idx_pual_created ON portal_user_activity_log(created_at DESC);

-- 4. RLS
ALTER TABLE portal_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON portal_users;
CREATE POLICY "Service role full access" ON portal_users FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE portal_user_activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON portal_user_activity_log;
CREATE POLICY "Service role full access" ON portal_user_activity_log FOR ALL USING (auth.role() = 'service_role');

-- 5. Password reset tokens: add portal_user_id support
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'password_reset_tokens' AND column_name = 'portal_user_id'
  ) THEN
    ALTER TABLE password_reset_tokens
      ALTER COLUMN customer_id DROP NOT NULL,
      ADD COLUMN portal_user_id UUID REFERENCES portal_users(id) ON DELETE CASCADE;
  END IF;
END $$;
