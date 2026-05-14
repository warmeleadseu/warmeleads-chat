-- Lead batches: explicit "awaiting payment" state (no pool distribution until paid).
-- Invariant after migration: status = 'active' implies is_paid = true; unpaid pipeline batches use 'pending_payment'.

ALTER TABLE customer_batches DROP CONSTRAINT IF EXISTS customer_batches_status_check;

ALTER TABLE customer_batches
  ADD CONSTRAINT customer_batches_status_check
  CHECK (status IN ('active', 'paused', 'completed', 'pending_payment'));

COMMENT ON COLUMN customer_batches.status IS 'active = paid + receiving leads; pending_payment = unpaid invoice/Mollie; paused = paid pause; completed = done';

-- Normalize legacy rows: unpaid batches must not use "active" or "paused" for operational semantics.
UPDATE customer_batches
SET status = 'pending_payment'
WHERE (is_paid IS NOT TRUE)
  AND status IN ('active', 'paused');
