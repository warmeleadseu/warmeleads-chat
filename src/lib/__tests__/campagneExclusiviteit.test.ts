import { describe, expect, it } from 'vitest';
import {
  bouwCampagneRegels, campagneStaatToe, campagneWeigering, exclusiviteitVan, normaliseerExclusief, normaliseerUitgesloten,
} from '../campagneExclusiviteit';

const NU = new Date('2026-10-23T12:00:00Z');
const uur = (u: number) => new Date(NU.getTime() - u * 3_600_000).toISOString();
const b = (id: string, klant: string, extra: Record<string, unknown> = {}) => ({
  id, customer_id: klant, status: 'active', meta_campagne_exclusief: {}, meta_campagne_uitgesloten: [], ...extra,
});

describe('normaliseren', () => {
  it('exclusief alleen voor gekoppelde campagnes en geldige standen', () => {
    expect(normaliseerExclusief({ '111': '24u', '222': 'altijd', '333': 'soms', '444': '24u' }, ['111', '222', '333'])).toEqual({ '111': '24u', '222': 'altijd' });
    expect(normaliseerExclusief(null, ['111'])).toEqual({});
    expect(normaliseerExclusief(['111'], ['111'])).toEqual({});
  });
  it('uitgesloten: alleen campagne-id\'s, uniek, niet tegelijk gekoppeld', () => {
    expect(normaliseerUitgesloten(['12345678', '12345678', 'abc', '99999999', ' 55555555 '], ['99999999'])).toEqual(['12345678', '55555555']);
    expect(normaliseerUitgesloten('12345678', [])).toEqual([]);
  });
});

describe('regels', () => {
  const regels = bouwCampagneRegels([
    b('B', 'kB', { meta_campagne_exclusief: { '111': '24u', '222': 'altijd' } }),
    b('C', 'kC', { meta_campagne_uitgesloten: ['333'] }),
    b('D', 'kD', { status: 'completed', meta_campagne_exclusief: { '444': 'altijd' } }),
  ]);

  it('24 uur exclusief: alleen de eigen batch, tot 24 uur na binnenkomst', () => {
    const lead = { meta_campaign_id: '111', created_at: uur(2) };
    expect(campagneStaatToe('B', lead, regels, NU)).toBe(true);
    expect(campagneStaatToe('A', lead, regels, NU)).toBe(false);
    expect(exclusiviteitVan(lead, regels, NU)?.tot?.toISOString()).toBe(new Date(NU.getTime() + 22 * 3_600_000).toISOString());
    expect(campagneStaatToe('A', { meta_campaign_id: '111', created_at: uur(24.01) }, regels, NU)).toBe(true);
  });

  it('altijd exclusief: nooit een andere batch', () => {
    expect(campagneStaatToe('A', { meta_campaign_id: '222', created_at: uur(500) }, regels, NU)).toBe(false);
    expect(campagneWeigering('A', { meta_campaign_id: '222', created_at: uur(500) }, regels, NU)).toMatch(/altijd exclusief/);
  });

  it('uitgesloten: alleen die batch niet, altijd', () => {
    expect(campagneStaatToe('C', { meta_campaign_id: '333', created_at: uur(100) }, regels, NU)).toBe(false);
    expect(campagneStaatToe('A', { meta_campaign_id: '333', created_at: uur(1) }, regels, NU)).toBe(true);
  });

  it('afgeronde batch houdt geen exclusiviteit vast', () => {
    expect(campagneStaatToe('A', { meta_campaign_id: '444', created_at: uur(1) }, regels, NU)).toBe(true);
  });

  it('lead zonder campagne: altijd toegestaan', () => {
    expect(campagneStaatToe('A', { meta_campaign_id: null, created_at: uur(1) }, regels, NU)).toBe(true);
    expect(campagneWeigering('A', {}, regels, NU)).toBeNull();
  });

  it('twee batches van dezelfde klant exclusief: allebei mogen, de strengste stand geldt', () => {
    const r = bouwCampagneRegels([
      b('B1', 'kB', { meta_campagne_exclusief: { '555': '24u' } }),
      b('B2', 'kB', { meta_campagne_exclusief: { '555': 'altijd' } }),
    ]);
    expect(campagneStaatToe('B1', { meta_campaign_id: '555', created_at: uur(100) }, r, NU)).toBe(true);
    expect(campagneStaatToe('B2', { meta_campaign_id: '555', created_at: uur(100) }, r, NU)).toBe(true);
    expect(campagneStaatToe('X', { meta_campaign_id: '555', created_at: uur(100) }, r, NU)).toBe(false);
  });
});
