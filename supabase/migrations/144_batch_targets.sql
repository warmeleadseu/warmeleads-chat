-- Batch-specifieke targetgebieden: overrulen de klant-targetgebieden (customer_targets)
-- voor uitsluitend die batch. Zelfde structuur als customer_targets, maar per batch.
CREATE TABLE IF NOT EXISTS batch_targets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id uuid NOT NULL REFERENCES customer_batches(id) ON DELETE CASCADE,
  label text NOT NULL,
  target_type text NOT NULL DEFAULT 'radius' CHECK (target_type IN ('radius', 'province')),
  lat double precision,
  lng double precision,
  radius_km integer DEFAULT 25,
  provinces text[] DEFAULT '{}',
  country text CHECK (country IS NULL OR country IN ('NL', 'BE')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_batch_targets_batch ON batch_targets(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_targets_active ON batch_targets(batch_id) WHERE is_active = true;

COMMENT ON TABLE batch_targets IS 'Per-batch targetgebieden die de customer_targets van de klant overrulen tijdens distributie.';
COMMENT ON COLUMN batch_targets.batch_id IS 'Batch waarvoor deze targetgebieden gelden (overruled klant-targetgebieden).';
