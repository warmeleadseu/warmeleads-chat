CREATE TABLE live_test_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL CHECK (event_type IN ('sales_bell', 'celebration_video', 'batch_complete', 'confetti')),
  payload jsonb DEFAULT '{}',
  consumed boolean DEFAULT false,
  created_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_live_test_events_unconsumed ON live_test_events(consumed, created_at) WHERE consumed = false;

ALTER TABLE live_test_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on live_test_events"
  ON live_test_events FOR ALL USING (true) WITH CHECK (true);
