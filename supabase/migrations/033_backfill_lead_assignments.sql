-- Backfill: ensure every leads.customer_id has a corresponding lead_assignments row
INSERT INTO lead_assignments (lead_id, customer_id)
SELECT id, customer_id FROM leads
WHERE customer_id IS NOT NULL
ON CONFLICT (lead_id, customer_id) DO NOTHING;
