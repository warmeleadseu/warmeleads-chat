-- Allow any admin role to optionally act as account manager
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS is_account_manager boolean NOT NULL DEFAULT false;

-- Backfill: existing accountmanager-role users are automatically AMs
UPDATE admin_users SET is_account_manager = true WHERE role = 'accountmanager';
