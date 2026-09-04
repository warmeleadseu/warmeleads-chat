import type { SupabaseClient } from '@supabase/supabase-js';
import { calculatePricePerLead, mergeCustomTiers, type PricingTier } from './pricing';

/**
 * Eén plek die bepaalt wat een leadbatch kost.
 *
 * AANLEIDING
 * ----------
 * Een handmatig in de admin aangemaakte batch kreeg `price_per_lead: null`
 * zodra het prijsveld leeg bleef. `total_price` werd dan ook null, en de
 * omzettegels op het live dashboard tellen uitsluitend `total_price` van
 * betaalde batches. Gevolg: vier betaalde batches in tien dagen (drie van
 * infinite-scale, één van groenvolt) stonden voor nul euro in de omzet.
 *
 * De prijs is nooit echt onbekend: hij staat in de staffels van de branche,
 * eventueel overschreven per klant in `customer_pricing`. Precies dezelfde
 * bron die het klantportaal gebruikt bij het bestellen van een batch. Deze
 * functie leidt hem daaruit af, zodat admin en portaal niet uiteen kunnen
 * lopen.
 */

export type BatchPricing = {
  pricePerLead: number;
  totalPrice: number;
  /** Waar de prijs vandaan komt, voor logging en foutmeldingen. */
  bron: 'opgegeven' | 'klantstaffel' | 'branchestaffel';
};

/**
 * Bepaalt prijs per lead en totaalprijs voor een nieuwe batch.
 *
 * `opgegevenPrijs` wint altijd, ook als die 0 is: een gratis compensatiebatch
 * is een bewuste keuze. Alleen bij `null`/`undefined` wordt de staffel geraadpleegd.
 *
 * Retourneert `null` wanneer er geen prijs te bepalen valt. De aanroeper hoort
 * dat te behandelen als een fout in plaats van stilzwijgend nul om te boeken.
 */
export async function resolveBatchPricing(
  supabase: SupabaseClient,
  params: {
    customerId: string;
    branch: string;
    batchSize: number;
    opgegevenPrijs?: number | null;
  },
): Promise<BatchPricing | null> {
  const { customerId, branch, batchSize, opgegevenPrijs } = params;

  const afgerond = (n: number) => Math.round(n * 100) / 100;

  if (typeof opgegevenPrijs === 'number' && Number.isFinite(opgegevenPrijs) && opgegevenPrijs >= 0) {
    return {
      pricePerLead: afgerond(opgegevenPrijs),
      totalPrice: afgerond(opgegevenPrijs * batchSize),
      bron: 'opgegeven',
    };
  }

  const [{ data: branchRow }, { data: customRow }] = await Promise.all([
    supabase
      .from('branches')
      .select('pricing_tiers, nationwide_discount')
      .eq('slug', branch)
      .maybeSingle(),
    supabase
      .from('customer_pricing')
      .select('pricing_tiers, nationwide_discount')
      .eq('customer_id', customerId)
      .eq('branch_slug', branch)
      .maybeSingle(),
  ]);

  const branchTiers: PricingTier[] = (branchRow?.pricing_tiers as PricingTier[]) || [];
  const customTiers: PricingTier[] =
    (customRow?.pricing_tiers as PricingTier[] | null)?.length ? (customRow!.pricing_tiers as PricingTier[]) : [];

  const tiers = customTiers.length > 0 ? mergeCustomTiers(branchTiers, customTiers) : branchTiers;
  if (!tiers.length) return null;

  const resultaat = calculatePricePerLead(tiers, batchSize);
  if (!resultaat) return null;

  return {
    pricePerLead: afgerond(resultaat.price_per_lead),
    totalPrice: afgerond(resultaat.price_per_lead * batchSize),
    bron: customTiers.length > 0 ? 'klantstaffel' : 'branchestaffel',
  };
}
