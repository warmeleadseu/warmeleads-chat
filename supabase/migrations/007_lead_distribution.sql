-- ============================================================
-- Smart Lead Distribution System
-- ============================================================

-- 1. Add coordinates to leads for geo-matching
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lng double precision;

CREATE INDEX idx_leads_lat_lng ON leads(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- 2. Customer target areas
CREATE TABLE customer_targets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  radius_km integer NOT NULL DEFAULT 25,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_customer_targets_customer ON customer_targets(customer_id);
CREATE INDEX idx_customer_targets_active ON customer_targets(customer_id, is_active);

-- 3. Customer batches (purchase tracking)
CREATE TABLE customer_batches (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  branch text NOT NULL REFERENCES branches(slug) ON UPDATE CASCADE,
  batch_size integer NOT NULL,
  price_per_lead decimal(10,2),
  total_price decimal(10,2),
  leads_delivered integer DEFAULT 0,
  status text DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  notes text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_customer_batches_customer ON customer_batches(customer_id);
CREATE INDEX idx_customer_batches_status ON customer_batches(status);
CREATE INDEX idx_customer_batches_branch ON customer_batches(branch);

-- 4. Lead assignments (many-to-many: one lead → multiple customers)
CREATE TABLE lead_assignments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES customer_batches(id) ON DELETE SET NULL,
  distance_km double precision,
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(lead_id, customer_id)
);

CREATE INDEX idx_lead_assignments_lead ON lead_assignments(lead_id);
CREATE INDEX idx_lead_assignments_customer ON lead_assignments(customer_id);
CREATE INDEX idx_lead_assignments_batch ON lead_assignments(batch_id);
CREATE INDEX idx_lead_assignments_assigned ON lead_assignments(assigned_at DESC);

-- 5. Migrate existing leads that have customer_id into lead_assignments
INSERT INTO lead_assignments (lead_id, customer_id)
SELECT id, customer_id FROM leads
WHERE customer_id IS NOT NULL
ON CONFLICT DO NOTHING;
