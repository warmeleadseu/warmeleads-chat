ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS celebration_video_start integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS celebration_video_end integer;
