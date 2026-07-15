-- Phase 6: lead activity timeline for CRM audit trail

CREATE TABLE IF NOT EXISTS lead_activities (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('admin', 'portal_user', 'system', 'cron')),
  actor_id uuid,
  actor_name text,
  action text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_created
  ON lead_activities (lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_activities_customer_created
  ON lead_activities (customer_id, created_at DESC)
  WHERE customer_id IS NOT NULL;

ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on lead_activities"
  ON lead_activities FOR ALL
  USING (auth.role() = 'service_role');
