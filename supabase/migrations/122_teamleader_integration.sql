-- Teamleader Focus: per-klant OAuth + sync log (alleen server-side)

CREATE TABLE IF NOT EXISTS customer_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'teamleader',
  access_token_enc text,
  refresh_token_enc text,
  expires_at timestamptz,
  settings jsonb NOT NULL DEFAULT '{"enabled":true}'::jsonb,
  connected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_customer_integrations_customer
  ON customer_integrations(customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_integrations_provider
  ON customer_integrations(provider) WHERE provider = 'teamleader';

CREATE TABLE IF NOT EXISTS integration_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES lead_assignments(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'teamleader',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'success', 'failed')),
  teamleader_contact_id text,
  teamleader_deal_id text,
  error_message text,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_integration_sync_log_customer_created
  ON integration_sync_log(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_integration_sync_log_failed
  ON integration_sync_log(status, attempts)
  WHERE status = 'failed';

COMMENT ON TABLE customer_integrations IS 'OAuth tokens per klant per externe provider (encrypted at rest in app layer).';
COMMENT ON TABLE integration_sync_log IS 'Idempotente log per lead_assignment → Teamleader sync.';
