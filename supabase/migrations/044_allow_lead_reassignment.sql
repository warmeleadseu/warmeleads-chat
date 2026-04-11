-- Allow leads to be re-assigned to the same customer after 30 days
-- by removing the unique constraint on (lead_id, customer_id).

ALTER TABLE lead_assignments
  DROP CONSTRAINT IF EXISTS lead_assignments_lead_id_customer_id_key;

-- Keep a regular index for query performance
CREATE INDEX IF NOT EXISTS idx_lead_assignments_lead_customer
  ON lead_assignments(lead_id, customer_id);

-- Index for the 30-day reassignment window lookups
CREATE INDEX IF NOT EXISTS idx_lead_assignments_assigned_at
  ON lead_assignments(lead_id, assigned_at DESC);
