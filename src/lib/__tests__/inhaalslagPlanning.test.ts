import { describe, expect, it } from 'vitest';
import { planInhaalslag, planInhaalslagSpoed, vroegsteMoment } from '../inhaalslagPlanning';
import { amsterdamUur } from '../leverSpreiding';

const NU = new Date('2026-10-12T08:00:00Z'); /* 10:00 in Nederland */
const uur = (u: number) => new Date(NU.getTime() + u * 3_600_000);
function zaad(s: number) {
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}
const kand = (i: number, extra: Partial<{ vroegst: Date | null; created_at: string }> = {}) =>
  ({ lead_id: `l${i}`, vroegst: null, created_at: new Date(NU.getTime() - (10 - i) * 3_600_000).toISOString(), ...extra });

describe('planInhaalslag', () => {
  it('willekeurig verspreid over 8 uur, niet op gelijke afstanden en niet meteen', () => {
    const p = planInhaalslag(Array.from({ length: 7 }, (_, i) => kand(i)), NU, 8, zaad(3));
    expect(p).toHaveLength(7);
    for (const x of p) {
      expect(x.gepland_voor.getTime()).toBeGreaterThanOrEqual(NU.getTime());
      expect(x.gepland_voor.getTime()).toBeLessThan(uur(8).getTime());
    }
    const gaten = p.slice(1).map((x, i) => Math.round((x.gepland_voor.getTime() - p[i].gepland_voor.getTime()) / 60_000));
    expect(new Set(gaten).size).toBeGreaterThan(3);
  });

  it('oudste lead eerst: de volgorde in de lijst klopt met de binnenkomst', () => {
    const k = [kand(5), kand(1), kand(3)];
    const p = planInhaalslag(k, NU, 8, zaad(9));
    expect(p.map(x => x.lead_id)).toEqual(['l1', 'l3', 'l5']);
    expect(p[0].gepland_voor.getTime()).toBeLessThan(p[1].gepland_voor.getTime());
  });

  it('lookback die om middernacht start: de leads komen vooral in de ochtend', () => {
    const middernacht = new Date('2026-10-12T22:00:00Z');
    let nacht = 0;
    let totaal = 0;
    for (let s = 1; s <= 20; s++) {
      for (const x of planInhaalslag(Array.from({ length: 8 }, (_, i) => kand(i)), middernacht, 8, zaad(s))) {
        totaal++;
        const u = amsterdamUur(x.gepland_voor);
        if (u >= 23 || u < 6) nacht++;
      }
    }
    expect(nacht / totaal).toBeLessThan(0.08);
  });

  it('lead die nog op de 12 uur wacht: kort nadat het mag', () => {
    const p = planInhaalslag([kand(1, { vroegst: uur(7.5) })], NU, 8, zaad(2));
    const t = p[0].gepland_voor.getTime();
    expect(t).toBeGreaterThanOrEqual(uur(7.5).getTime());
    expect(t).toBeLessThanOrEqual(uur(7.5).getTime() + 20 * 60_000);
  });

  it('wachttijd valt buiten de 8 uur: valt af', () => {
    expect(planInhaalslag([kand(1, { vroegst: uur(9) })], NU)).toEqual([]);
  });

  it('niets te plannen', () => {
    expect(planInhaalslag([], NU)).toEqual([]);
  });
});

describe('planInhaalslagSpoed', () => {
  it('alles meteen, oudste eerst; wie op de 12 uur wacht, zodra het mag', () => {
    const p = planInhaalslagSpoed([kand(3), kand(1), kand(2, { vroegst: uur(2) })], NU);
    expect(p.map(x => x.lead_id)).toEqual(['l1', 'l2', 'l3']);
    expect(p[0].gepland_voor.toISOString()).toBe(NU.toISOString());
    expect(p[1].gepland_voor.getTime()).toBeGreaterThanOrEqual(uur(2).getTime());
    expect(p[1].gepland_voor.getTime()).toBeLessThanOrEqual(uur(2).getTime() + 10 * 60_000);
    expect(p[2].gepland_voor.toISOString()).toBe(NU.toISOString());
  });
});

describe('wachttijd die in de nacht afloopt', () => {
  it('met spoed: niet om 23:40 maar de volgende ochtend tussen 07:00 en 08:30', () => {
    const laat = new Date('2026-10-12T21:40:00Z'); /* 23:40 in Nederland */
    for (let s = 1; s < 20; s++) {
      const [p] = planInhaalslagSpoed([kand(1, { vroegst: laat })], NU, zaad(s));
      const u = amsterdamUur(p.gepland_voor);
      expect(u === 7 || u === 8).toBe(true);
      expect(p.gepland_voor.getTime()).toBeGreaterThan(laat.getTime());
    }
  });
  it('gefaseerd: ook niet in de nacht', () => {
    const avond = new Date('2026-10-12T19:00:00Z'); /* 21:00 */
    for (let z = 1; z < 30; z++) {
      const [p] = planInhaalslag([kand(1, { vroegst: new Date('2026-10-12T22:10:00Z') })], avond, 8, zaad(z));
      const u = amsterdamUur(p.gepland_voor);
      expect(u >= 23 || u < 6).toBe(false);
    }
  });
});

describe('vroegsteMoment', () => {
  it('12 uur na de laatste andere klant', () => {
    expect(vroegsteMoment([{ customer_id: 'x', assigned_at: uur(-2).toISOString() }], 'k', NU)?.toISOString()).toBe(uur(10).toISOString());
  });
  it('al langer dan 12 uur geleden: geen wachttijd', () => {
    expect(vroegsteMoment([{ customer_id: 'x', assigned_at: uur(-13).toISOString() }], 'k', NU)).toBeNull();
  });
  it('eigen toewijzing telt niet', () => {
    expect(vroegsteMoment([{ customer_id: 'k', assigned_at: uur(-1).toISOString() }], 'k', NU)).toBeNull();
  });
});
