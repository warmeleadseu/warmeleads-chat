import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OUDE_SLEUTEL_TOT_DAG, controleerHerbestelToken, herbestelUrl, leesBron, maakHerbestelToken, vervaldag } from '../herbestelToken';
import { geldigeGrootte, grootteKeuzes, oorspronkelijkeGrootte } from '../herbestelling';

const oud = process.env.HERBESTEL_TOKEN_SECRET;
beforeAll(() => { process.env.HERBESTEL_TOKEN_SECRET = 'test-geheim-voor-herbestellen-1234'; });
afterAll(() => { process.env.HERBESTEL_TOKEN_SECRET = oud; });

const nu = new Date('2026-10-27T10:00:00Z');

describe('herbestellink', () => {
  it('een vers gemaakte link is geldig', () => {
    const tot = vervaldag(nu);
    expect(controleerHerbestelToken('b1', String(tot), maakHerbestelToken('b1', tot), nu)).toBe('ok');
  });
  it('een andere batch of een aangepaste vervaldag is ongeldig', () => {
    const tot = vervaldag(nu);
    const t = maakHerbestelToken('b1', tot);
    expect(controleerHerbestelToken('b2', String(tot), t, nu)).toBe('ongeldig');
    expect(controleerHerbestelToken('b1', String(tot + 30), t, nu)).toBe('ongeldig');
    expect(controleerHerbestelToken('b1', String(tot), 'x'.repeat(32), nu)).toBe('ongeldig');
    expect(controleerHerbestelToken('b1', 'abc', t, nu)).toBe('ongeldig');
    expect(controleerHerbestelToken('b1', String(tot), null, nu)).toBe('ongeldig');
  });
  it('verloopt na 14 dagen', () => {
    const tot = vervaldag(nu);
    const t = maakHerbestelToken('b1', tot);
    expect(controleerHerbestelToken('b1', String(tot), t, new Date(nu.getTime() + 14 * 86_400_000))).toBe('ok');
    expect(controleerHerbestelToken('b1', String(tot), t, new Date(nu.getTime() + 15 * 86_400_000))).toBe('verlopen');
  });
  it('de url bevat een werkend token en de bron', () => {
    const u = new URL(herbestelUrl('b1', '80', { siteUrl: 'https://x.test', nu }));
    expect(u.pathname).toBe('/herbestellen/b1');
    expect(u.searchParams.get('b')).toBe('80');
    expect(controleerHerbestelToken('b1', u.searchParams.get('v'), u.searchParams.get('t'), nu)).toBe('ok');
  });
  it('alleen bekende bronnen', () => {
    expect(leesBron('100')).toBe('100');
    expect(leesBron('hack')).toBeNull();
  });
});

describe('herbestelling', () => {
  it('oorspronkelijke grootte zonder compensaties', () => {
    expect(oorspronkelijkeGrootte({ batch_size: 45, compensations: [{ amount: 3 }, { amount: 2 }] })).toBe(40);
    expect(oorspronkelijkeGrootte({ batch_size: 30, compensations: null })).toBe(30);
  });
  it('keuzes: vorige grootte plus standaardmaten, gesorteerd en zonder dubbele', () => {
    expect(grootteKeuzes(40)).toEqual([20, 30, 40, 50, 75, 100, 200]);
    expect(grootteKeuzes(50)).toEqual([20, 30, 50, 75, 100, 200]);
  });
  it('grootte tussen 10 en 1000, hele getallen', () => {
    expect(geldigeGrootte(40)).toBe(40);
    expect(geldigeGrootte('30')).toBe(30);
    expect(geldigeGrootte(9)).toBeNull();
    expect(geldigeGrootte(1001)).toBeNull();
    expect(geldigeGrootte(12.5)).toBeNull();
    expect(geldigeGrootte(undefined)).toBeNull();
  });
});

describe('overgang naar een eigen geheim', () => {
  it('links met het oude cron-geheim blijven tot hun vervaldag geldig, nieuwe niet', () => {
    const eigen = process.env.HERBESTEL_TOKEN_SECRET;
    const cron = process.env.CRON_SECRET;
    try {
      process.env.CRON_SECRET = 'oud-cron-geheim';
      delete process.env.HERBESTEL_TOKEN_SECRET;
      const tot = vervaldag(nu);
      const oudeLink = maakHerbestelToken('b1', tot);
      process.env.HERBESTEL_TOKEN_SECRET = 'nieuw-eigen-geheim';
      expect(controleerHerbestelToken('b1', String(tot), oudeLink, nu)).toBe('ok');
      expect(maakHerbestelToken('b1', tot)).not.toBe(oudeLink);
      /* Een vervaldag na de overgang kan nooit met de oude sleutel gemaakt zijn. */
      delete process.env.HERBESTEL_TOKEN_SECRET;
      const laat = OUDE_SLEUTEL_TOT_DAG + 1;
      const vervalst = maakHerbestelToken('b1', laat);
      process.env.HERBESTEL_TOKEN_SECRET = 'nieuw-eigen-geheim';
      expect(controleerHerbestelToken('b1', String(laat), vervalst, new Date(laat * 86_400_000 - 1000))).toBe('ongeldig');
    } finally {
      process.env.HERBESTEL_TOKEN_SECRET = eigen;
      process.env.CRON_SECRET = cron;
    }
  });
});
