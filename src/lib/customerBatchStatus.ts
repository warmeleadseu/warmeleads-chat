import { isBulkLeadsBatchKind } from './batchKind';

/**
 * customer_batches.status: unpaid nieuwe pipeline-batch → `pending_payment`;
 * betaald → `active` (invariant samen met `is_paid` na migratie).
 *
 * UITZONDERING: bulkverkoop
 * -------------------------
 * Een bulkbatch is geen pijplijn maar een eenmalige levering: de leads worden
 * op het moment van verkoop in één keer uitgedeeld of geëxporteerd. Toch kreeg
 * hij bij betaling de status `active`, waarna hij daar voorgoed in bleef hangen:
 * `reconcile_batch_delivered()` sluit alleen batches met leveringsmodel
 * `capped`, en bulkbatches staan op `manual`.
 *
 * In productie stonden daardoor vier volle bulkbatches op actief (Oevering
 * 101/101, Lokaal Verduurzamen 50/50 en 228/228, Sky Connect 200/200). Die
 * telden mee als actieve klant in elk overzicht dat op status filtert, terwijl
 * er allang niets meer naartoe ging.
 *
 * Een betaalde bulkbatch is dus meteen afgerond.
 */
export function initialPipelineBatchStatus(
  isPaid: boolean,
  batchKind?: string | null,
): 'active' | 'pending_payment' | 'completed' {
  if (!isPaid) return 'pending_payment';
  if (isBulkLeadsBatchKind(batchKind)) return 'completed';
  return 'active';
}

/** appointment_batches: zelfde patroon als lead-pijplijn na migratie 104. */
export function initialAppointmentBatchStatus(isPaid: boolean): 'active' | 'pending_payment' {
  return isPaid ? 'active' : 'pending_payment';
}
