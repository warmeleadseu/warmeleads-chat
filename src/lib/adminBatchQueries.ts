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

export const adminBatchListSelect = `*,${ADMIN_CUSTOMER_WITH_TARGETS}`;
