import type { SupabaseClient } from '@supabase/supabase-js';
import { PROVINCES_BE, PROVINCES_NL } from '@/data/provinces';
import { calculatePricePerLead, mergeCustomTiers, type PricingTier } from './pricing';
import { parseProvinceTargetToken } from './provinceTargetMatch';

/**
 * De prijs per lead van een nieuwe bestelling (portaal en herbestellink).
 *
 * Altijd de actuele staffel van de branche, of de maatwerkstaffel van de
 * klant (customer_pricing). Niet meer de prijs van de vorige batch: tot
 * 27 nov 2026 rekende de server die af, terwijl de bestelpagina de staffel
 * toonde, zodat een klant een andere prijs zag dan hij betaalde.
 *
 * Landelijke dekking (alle provincies van Nederland of van België in het
 * werkgebied) geeft de landelijke korting per lead van de branche of klant.
 */

type Doel = { target_type?: string | null; provinces?: string[] | null; is_active?: boolean | null };

/** Dekt het werkgebied heel Nederland of heel België? */
export function dektLandelijk(doelen: Doel[]): boolean {
  const nl = new Set<string>();
  const be = new Set<string>();
  for (const d of doelen) {
    if (d.is_active === false || (d.target_type ?? 'radius') !== 'province') continue;
    for (const t of d.provinces ?? []) {
      const { land, name } = parseProvinceTargetToken(t);
      if (land === 'BE' || (!land && (PROVINCES_BE as readonly string[]).includes(name))) be.add(name);
      if (land === 'NL' || (!land && (PROVINCES_NL as readonly string[]).includes(name))) nl.add(name);
    }
  }
  return PROVINCES_NL.every(p => nl.has(p)) || PROVINCES_BE.every(p => be.has(p));
}

export type BestelPrijs = {
  pricePerLead: number;
  /** Staffelprijs vóór landelijke korting. */
  staffelPrijs: number;
  landelijkeKorting: number;
  landelijk: boolean;
  maatwerk: boolean;
};

/** Puur: prijs uit staffel, met landelijke korting als het werkgebied landelijk is. */
export function prijsUitStaffel(tiers: PricingTier[], grootte: number, korting: number, landelijk: boolean, maatwerk = false): BestelPrijs | null {
  const r = calculatePricePerLead(tiers, grootte, { nationwideDiscount: korting, isNationwide: landelijk, isCustom: maatwerk });
  if (!r) return null;
  const rond = (n: number) => Math.round(n * 100) / 100;
  return {
    pricePerLead: rond(r.price_per_lead),
    staffelPrijs: rond(r.tier.price_per_lead),
    landelijkeKorting: rond(r.nationwide_discount_applied),
    landelijk,
    maatwerk,
  };
}

/** Het werkgebied dat de nieuwe batch krijgt: dat van de vorige batch, anders dat van de klant. */
export async function laadWerkgebied(supabase: SupabaseClient, customerId: string, sourceBatchId?: string | null): Promise<Doel[]> {
  if (sourceBatchId) {
    const { data } = await supabase.from('batch_targets').select('target_type, provinces, is_active').eq('batch_id', sourceBatchId).eq('is_active', true);
    if (data?.length) return data as Doel[];
  }
  const { data } = await supabase.from('customer_targets').select('target_type, provinces, is_active').eq('customer_id', customerId).eq('is_active', true);
  return (data ?? []) as Doel[];
}

export async function bepaalBestelPrijs(
  supabase: SupabaseClient,
  p: { customerId: string; branch: string; grootte: number; sourceBatchId?: string | null },
): Promise<BestelPrijs | null> {
  const [{ data: branche }, { data: maat }, doelen] = await Promise.all([
    supabase.from('branches').select('pricing_tiers, nationwide_discount').eq('slug', p.branch).maybeSingle(),
    supabase.from('customer_pricing').select('pricing_tiers, nationwide_discount').eq('customer_id', p.customerId).eq('branch_slug', p.branch).maybeSingle(),
    laadWerkgebied(supabase, p.customerId, p.sourceBatchId),
  ]);
  const brancheTiers = ((branche?.pricing_tiers as PricingTier[] | null) ?? []);
  const maatTiers = ((maat?.pricing_tiers as PricingTier[] | null) ?? []);
  const maatwerk = maatTiers.length > 0;
  const tiers = maatwerk ? mergeCustomTiers(brancheTiers, maatTiers) : brancheTiers;
  if (!tiers.length) return null;
  const korting = Number(maatwerk && maat?.nationwide_discount != null ? maat.nationwide_discount : branche?.nationwide_discount ?? 0) || 0;
  return prijsUitStaffel(tiers, p.grootte, korting, dektLandelijk(doelen), maatwerk);
}
