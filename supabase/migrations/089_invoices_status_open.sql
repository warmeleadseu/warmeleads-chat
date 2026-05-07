-- Allow open (unpaid) invoices so klanten via portaal/Mollie kunnen betalen
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE invoices
  ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('open', 'paid', 'credit_note'));
