/**
 * Centrale logica voor de 20% welkomstkorting.
 *
 * Belangrijke regels:
 * - Een klant heeft "actieve" welkomstkorting wanneer `welcome_offer_used = false`
 *   én `welcome_offer_expires_at` in de toekomst ligt.
 * - Een lopende (`pending`/`open`) bestelling waarop de korting al is toegepast
 *   "claimt" de korting tijdelijk om double-discount te voorkomen — maar alleen
 *   binnen een korte window van {@link PENDING_CLAIM_WINDOW_MIN} minuten. Daarna
 *   gaan we ervan uit dat de klant Mollie heeft verlaten zonder te betalen en
 *   mag de korting opnieuw worden toegepast op een verse bestelling.
 *   Mollie zelf verloopt openstaande betalingen na ±15-30 minuten en stuurt
 *   dan een expired-webhook die de order-status corrigeert; daarna voldoet de
 *   `status`-filter sowieso niet meer.
 * - De claim wordt gecontroleerd over zowel `batch_orders` (leads) als
 *   `appointment_orders` (afspraken) zodat het verkeer tussen beide flows niet
 *   kan leiden tot dubbele korting.
 */
import type { createServerClient } from './supabase';

type Supabase = ReturnType<typeof createServerClient>;

export const WELCOME_DISCOUNT_RATE = 0.20;

/** Maximale leeftijd (in minuten) van een pending order met korting voordat we
 *  hem als afgebroken beschouwen en niet meer laten blokkeren. */
export const PENDING_CLAIM_WINDOW_MIN = 30;

export interface WelcomeOfferStatus {
  active: boolean;
  used: boolean;
  expires_at: string | null;
  pending_claim: boolean;
}

/**
 * Telt actuele pending/open orders (binnen het claim-venster) waarvoor de
 * welkomstkorting al is toegepast — in zowel leads als afspraken.
 */
export async function hasRecentPendingDiscountOrder(
  supabase: Supabase,
  customerId: string,
): Promise<boolean> {
  const cutoff = new Date(Date.now() - PENDING_CLAIM_WINDOW_MIN * 60_000).toISOString();
  const [leadsRes, apptRes] = await Promise.all([
    supabase
      .from('batch_orders')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .eq('welcome_discount_applied', true)
      .in('status', ['pending', 'open'])
      .gte('created_at', cutoff),
    supabase
      .from('appointment_orders')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .eq('welcome_discount_applied', true)
      .in('status', ['pending', 'open'])
      .gte('created_at', cutoff),
  ]);
  return (leadsRes.count ?? 0) + (apptRes.count ?? 0) > 0;
}

/**
 * Levert de complete welcome-offer-status voor een klant, inclusief of er een
 * actieve claim staat in een lopende bestelling. Gebruik deze functie zowel in
 * de read-endpoints (UI) als in de prijsberekening (POST orders) zodat beide
 * exact dezelfde regels volgen.
 */
export async function loadWelcomeOfferStatus(
  supabase: Supabase,
  customerId: string,
): Promise<WelcomeOfferStatus> {
  const { data } = await supabase
    .from('customers')
    .select('welcome_offer_used, welcome_offer_expires_at')
    .eq('id', customerId)
    .maybeSingle<{ welcome_offer_used: boolean | null; welcome_offer_expires_at: string | null }>();

  if (!data) {
    return { active: false, used: false, expires_at: null, pending_claim: false };
  }

  const used = data.welcome_offer_used === true;
  const notExpired = data.welcome_offer_expires_at
    ? new Date(data.welcome_offer_expires_at) > new Date()
    : false;

  let pendingClaim = false;
  if (!used && notExpired) {
    pendingClaim = await hasRecentPendingDiscountOrder(supabase, customerId);
  }

  return {
    active: !used && notExpired && !pendingClaim,
    used,
    expires_at: data.welcome_offer_expires_at ?? null,
    pending_claim: pendingClaim,
  };
}

/**
 * Berekent het 20%-kortingbedrag op een subtotaal (excl. btw), netjes
 * afgerond op 2 decimalen. Gebruikt op zowel leads- als appointment-orders
 * zodat alle flows identiek rekenen.
 */
export function welcomeDiscountAmount(subtotalExclBtw: number): number {
  if (!Number.isFinite(subtotalExclBtw) || subtotalExclBtw <= 0) return 0;
  return Math.round(subtotalExclBtw * WELCOME_DISCOUNT_RATE * 100) / 100;
}
