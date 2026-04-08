-- Add pricing configuration to branches
ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS pricing_tiers JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS min_batch_size INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS nationwide_discount DECIMAL(10,2) DEFAULT 0;

-- Customer-specific pricing overrides (per branch)
CREATE TABLE IF NOT EXISTS customer_pricing (
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

CREATE INDEX IF NOT EXISTS idx_customer_pricing_customer ON customer_pricing(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_pricing_branch ON customer_pricing(branch_slug);
