ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS portal_active boolean DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_customers_email_login ON customers(email);
