-- ============================================================
-- 011: Comprehensive upgrade - audit log, roles, email prefs,
--      lead feedback, quality score, performance indexes
-- ============================================================

-- ── Performance indexes ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_leads_branch_created ON leads(branch, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status_created ON leads(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_lat_lng ON leads(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_phone_valid ON leads(phone_valid);
CREATE INDEX IF NOT EXISTS idx_lead_assignments_customer ON lead_assignments(customer_id);
CREATE INDEX IF NOT EXISTS idx_lead_assignments_batch ON lead_assignments(batch_id);
CREATE INDEX IF NOT EXISTS idx_lead_assignments_lead ON lead_assignments(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_assignments_assigned_at ON lead_assignments(assigned_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_batches_status ON customer_batches(status);
CREATE INDEX IF NOT EXISTS idx_customer_batches_branch_status ON customer_batches(branch, status);
CREATE INDEX IF NOT EXISTS idx_customer_targets_customer ON customer_targets(customer_id, is_active);

-- ── Audit log table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  admin_name text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb DEFAULT '{}',
  ip_address text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_admin ON audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);

-- ── Customer email notification preferences ──────────────────
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email_notifications boolean DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS notification_frequency text DEFAULT 'instant'
  CHECK (notification_frequency IN ('instant', 'daily', 'weekly'));

-- ── Lead feedback ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_feedback (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  rating text NOT NULL CHECK (rating IN ('goed_contact', 'onbereikbaar', 'niet_geinteresseerd', 'fout_nummer', 'verkocht')),
  comment text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(lead_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_feedback_lead ON lead_feedback(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_feedback_customer ON lead_feedback(customer_id);
CREATE INDEX IF NOT EXISTS idx_lead_feedback_rating ON lead_feedback(rating);

-- ── Lead quality score ───────────────────────────────────────
ALTER TABLE leads ADD COLUMN IF NOT EXISTS quality_score integer;

-- ── Rate limiting table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS rate_limits (
  key text PRIMARY KEY,
  count integer DEFAULT 1,
  window_start timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);

-- ── Push subscription for PWA ────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(customer_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subs_customer ON push_subscriptions(customer_id);
