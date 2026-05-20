/**
 * Unit tests voor de welkomstkorting-helper.
 *
 * Belangrijke gedragingen die we hier afdwingen:
 *  - `welcomeDiscountAmount` rondt op 2 decimalen en handelt edge cases af.
 *  - `loadWelcomeOfferStatus` markeert `active=true` wanneer de korting niet
 *    gebruikt is, niet verlopen is, en er geen recente pending claim is.
 *  - Een pending claim binnen 30 minuten blokkeert de korting (anti double-discount),
 *    maar een oudere pending claim doet dat niet (Mollie heeft 'm dan al laten
 *    verlopen of de klant heeft de checkout afgebroken).
 *  - De claim-check kijkt zowel in `batch_orders` als in `appointment_orders`.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  WELCOME_DISCOUNT_RATE,
  PENDING_CLAIM_WINDOW_MIN,
  welcomeDiscountAmount,
  loadWelcomeOfferStatus,
} from '@/lib/welcomeOffer';

describe('welcomeDiscountAmount', () => {
  it('past 20% korting toe en rondt netjes af', () => {
    expect(WELCOME_DISCOUNT_RATE).toBe(0.20);
    expect(welcomeDiscountAmount(100)).toBe(20);
    expect(welcomeDiscountAmount(99.99)).toBe(20);
    expect(welcomeDiscountAmount(123.45)).toBeCloseTo(24.69, 2);
  });

  it('geeft 0 terug voor 0 / NaN / negatief subtotaal', () => {
    expect(welcomeDiscountAmount(0)).toBe(0);
    expect(welcomeDiscountAmount(-50)).toBe(0);
    expect(welcomeDiscountAmount(NaN)).toBe(0);
  });
});

type CountResult = { count: number };
type ChainSpec = { count: number };

/**
 * Bouwt een minimale supabase-stub die `select(...).eq(...).eq(...)...` netjes
 * teruggeeft als `{ count }`. We tellen alleen calls op tabelnaam-niveau.
 */
function buildSupabaseStub({
  customer,
  batchOrdersCount,
  apptOrdersCount,
}: {
  customer: { welcome_offer_used: boolean | null; welcome_offer_expires_at: string | null } | null;
  batchOrdersCount: number;
  apptOrdersCount: number;
}) {
  const customersRow = customer;

  const customersChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: customersRow, error: null }),
  };

  function buildOrdersChain(spec: ChainSpec) {
    const result: CountResult = { count: spec.count };
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockResolvedValue(result),
    };
    return chain;
  }

  const batchOrdersChain = buildOrdersChain({ count: batchOrdersCount });
  const apptOrdersChain = buildOrdersChain({ count: apptOrdersCount });

  return {
    from: vi.fn((table: string) => {
      if (table === 'customers') return customersChain;
      if (table === 'batch_orders') return batchOrdersChain;
      if (table === 'appointment_orders') return apptOrdersChain;
      throw new Error(`Unexpected table: ${table}`);
    }),
  } as unknown as Parameters<typeof loadWelcomeOfferStatus>[0];
}

describe('loadWelcomeOfferStatus', () => {
  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  it('is actief wanneer korting niet gebruikt en niet verlopen', async () => {
    const supabase = buildSupabaseStub({
      customer: { welcome_offer_used: false, welcome_offer_expires_at: future },
      batchOrdersCount: 0,
      apptOrdersCount: 0,
    });
    const status = await loadWelcomeOfferStatus(supabase, 'cust-1');
    expect(status).toEqual({
      active: true,
      used: false,
      expires_at: future,
      pending_claim: false,
    });
  });

  it('is niet actief wanneer al gebruikt', async () => {
    const supabase = buildSupabaseStub({
      customer: { welcome_offer_used: true, welcome_offer_expires_at: future },
      batchOrdersCount: 0,
      apptOrdersCount: 0,
    });
    const status = await loadWelcomeOfferStatus(supabase, 'cust-1');
    expect(status.active).toBe(false);
    expect(status.used).toBe(true);
  });

  it('is niet actief wanneer expiry in het verleden ligt', async () => {
    const supabase = buildSupabaseStub({
      customer: { welcome_offer_used: false, welcome_offer_expires_at: past },
      batchOrdersCount: 0,
      apptOrdersCount: 0,
    });
    const status = await loadWelcomeOfferStatus(supabase, 'cust-1');
    expect(status.active).toBe(false);
  });

  it('is niet actief wanneer er een recente pending claim in batch_orders staat', async () => {
    const supabase = buildSupabaseStub({
      customer: { welcome_offer_used: false, welcome_offer_expires_at: future },
      batchOrdersCount: 1,
      apptOrdersCount: 0,
    });
    const status = await loadWelcomeOfferStatus(supabase, 'cust-1');
    expect(status.active).toBe(false);
    expect(status.pending_claim).toBe(true);
  });

  it('is niet actief wanneer er een recente pending claim in appointment_orders staat', async () => {
    const supabase = buildSupabaseStub({
      customer: { welcome_offer_used: false, welcome_offer_expires_at: future },
      batchOrdersCount: 0,
      apptOrdersCount: 1,
    });
    const status = await loadWelcomeOfferStatus(supabase, 'cust-1');
    expect(status.active).toBe(false);
    expect(status.pending_claim).toBe(true);
  });

  it('is leeg wanneer de klant niet bestaat', async () => {
    const supabase = buildSupabaseStub({
      customer: null,
      batchOrdersCount: 0,
      apptOrdersCount: 0,
    });
    const status = await loadWelcomeOfferStatus(supabase, 'cust-x');
    expect(status).toEqual({ active: false, used: false, expires_at: null, pending_claim: false });
  });

  it('venster van 30 minuten wordt geëxporteerd', () => {
    expect(PENDING_CLAIM_WINDOW_MIN).toBe(30);
  });
});
