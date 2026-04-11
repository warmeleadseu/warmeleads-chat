-- Add avatar URL field for admin user profile photos
ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS avatar_url text;
