-- Batch milestone notification tracking
ALTER TABLE customer_batches ADD COLUMN IF NOT EXISTS notified_80pct boolean DEFAULT false;
ALTER TABLE customer_batches ADD COLUMN IF NOT EXISTS notified_completed boolean DEFAULT false;
ALTER TABLE customer_batches ADD COLUMN IF NOT EXISTS notified_reminder boolean DEFAULT false;

-- Batch orders (portal self-service reorder with Mollie payment)
CREATE TABLE IF NOT EXISTS batch_orders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  branch text NOT NULL,
  batch_size integer NOT NULL,
  price_per_lead decimal(10,2) NOT NULL,
  total_price decimal(10,2) NOT NULL,
  leads_per_week integer,
  lead_filters jsonb DEFAULT '[]',
  notes text,
  source_batch_id uuid REFERENCES customer_batches(id) ON DELETE SET NULL,
  mollie_payment_id text UNIQUE,
  status text DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','expired','cancelled')),
  batch_id uuid REFERENCES customer_batches(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  paid_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_batch_orders_customer ON batch_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_batch_orders_status ON batch_orders(status);
CREATE INDEX IF NOT EXISTS idx_batch_orders_mollie ON batch_orders(mollie_payment_id);

ALTER TABLE batch_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on batch_orders"
  ON batch_orders FOR ALL
  USING (auth.role() = 'service_role');
