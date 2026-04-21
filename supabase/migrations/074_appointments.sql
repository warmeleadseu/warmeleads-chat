-- Appointments feature: customers buy appointment batches, WarmeLeads or customer books them into adviser calendars
-- Parallel to leads: pricing tiers, batches, orders, assignment to portal_users

-- =====================================================================
-- 1. Extend branches with appointment pricing config
-- =====================================================================
ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS appointment_pricing_tiers JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS appointment_min_batch_size INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS appointment_nationwide_discount DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS default_appointment_duration INTEGER DEFAULT 60,
  ADD COLUMN IF NOT EXISTS default_travel_buffer INTEGER DEFAULT 30;

-- =====================================================================
-- 2. Customer-specific appointment pricing overrides
-- =====================================================================
CREATE TABLE IF NOT EXISTS customer_appointment_pricing (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  branch_slug TEXT NOT NULL REFERENCES branches(slug) ON UPDATE CASCADE,
  pricing_tiers JSONB NOT NULL DEFAULT '[]',
  nationwide_discount DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(customer_id, branch_slug)
);

CREATE INDEX IF NOT EXISTS idx_cust_appt_pricing_customer ON customer_appointment_pricing(customer_id);
CREATE INDEX IF NOT EXISTS idx_cust_appt_pricing_branch ON customer_appointment_pricing(branch_slug);

-- =====================================================================
-- 3. appointment_batches — parallel to customer_batches
-- =====================================================================
CREATE TABLE IF NOT EXISTS appointment_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  branch TEXT NOT NULL REFERENCES branches(slug) ON UPDATE CASCADE,
  batch_size INTEGER NOT NULL,
  appointments_delivered INTEGER NOT NULL DEFAULT 0,
  price_per_appointment DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  appointments_per_week INTEGER,
  appointments_per_day INTEGER,
  lead_filters JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
  is_paid BOOLEAN NOT NULL DEFAULT false,
  starts_at TIMESTAMPTZ,
  account_manager_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  mollie_payment_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appt_batches_customer ON appointment_batches(customer_id);
CREATE INDEX IF NOT EXISTS idx_appt_batches_status ON appointment_batches(status, is_paid);
CREATE INDEX IF NOT EXISTS idx_appt_batches_branch ON appointment_batches(branch);

-- =====================================================================
-- 4. appointment_orders — parallel to batch_orders (Mollie checkout)
-- =====================================================================
CREATE TABLE IF NOT EXISTS appointment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  branch TEXT NOT NULL REFERENCES branches(slug) ON UPDATE CASCADE,
  batch_size INTEGER NOT NULL,
  price_per_appointment DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  appointments_per_week INTEGER,
  appointments_per_day INTEGER,
  lead_filters JSONB DEFAULT '[]',
  notes TEXT,
  source_batch_id UUID REFERENCES appointment_batches(id) ON DELETE SET NULL,
  mollie_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'open', 'paid', 'failed', 'expired', 'cancelled')),
  paid_at TIMESTAMPTZ,
  batch_id UUID REFERENCES appointment_batches(id) ON DELETE SET NULL,
  welcome_discount_applied BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appt_orders_customer ON appointment_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_appt_orders_status ON appointment_orders(status);
CREATE INDEX IF NOT EXISTS idx_appt_orders_mollie ON appointment_orders(mollie_payment_id);

-- =====================================================================
-- 5. appointments — individual appointments
-- =====================================================================
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  portal_user_id UUID REFERENCES portal_users(id) ON DELETE SET NULL,
  branch TEXT NOT NULL REFERENCES branches(slug) ON UPDATE CASCADE,
  batch_id UUID REFERENCES appointment_batches(id) ON DELETE SET NULL,

  -- Optional lead link
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  lead_assignment_id UUID REFERENCES lead_assignments(id) ON DELETE SET NULL,

  -- Denormalized contact info (fallback if no lead link)
  contact_name TEXT NOT NULL,
  contact_phone TEXT,
  contact_email TEXT,
  street TEXT,
  house_number TEXT,
  postcode TEXT,
  city TEXT,

  -- Scheduling
  starts_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  travel_buffer_minutes INTEGER NOT NULL DEFAULT 0,

  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','no_show','cancelled','rescheduled')),
  notes TEXT,

  -- Source + audit
  source TEXT NOT NULL DEFAULT 'admin_booked' CHECK (source IN ('admin_booked','portal_owner_booked','agent_booked','public_self_booked')),
  created_by_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  created_by_portal_user_id UUID REFERENCES portal_users(id) ON DELETE SET NULL,

  -- State flags
  cancelled_at TIMESTAMPTZ,
  cancelled_reason TEXT,
  completed_at TIMESTAMPTZ,
  rescheduled_from_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  reminder_sent_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appt_customer_starts ON appointments(customer_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_appt_portaluser_starts ON appointments(portal_user_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_appt_batch ON appointments(batch_id);
CREATE INDEX IF NOT EXISTS idx_appt_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appt_branch ON appointments(branch);
CREATE INDEX IF NOT EXISTS idx_appt_lead ON appointments(lead_id);
CREATE INDEX IF NOT EXISTS idx_appt_reminder ON appointments(reminder_sent_at, starts_at) WHERE status = 'scheduled' AND reminder_sent_at IS NULL;

-- =====================================================================
-- 6. adviser_availability — weekly recurring schedule
-- =====================================================================
CREATE TABLE IF NOT EXISTS adviser_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  portal_user_id UUID REFERENCES portal_users(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_avail_customer ON adviser_availability(customer_id);
CREATE INDEX IF NOT EXISTS idx_avail_portaluser ON adviser_availability(portal_user_id);
CREATE INDEX IF NOT EXISTS idx_avail_day ON adviser_availability(customer_id, day_of_week);

-- =====================================================================
-- 7. availability_overrides — date-specific blocks/extras
-- =====================================================================
CREATE TABLE IF NOT EXISTS availability_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  portal_user_id UUID REFERENCES portal_users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  type TEXT NOT NULL CHECK (type IN ('blocked','extra')),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_avail_overrides_customer_date ON availability_overrides(customer_id, date);
CREATE INDEX IF NOT EXISTS idx_avail_overrides_portaluser_date ON availability_overrides(portal_user_id, date);

-- =====================================================================
-- 8. RLS policies (service role full access, consistent with project pattern)
-- =====================================================================
ALTER TABLE customer_appointment_pricing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON customer_appointment_pricing;
CREATE POLICY "Service role full access" ON customer_appointment_pricing FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE appointment_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON appointment_batches;
CREATE POLICY "Service role full access" ON appointment_batches FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE appointment_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON appointment_orders;
CREATE POLICY "Service role full access" ON appointment_orders FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON appointments;
CREATE POLICY "Service role full access" ON appointments FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE adviser_availability ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON adviser_availability;
CREATE POLICY "Service role full access" ON adviser_availability FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE availability_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON availability_overrides;
CREATE POLICY "Service role full access" ON availability_overrides FOR ALL USING (auth.role() = 'service_role');

-- =====================================================================
-- 9. updated_at triggers for mutation tables
-- =====================================================================
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_appointments_updated_at ON appointments;
CREATE TRIGGER trg_appointments_updated_at BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_appt_batches_updated_at ON appointment_batches;
CREATE TRIGGER trg_appt_batches_updated_at BEFORE UPDATE ON appointment_batches
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_appt_orders_updated_at ON appointment_orders;
CREATE TRIGGER trg_appt_orders_updated_at BEFORE UPDATE ON appointment_orders
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_adviser_avail_updated_at ON adviser_availability;
CREATE TRIGGER trg_adviser_avail_updated_at BEFORE UPDATE ON adviser_availability
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_cust_appt_pricing_updated_at ON customer_appointment_pricing;
CREATE TRIGGER trg_cust_appt_pricing_updated_at BEFORE UPDATE ON customer_appointment_pricing
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
