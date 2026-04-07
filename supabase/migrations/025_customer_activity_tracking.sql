ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_login_at timestamptz DEFAULT NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS login_count integer DEFAULT 0;
