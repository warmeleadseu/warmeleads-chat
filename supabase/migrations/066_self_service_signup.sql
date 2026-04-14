-- Self-service signup: track origin and welcome offer
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS signup_source text DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS welcome_offer_used boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS welcome_offer_expires_at timestamptz;
