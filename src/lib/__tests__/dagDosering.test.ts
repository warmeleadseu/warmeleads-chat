import { describe, expect, it } from 'vitest';
import { teLangGewacht, toegestaanTotNu, volgendeRuimte } from '../dagDosering';

/* Oktober 2026 na 25 okt: wintertijd, Nederland = UTC+1. */
const nl = (uur: number, min = 0) => new Date(Date.UTC(2026, 9, 27, uur - 1, min));

describe('toegestaanTotNu', () => {
  it('5 per dag: niets vóór 08:00, dan gelijkmatig tot 16:00, daarna alles', () => {
    expect(toegestaanTotNu(5, nl(7, 59))).toBe(0);
    expect(toegestaanTotNu(5, nl(8, 0))).toBe(1);
    expect(toegestaanTotNu(5, nl(9, 30))).toBe(1);
    expect(toegestaanTotNu(5, nl(10, 0))).toBe(2);
    expect(toegestaanTotNu(5, nl(12, 0))).toBe(3);
    expect(toegestaanTotNu(5, nl(15, 59))).toBe(5);
    expect(toegestaanTotNu(5, nl(16, 0))).toBe(5);
    expect(toegestaanTotNu(5, nl(23, 0))).toBe(5);
  });
  it('2 per dag: één vanaf 08:00, de tweede vanaf 12:00', () => {
    expect(toegestaanTotNu(2, nl(8, 5))).toBe(1);
    expect(toegestaanTotNu(2, nl(11, 59))).toBe(1);
    expect(toegestaanTotNu(2, nl(12, 1))).toBe(2);
  });
  it('geen dagmaximum: geen beperking', () => {
    expect(toegestaanTotNu(0, nl(3))).toBe(Infinity);
  });
  it('zomertijd telt ook in Nederlandse uren', () => {
    expect(toegestaanTotNu(5, new Date(Date.UTC(2026, 6, 1, 6, 0)))).toBe(1); /* 08:00 zomertijd */
    expect(toegestaanTotNu(5, new Date(Date.UTC(2026, 6, 1, 5, 59)))).toBe(0);
  });
});

describe('volgendeRuimte', () => {
  it('na de eerste lead om 08:10: weer ruimte rond 09:37', () => {
    const t = volgendeRuimte(5, 1, nl(8, 10));
    expect(t).not.toBeNull();
    const min = (t!.getTime() - nl(8, 0).getTime()) / 60_000;
    expect(min).toBeGreaterThan(95);
    expect(min).toBeLessThan(99);
  });
  it('nu al ruimte of maximum op: null', () => {
    expect(volgendeRuimte(5, 0, nl(9))).toBeNull();
    expect(volgendeRuimte(5, 5, nl(17))).toBeNull();
  });
  it('vóór 08:00: ruimte vanaf 08:00', () => {
    expect(volgendeRuimte(5, 0, nl(6))?.toISOString()).toBe(nl(8, 0).toISOString());
  });
});

describe('teLangGewacht', () => {
  it('langer dan 18 uur', () => {
    expect(teLangGewacht(new Date(nl(12).getTime() - 17 * 3_600_000).toISOString(), nl(12))).toBe(false);
    expect(teLangGewacht(new Date(nl(12).getTime() - 19 * 3_600_000).toISOString(), nl(12))).toBe(true);
    expect(teLangGewacht(null, nl(12))).toBe(false);
  });
});
