-- Add phone_valid column to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone_valid boolean DEFAULT true;
