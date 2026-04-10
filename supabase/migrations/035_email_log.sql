CREATE TABLE IF NOT EXISTS email_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type text NOT NULL,
  to_email text NOT NULL,
  to_name text,
  subject text NOT NULL,
  html text NOT NULL,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  error text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_email_log_created ON email_log(created_at DESC);
CREATE INDEX idx_email_log_type ON email_log(type);
CREATE INDEX idx_email_log_to ON email_log(to_email);
CREATE INDEX idx_email_log_status ON email_log(status);
