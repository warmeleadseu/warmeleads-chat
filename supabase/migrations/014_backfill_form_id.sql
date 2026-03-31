-- Add form_id to webhook_keys for Meta Lead Form backfill
ALTER TABLE webhook_keys ADD COLUMN IF NOT EXISTS form_id text;
