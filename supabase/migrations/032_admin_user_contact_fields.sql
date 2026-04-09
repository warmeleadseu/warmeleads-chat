-- Add contact fields for account managers
ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS title text;
