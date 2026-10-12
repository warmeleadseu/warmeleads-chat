import { describe, expect, it } from 'vitest';
import { planInhaalslag, vroegsteMoment } from '../inhaalslagPlanning';

const NU = new Date('2026-10-12T10:00:00Z');
const uur = (u: number) => new Date(NU.getTime() + u * 3_600_000);

describe('planInhaalslag', () => {
  it('verdeelt gelijk over 8 uur, de eerste meteen', () => {
    const p = planInhaalslag([0, 1, 2, 3].map(i => ({ lead_id: `l${i}`, vroegst: null })), NU);
    expect(p.map(x => x.gepland_voor.toISOString())).toEqual([uur(0), uur(2), uur(4), uur(6)].map(d => d.toISOString()));
  });
  it('7 leads: ongeveer elke 69 minuten', () => {
    const p = planInhaalslag(Array.from({ length: 7 }, (_, i) => ({ lead_id: `l${i}`, vroegst: null })), NU);
    expect(p[6].gepland_voor.getTime() - NU.getTime()).toBeLessThan(8 * 3_600_000);
    expect(Math.round((p[1].gepland_voor.getTime() - p[0].gepland_voor.getTime()) / 60_000)).toBe(69);
  });
  it('lead die nog op de 12 uur wacht: zodra het mag', () => {
    const p = planInhaalslag([{ lead_id: 'a', vroegst: uur(3) }, { lead_id: 'b', vroegst: null }], NU);
    expect(p[0].gepland_voor.toISOString()).toBe(uur(3).toISOString());
    expect(p[1].gepland_voor.toISOString()).toBe(uur(4).toISOString());
  });
  it('wachttijd valt buiten de 8 uur: valt af', () => {
    expect(planInhaalslag([{ lead_id: 'a', vroegst: uur(9) }], NU)).toEqual([]);
  });
  it('niets te plannen', () => {
    expect(planInhaalslag([], NU)).toEqual([]);
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
