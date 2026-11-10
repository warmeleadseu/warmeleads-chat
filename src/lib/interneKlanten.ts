import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Interne klanten (customers.intern: WarmeLeads.eu, Warme Leads
 * Afspraakleads) tellen niet mee voor het maximum van 3 klanten per lead en
 * niet voor de wachttijd tussen klanten (afgesproken 10 nov 2026). Intern
 * gebruik is geen delen met een vakspecialist (privacyverklaring A). Een
 * afspraakpartner zoals Infinite Scale is wél een externe partij en telt dus
 * gewoon mee. De database bewaakt hetzelfde (migratie 197).
 */

let cache: { ids: Set<string>; tot: number } | null = null;
const GELDIG_MS = 5 * 60_000;

/** Ids van de interne klanten, vijf minuten onthouden. Bij een fout: geen (dan telt alles mee, de veilige kant). */
export async function laadInterneKlantIds(supabase: SupabaseClient): Promise<Set<string>> {
  if (cache && cache.tot > Date.now()) return cache.ids;
  const { data, error } = await supabase.from('customers').select('id, intern').eq('intern', true);
  if (error) {
    console.error('[interneKlanten] laden mislukt, alles telt mee', error.message);
    return new Set();
  }
  const ids = new Set((data ?? []).filter(c => c.intern === true).map(c => c.id as string));
  cache = { ids, tot: Date.now() + GELDIG_MS };
  return ids;
}

/** Alleen de toewijzingen aan externe klanten: die tellen voor het maximum en de wachttijd. */
export function zonderInterneKlanten<T extends { customer_id: string | null }>(rijen: readonly T[], intern: ReadonlySet<string>): T[] {
  if (intern.size === 0) return [...rijen];
  return rijen.filter(r => !r.customer_id || !intern.has(r.customer_id));
}
