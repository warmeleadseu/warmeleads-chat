-- AM Mail-Compose: uitbreiden van email_log voor AM-uitgaande mails,
-- toevoegen van email_optouts (compliance), en optionele email_signature_html
-- override per admin.

-- 1. email_log uitbreiden met AM-specifieke kolommen + tracking metadata
ALTER TABLE email_log
  ADD COLUMN IF NOT EXISTS from_admin_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reply_to text,
  ADD COLUMN IF NOT EXISTS prospect_id uuid REFERENCES prospects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS template_key text,
  ADD COLUMN IF NOT EXISTS template_options jsonb,
  ADD COLUMN IF NOT EXISTS body_text text,
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS unsubscribe_token text,
  ADD COLUMN IF NOT EXISTS opens_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicks_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_clicked_at timestamptz;

-- Status uitbreiden zodat we ook 'queued' / 'bounced' / 'opt_out' kunnen loggen.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.constraint_column_usage
    WHERE table_name = 'email_log' AND constraint_name = 'email_log_status_check'
  ) THEN
    ALTER TABLE email_log DROP CONSTRAINT email_log_status_check;
  END IF;
END $$;

ALTER TABLE email_log
  ADD CONSTRAINT email_log_status_check
  CHECK (status IN ('sent', 'failed', 'queued', 'bounced', 'opt_out'));

CREATE INDEX IF NOT EXISTS idx_email_log_from_admin ON email_log(from_admin_id);
CREATE INDEX IF NOT EXISTS idx_email_log_prospect ON email_log(prospect_id);
CREATE INDEX IF NOT EXISTS idx_email_log_customer ON email_log(customer_id);
CREATE INDEX IF NOT EXISTS idx_email_log_provider_msg ON email_log(provider_message_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_log_unsub_token ON email_log(unsubscribe_token)
  WHERE unsubscribe_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_log_template ON email_log(template_key);

-- 2. email_optouts: een lijst van e-mailadressen die niet meer mogen ontvangen
-- per scope. Compleet uitschrijven = scope='all'.
CREATE TABLE IF NOT EXISTS email_optouts (
  email text NOT NULL,
  scope text NOT NULL DEFAULT 'all'
    CHECK (scope IN ('all', 'marketing', 'nurture', 'pricing')),
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  unsubscribed_via_message_id uuid REFERENCES email_log(id) ON DELETE SET NULL,
  PRIMARY KEY (email, scope)
);

CREATE INDEX IF NOT EXISTS idx_email_optouts_email ON email_optouts(email);

-- 3. admin_users.email_signature_html: optionele HTML override voor de mail-
-- handtekening. Default is een runtime-gerenderde signature.
ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS email_signature_html text;

-- 4. email_jobs: lichtgewicht job-tracker voor bulk verzendingen.
-- We laten dit in de DB staan zodat polling vanuit verschillende workers werkt
-- en de UI altijd de juiste status ziet. Status 'queued' betekent: ontvangen
-- maar nog niet verstuurd.
CREATE TABLE IF NOT EXISTS email_jobs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  template_key text NOT NULL,
  total int NOT NULL DEFAULT 0,
  sent int NOT NULL DEFAULT 0,
  failed int NOT NULL DEFAULT 0,
  opt_out int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'done', 'error')),
  options jsonb,
  audience_summary jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_email_jobs_admin ON email_jobs(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_jobs_status ON email_jobs(status);
