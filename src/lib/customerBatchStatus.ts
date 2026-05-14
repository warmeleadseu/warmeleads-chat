/**
 * customer_batches.status: unpaid nieuwe pipeline-batch → `pending_payment`;
 * betaald → `active` (invariant samen met `is_paid` na migratie).
 */
export function initialPipelineBatchStatus(isPaid: boolean): 'active' | 'pending_payment' {
  return isPaid ? 'active' : 'pending_payment';
}
