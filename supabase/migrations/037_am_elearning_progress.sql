-- E-learning progress tracking for account managers
CREATE TABLE am_elearning_progress (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  module_id text NOT NULL,
  lesson_id text NOT NULL,
  completed boolean DEFAULT false,
  quiz_score integer,
  quiz_answers jsonb DEFAULT '{}',
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(admin_user_id, module_id, lesson_id)
);

CREATE INDEX idx_elearning_progress_user ON am_elearning_progress(admin_user_id);

ALTER TABLE am_elearning_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on am_elearning_progress"
  ON am_elearning_progress
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER set_updated_at_elearning
  BEFORE UPDATE ON am_elearning_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
