-- Track how many times a lead has been exported/sold as bulk
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS bulk_export_count integer DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_leads_bulk_export_count
  ON leads(bulk_export_count);

-- Log each bulk export operation
CREATE TABLE IF NOT EXISTS lead_exports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  admin_name text,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  customer_name text,
  lead_count integer NOT NULL DEFAULT 0,
  added_to_portal boolean DEFAULT false,
  format text NOT NULL DEFAULT 'csv' CHECK (format IN ('csv', 'xlsx')),
  filters jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_exports_created
  ON lead_exports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_exports_customer
  ON lead_exports(customer_id);

ALTER TABLE lead_exports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on lead_exports"
  ON lead_exports FOR ALL USING (true) WITH CHECK (true);

-- RPC to atomically increment bulk_export_count for a batch of leads
CREATE OR REPLACE FUNCTION increment_bulk_export_count(lead_ids uuid[])
RETURNS void
LANGUAGE sql
AS $$
  UPDATE leads
  SET bulk_export_count = COALESCE(bulk_export_count, 0) + 1
  WHERE id = ANY(lead_ids);
$$;
