/**
 * PostgREST `select`-fragmenten: klant + `customer_targets` voor batch-overzichten.
 * Distributie matcht leads op alle **actieve** targets van de klant (niet per-batch).
 */

export const ADMIN_CUSTOMER_WITH_TARGETS = `customers(
  id,
  name,
  contact_person,
  email,
  phone,
  city,
  postcode,
  country,
  customer_targets(id, label, lat, lng, radius_km, is_active, target_type, provinces)
)`;

export const adminCustomerTargetsOnly = `customers(
  name,
  customer_targets(id, label, lat, lng, radius_km, is_active, target_type, provinces)
)`;

/** Live unpaid-feed: klant-AM als fallback naast batch.account_manager_id */
export const adminCustomerLiveUnpaidEmbed = `customers(
  name,
  account_manager_id,
  customer_targets(id, label, lat, lng, radius_km, is_active, target_type, provinces)
)`;

/** Per-batch target-override (`batch_targets`) embed voor batch-overzichten. */
export const BATCH_TARGETS_EMBED = `batch_targets(id, label, lat, lng, radius_km, is_active, target_type, provinces, country)`;

/** Zonder batch_targets — fallback wanneer migratie 144 nog niet is toegepast. */
export const adminBatchListSelectNoBatchTargets = `*,${ADMIN_CUSTOMER_WITH_TARGETS}`;

export const adminBatchListSelect = `*,${ADMIN_CUSTOMER_WITH_TARGETS},${BATCH_TARGETS_EMBED}`;

/** True wanneer een PostgREST-fout duidt op een ontbrekende `batch_targets`-relatie. */
export function isMissingBatchTargetsError(message: string | null | undefined): boolean {
  if (!message) return false;
  return /batch_targets/i.test(message) && /(does not exist|not find|relationship|schema cache)/i.test(message);
}
