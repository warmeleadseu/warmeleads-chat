-- Celebration video URL for account managers (plays on live dashboard when they close a deal)
ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS celebration_video_url text;
