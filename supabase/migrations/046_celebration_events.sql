-- Persistent celebration events queue (shown on live dashboard, survives page close)
CREATE TABLE IF NOT EXISTS celebration_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL CHECK (event_type IN ('sale', 'batch_complete', 'target_hit', 'milestone')),
  payload jsonb DEFAULT '{}',
  displayed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_celebration_events_undisplayed
  ON celebration_events(created_at) WHERE displayed_at IS NULL;

ALTER TABLE celebration_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on celebration_events"
  ON celebration_events FOR ALL USING (true) WITH CHECK (true);

-- Enable Supabase Realtime for celebration tables
ALTER publication supabase_realtime ADD TABLE celebration_events;
ALTER publication supabase_realtime ADD TABLE live_test_events;

-- One-time target-hit detection flag
ALTER TABLE am_targets ADD COLUMN IF NOT EXISTS celebrated boolean DEFAULT false;
