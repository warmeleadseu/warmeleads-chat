-- Afspraak-batches: zelfde betalingsstatus als lead-batches (pending_payment tot betaald).
ALTER TABLE appointment_batches
  DROP CONSTRAINT IF EXISTS appointment_batches_status_check;

ALTER TABLE appointment_batches
  ADD CONSTRAINT appointment_batches_status_check
  CHECK (status IN ('active', 'completed', 'paused', 'cancelled', 'pending_payment'));

-- Facturen kunnen nu expliciet aan een afspraak-batch hangen (FK naar customer_batches is daar niet voor bedoeld).
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS appointment_batch_id UUID REFERENCES appointment_batches(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_unique_appointment_batch
  ON invoices (appointment_batch_id)
  WHERE appointment_batch_id IS NOT NULL AND status != 'credit_note';

COMMENT ON COLUMN invoices.appointment_batch_id IS 'Afspraak-batch (parallel aan customer_batches); batch_id blijft voor lead-batches.';
