import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mollie = vi.hoisted(() => ({
  bestaand: null as null | { id: string; status: string; redirectUrl: string; _links: { checkout: { href: string } } },
  aangemaakt: [] as { redirectUrl: string }[],
}));
vi.mock('@/lib/mollie', () => ({
  getPayment: vi.fn(async () => {
    if (!mollie.bestaand) throw new Error('niet gevonden');
    return mollie.bestaand;
  }),
  createBatchPayment: vi.fn(async (p: { redirectUrl: string }) => {
    mollie.aangemaakt.push(p);
    return { id: 'tr_nieuw', _links: { checkout: { href: 'https://mollie.test/nieuw' } } };
  }),
}));
vi.mock('@/lib/supabase', () => ({
  createServerClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: { id: 'k1', name: 'Klant', email: 'k@x.nl', country: 'NL' } }) }) }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  }),
}));

import { factuurBedankUrl, factuurBetaalTokenKlopt, factuurBetaalToken, factuurBetaalUrl } from '../factuurBetaallink';
import { ensureFactuurBetaallink, ensureInvoiceMollieCheckout } from '../invoiceCheckout';

const oud = process.env.HERBESTEL_TOKEN_SECRET;
beforeAll(() => { process.env.HERBESTEL_TOKEN_SECRET = 'test-geheim-voor-betaallinks-1234'; });
afterAll(() => { process.env.HERBESTEL_TOKEN_SECRET = oud; });
beforeEach(() => { mollie.bestaand = null; mollie.aangemaakt = []; });

const ID = '11111111-2222-3333-4444-555555555555';
const FACTUUR = { id: ID, invoice_number: 'WL-1', description: 'x', customer_id: 'k1', total_incl_btw: 121, mollie_payment_id: 'tr_oud' };

describe('betaallink per factuur', () => {
  it('klopt alleen voor die ene factuur', () => {
    const t = factuurBetaalToken(ID);
    expect(factuurBetaalTokenKlopt(ID, t)).toBe(true);
    expect(factuurBetaalTokenKlopt('99999999-2222-3333-4444-555555555555', t)).toBe(false);
    expect(factuurBetaalTokenKlopt(ID, 'x'.repeat(32))).toBe(false);
    expect(factuurBetaalTokenKlopt(ID, '')).toBe(false);
    expect(factuurBetaalTokenKlopt(ID, null)).toBe(false);
  });

  it('link en bedankpagina dragen dezelfde handtekening', () => {
    const t = factuurBetaalToken(ID);
    expect(factuurBetaalUrl(ID, 'https://site.nl/')).toBe(`https://site.nl/betalen/${ID}?t=${t}`);
    expect(factuurBedankUrl(ID, 'https://site.nl')).toBe(`https://site.nl/betalen/${ID}/klaar?t=${t}`);
  });
});

describe('betaling klaarzetten', () => {
  it('de mail krijgt onze eigen link, en Mollie stuurt terug naar de bedankpagina', async () => {
    const r = await ensureFactuurBetaallink(FACTUUR);
    expect(r.checkoutUrl).toBe(factuurBetaalUrl(ID));
    expect(mollie.aangemaakt[0].redirectUrl).toBe(factuurBedankUrl(ID));
  });

  it('hergebruikt een openstaande betaling die al naar de bedankpagina terugkeert', async () => {
    mollie.bestaand = { id: 'tr_oud', status: 'open', redirectUrl: factuurBedankUrl(ID), _links: { checkout: { href: 'https://mollie.test/oud' } } };
    const r = await ensureInvoiceMollieCheckout(FACTUUR, { terugUrl: factuurBedankUrl(ID) });
    expect(r.checkoutUrl).toBe('https://mollie.test/oud');
    expect(mollie.aangemaakt).toHaveLength(0);
  });

  it('een openstaande betaling die naar het portaal (inlog) terugkeert: nieuwe betaling', async () => {
    mollie.bestaand = { id: 'tr_oud', status: 'open', redirectUrl: 'https://x/portal/account', _links: { checkout: { href: 'https://mollie.test/oud' } } };
    const r = await ensureInvoiceMollieCheckout(FACTUUR, { terugUrl: factuurBedankUrl(ID) });
    expect(r.checkoutUrl).toBe('https://mollie.test/nieuw');
  });

  it('verlopen betaling: nieuwe; het portaal zelf hergebruikt wat openstaat', async () => {
    mollie.bestaand = { id: 'tr_oud', status: 'expired', redirectUrl: factuurBedankUrl(ID), _links: { checkout: { href: 'https://mollie.test/oud' } } };
    expect((await ensureInvoiceMollieCheckout(FACTUUR, { terugUrl: factuurBedankUrl(ID) })).checkoutUrl).toBe('https://mollie.test/nieuw');
    mollie.bestaand = { id: 'tr_oud', status: 'open', redirectUrl: factuurBedankUrl(ID), _links: { checkout: { href: 'https://mollie.test/oud' } } };
    expect((await ensureInvoiceMollieCheckout(FACTUUR)).checkoutUrl).toBe('https://mollie.test/oud');
  });
});
