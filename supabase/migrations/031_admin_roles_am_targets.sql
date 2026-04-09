-- 1. Expand role CHECK to include 'accountmanager'
ALTER TABLE admin_users
  DROP CONSTRAINT IF EXISTS admin_users_role_check;
ALTER TABLE admin_users
  ADD CONSTRAINT admin_users_role_check
    CHECK (role IN ('superadmin', 'admin', 'accountmanager'));

-- 2. Link customers to account managers
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS account_manager_id uuid
    REFERENCES admin_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customers_am
  ON customers(account_manager_id);

-- 3. AM targets / bonuses table
CREATE TABLE IF NOT EXISTS am_targets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  label text NOT NULL,
  target_type text NOT NULL
    CHECK (target_type IN ('revenue', 'batches', 'new_customers', 'leads_delivered')),
  target_value numeric NOT NULL,
  bonus_amount numeric DEFAULT 0,
  period_start date NOT NULL,
  period_end date NOT NULL,
  notes text,
  status text DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'missed', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_am_targets_user
  ON am_targets(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_am_targets_status
  ON am_targets(status, period_end);

CREATE TRIGGER set_am_targets_updated_at
  BEFORE UPDATE ON am_targets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
