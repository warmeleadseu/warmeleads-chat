-- Add KVK number to customers for KVK API integration
ALTER TABLE customers ADD COLUMN IF NOT EXISTS kvk_nummer text;
