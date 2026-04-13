-- Add province-based targeting support to customer_targets
ALTER TABLE customer_targets
  ADD COLUMN IF NOT EXISTS target_type text NOT NULL DEFAULT 'radius'
    CHECK (target_type IN ('radius', 'province'));

ALTER TABLE customer_targets
  ADD COLUMN IF NOT EXISTS provinces text[] DEFAULT '{}';

-- Make lat/lng nullable so province targets don't need coordinates
ALTER TABLE customer_targets ALTER COLUMN lat DROP NOT NULL;
ALTER TABLE customer_targets ALTER COLUMN lng DROP NOT NULL;

-- Fast lookup for province-based matching
CREATE INDEX IF NOT EXISTS idx_customer_targets_provinces
  ON customer_targets USING GIN(provinces);

CREATE INDEX IF NOT EXISTS idx_customer_targets_type
  ON customer_targets(target_type);
