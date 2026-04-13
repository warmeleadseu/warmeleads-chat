-- Extend leads.status CHECK to include 'geen_gehoor'
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE leads ADD CONSTRAINT leads_status_check
  CHECK (status IN ('nieuw', 'gecontacteerd', 'geen_gehoor', 'offerte', 'verkocht', 'afgewezen'));
