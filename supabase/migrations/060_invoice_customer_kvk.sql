-- Add KVK number snapshot to invoices (mirrors customer.kvk_nummer at invoice creation time)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_kvk text;
