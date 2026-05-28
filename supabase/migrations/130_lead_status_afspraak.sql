-- Lead-status 'afspraak' voor portaal (klant plant optioneel afspraak in agenda).

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE leads ADD CONSTRAINT leads_status_check
  CHECK (status IN (
    'nieuw', 'gecontacteerd', 'geen_gehoor', 'offerte', 'afspraak', 'verkocht', 'afgewezen'
  ));

ALTER TABLE lead_assignments DROP CONSTRAINT IF EXISTS lead_assignments_status_check;
ALTER TABLE lead_assignments ADD CONSTRAINT lead_assignments_status_check
  CHECK (status IN (
    'nieuw', 'gecontacteerd', 'geen_gehoor', 'offerte', 'afspraak', 'verkocht', 'afgewezen'
  ));
