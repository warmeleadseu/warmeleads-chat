-- Per-customer lead status & notes isolation
-- Previously status/notities lived on `leads` (shared across all customers).
-- Now each customer gets their own status/notes via lead_assignments.

ALTER TABLE lead_assignments
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'nieuw'
    CHECK (status IN ('nieuw', 'gecontacteerd', 'offerte', 'verkocht', 'afgewezen', 'geen_gehoor')),
  ADD COLUMN IF NOT EXISTS notities text;

-- Backfill: copy current leads.status and leads.notities into each assignment row
UPDATE lead_assignments la
SET
  status = COALESCE(l.status, 'nieuw'),
  notities = l.notities
FROM leads l
WHERE la.lead_id = l.id
  AND la.status = 'nieuw'
  AND (l.status != 'nieuw' OR l.notities IS NOT NULL);
