-- Create lead_reclamations table for portal complaints
CREATE TABLE IF NOT EXISTS lead_reclamations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  resolved_at TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Make sheet_row_number nullable if it exists from older schema
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lead_reclamations' AND column_name = 'sheet_row_number'
  ) THEN
    ALTER TABLE lead_reclamations ALTER COLUMN sheet_row_number DROP NOT NULL;
  END IF;
END $$;

-- Add admin_notes if missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lead_reclamations' AND column_name = 'admin_notes'
  ) THEN
    ALTER TABLE lead_reclamations ADD COLUMN admin_notes TEXT;
  END IF;
END $$;

-- Unique constraint: one reclamation per lead per customer
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lead_reclamations_lead_customer_unique'
  ) THEN
    ALTER TABLE lead_reclamations ADD CONSTRAINT lead_reclamations_lead_customer_unique UNIQUE (lead_id, customer_id);
  END IF;
END $$;

-- RLS
ALTER TABLE lead_reclamations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON lead_reclamations;
CREATE POLICY "Service role full access" ON lead_reclamations FOR ALL USING (auth.role() = 'service_role');
