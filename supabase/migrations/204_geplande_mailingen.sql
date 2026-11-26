-- Geplande mailingen: een mailing naar klanten die op een vast tijdstip door
-- de server wordt verstuurd, maar pas nadat een beheerder hem in het
-- admin-paneel heeft goedgekeurd (Mails > Geplande mailingen). Verstuurt via
-- het bestaande mailsysteem (sendAsAdmin): afmeldlink, opt-outs en email_log.

CREATE TABLE IF NOT EXISTS geplande_mailingen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  naam text NOT NULL,
  template_key text NOT NULL DEFAULT 'campagne',
  options jsonb NOT NULL DEFAULT '{}'::jsonb,
  ontvangers uuid[] NOT NULL DEFAULT '{}'::uuid[],
  afzender_admin_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  verstuur_op timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'concept'
    CHECK (status IN ('concept', 'goedgekeurd', 'bezig', 'verstuurd', 'geannuleerd', 'mislukt')),
  goedgekeurd_door uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  goedgekeurd_op timestamptz,
  aangemaakt_door text,
  verstuurd integer NOT NULL DEFAULT 0,
  mislukt integer NOT NULL DEFAULT 0,
  opt_out integer NOT NULL DEFAULT 0,
  fout text,
  gestart_op timestamptz,
  klaar_op timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_geplande_mailingen_klaar ON geplande_mailingen(verstuur_op) WHERE status = 'goedgekeurd';
ALTER TABLE geplande_mailingen ENABLE ROW LEVEL SECURITY;
