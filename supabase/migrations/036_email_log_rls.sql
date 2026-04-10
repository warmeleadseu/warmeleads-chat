ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on email_log"
  ON email_log
  FOR ALL
  USING (true)
  WITH CHECK (true);
