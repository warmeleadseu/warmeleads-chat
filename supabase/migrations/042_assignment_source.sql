-- Track how a lead was assigned to a customer (distribution vs bulk export)
ALTER TABLE lead_assignments
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'distribution';

CREATE INDEX IF NOT EXISTS idx_lead_assignments_source
  ON lead_assignments(customer_id, source);
