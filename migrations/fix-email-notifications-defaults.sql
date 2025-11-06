-- Migration: Fix email notifications defaults
-- Date: 2025-11-02
-- Description: Change default values for email notifications from true to false
--              Email notifications should only be enabled when explicitly set by admin or customer

-- Update default values in customers table
ALTER TABLE customers 
  ALTER COLUMN email_notifications_enabled SET DEFAULT false,
  ALTER COLUMN email_notifications_new_leads SET DEFAULT false;

-- Update existing customers that have NULL values to false
-- (This ensures consistency - NULL should mean false, not true)
UPDATE customers 
SET 
  email_notifications_enabled = false,
  email_notifications_new_leads = false
WHERE 
  email_notifications_enabled IS NULL 
  OR email_notifications_new_leads IS NULL;

-- Optional: If you want to keep existing customers' settings as-is, 
-- only update NULL values:
-- UPDATE customers 
-- SET email_notifications_enabled = COALESCE(email_notifications_enabled, false)
-- WHERE email_notifications_enabled IS NULL;
-- 
-- UPDATE customers 
-- SET email_notifications_new_leads = COALESCE(email_notifications_new_leads, false)
-- WHERE email_notifications_new_leads IS NULL;

