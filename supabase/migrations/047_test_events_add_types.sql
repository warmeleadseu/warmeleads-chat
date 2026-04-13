-- Expand the event_type check constraint to include target_hit and milestone
ALTER TABLE live_test_events
  DROP CONSTRAINT IF EXISTS live_test_events_event_type_check;

ALTER TABLE live_test_events
  ADD CONSTRAINT live_test_events_event_type_check
  CHECK (event_type IN ('sales_bell', 'celebration_video', 'batch_complete', 'confetti', 'target_hit', 'milestone'));
