import { describe, it, expect, vi } from 'vitest';
import { resolveBatchPricing } from '../batchPricing';

/**
 * Een handmatig aangemaakte batch zonder ingevulde prijs kreeg
 * `price_per_lead: null` en dus `total_price: null`. De omzettegels tellen
 * alleen batches mét bedrag, dus vier betaalde batches stonden voor nul euro
 * in de omzet. Deze tests leggen vast dat de prijs voortaan uit de staffel komt.
 */

function maakClient(branchTiers: unknown, klantTiers: unknown = null) {
  const maybeSingle = vi.fn();
  const from = vi.fn((tabel: string) => ({
    select: () => ({
      eq: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: klantTiers ? { pricing_tiers: klantTiers } : null }) }),
        maybeSingle: () => Promise.resolve({ data: branchTiers ? { pricing_tiers: branchTiers } : null }),
      }),
    }),
  }));
  void maybeSingle; void from;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from } as any;
}

const BRANCHE = [
  { min_leads: 10, price_per_lead: 40 },
  { min_leads: 50, price_per_lead: 30 },
  { min_leads: 100, price_per_lead: 25 },
];

describe('resolveBatchPricing', () => {
  it('gebruikt de opgegeven prijs als die er is', async () => {
    const r = await resolveBatchPricing(maakClient(BRANCHE), {
      customerId: 'k1', branch: 'thuisbatterij', batchSize: 50, opgegevenPrijs: 33,
    });
    expect(r).toEqual({ pricePerLead: 33, totalPrice: 1650, bron: 'opgegeven' });
  });

  it('behandelt een expliciete nul als bewuste gratis batch', async () => {
    const r = await resolveBatchPricing(maakClient(BRANCHE), {
      customerId: 'k1', branch: 'thuisbatterij', batchSize: 20, opgegevenPrijs: 0,
    });
    expect(r).toEqual({ pricePerLead: 0, totalPrice: 0, bron: 'opgegeven' });
  });

  it('leidt de prijs af uit de branchestaffel als het veld leeg blijft', async () => {
    const r = await resolveBatchPricing(maakClient(BRANCHE), {
      customerId: 'k1', branch: 'thuisbatterij', batchSize: 60, opgegevenPrijs: null,
    });
    expect(r?.pricePerLead).toBe(30);
    expect(r?.totalPrice).toBe(1800);
    expect(r?.bron).toBe('branchestaffel');
  });

  it('pakt de juiste trede bij een grotere batch', async () => {
    const r = await resolveBatchPricing(maakClient(BRANCHE), {
      customerId: 'k1', branch: 'thuisbatterij', batchSize: 400, opgegevenPrijs: undefined,
    });
    expect(r?.pricePerLead).toBe(25);
    expect(r?.totalPrice).toBe(10000);
  });

  it('geeft null als er geen enkele staffel bestaat', async () => {
    const r = await resolveBatchPricing(maakClient(null), {
      customerId: 'k1', branch: 'onbekend', batchSize: 50, opgegevenPrijs: null,
    });
    expect(r).toBeNull();
  });

  it('geeft null als de batch onder de laagste trede valt', async () => {
    const r = await resolveBatchPricing(maakClient(BRANCHE), {
      customerId: 'k1', branch: 'thuisbatterij', batchSize: 5, opgegevenPrijs: null,
    });
    expect(r).toBeNull();
  });
});
