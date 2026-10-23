import { describe, expect, it } from 'vitest';
import { volgendeKlantVanaf, wachttijdUren } from '../wachttijdKlanten';
import { inhaalslagWeigering } from '../verdeelGrenzen';
import { planMomenten } from '../restleadPlanning';
import { planVolgendeKlanten } from '../restleads';

const NU = new Date('2026-10-24T10:00:00Z');
const uur = (u: number) => new Date(NU.getTime() - u * 3_600_000).toISOString();

describe('wachttijd tussen klanten', () => {
  it('12 uur voor de tweede klant, 8 uur voor de derde', () => {
    expect(wachttijdUren(1)).toBe(12);
    expect(wachttijdUren(2)).toBe(8);
  });

  it('volgende klant: 12 uur na de eerste', () => {
    const v = volgendeKlantVanaf([{ customer_id: 'a', assigned_at: uur(3) }], 'x', NU);
    expect(v?.toISOString()).toBe(new Date(NU.getTime() + 9 * 3_600_000).toISOString());
  });

  it('derde klant: 8 uur na de tweede (niet 12)', () => {
    const bestaand = [{ customer_id: 'a', assigned_at: uur(20) }, { customer_id: 'b', assigned_at: uur(9) }];
    expect(volgendeKlantVanaf(bestaand, 'x', NU)).toBeNull();
    const net = [{ customer_id: 'a', assigned_at: uur(20) }, { customer_id: 'b', assigned_at: uur(5) }];
    expect(volgendeKlantVanaf(net, 'x', NU)?.toISOString()).toBe(new Date(NU.getTime() + 3 * 3_600_000).toISOString());
  });

  it('wachtrij en lookback: zelfde regel (pauze 8 uur na de tweede)', () => {
    const bestaand = [{ customer_id: 'a', assigned_at: uur(20) }, { customer_id: 'b', assigned_at: uur(9) }];
    expect(inhaalslagWeigering(bestaand, 'x', NU)).toBe('derde_klant');
    expect(inhaalslagWeigering([{ customer_id: 'a', assigned_at: uur(20) }, { customer_id: 'b', assigned_at: uur(5) }], 'x', NU)).toBe('pauze');
    expect(inhaalslagWeigering([{ customer_id: 'a', assigned_at: uur(9) }], 'x', NU)).toBe('pauze');
  });

  it('handmatig twee klanten uitdelen: de derde minstens 8 uur na de tweede', () => {
    const m = planMomenten({ laatsteToewijzing: new Date(uur(30)), aantal: 2, nu: NU, klantenAl: 1 });
    expect(m).toHaveLength(2);
    /* Minstens 8 uur ertussen; handmatige leveringen vallen binnen werktijd (09-17), dus vaak de volgende ochtend. */
    expect((m[1].getTime() - m[0].getTime()) / 3_600_000).toBeGreaterThanOrEqual(8);
    /* Eerste: 12 uur na de vorige klant (hier al lang voorbij, dus nu of de eerstvolgende werktijd). */
    expect(m[0].getTime()).toBeGreaterThanOrEqual(NU.getTime());
  });

  it('planregel voor de pagina: volgende klant en de plek daarna', () => {
    const p = planVolgendeKlanten({ laatsteToewijzing: new Date(uur(2)), aantalKlanten: 1, maxKlanten: 3, nu: NU });
    expect(p.wachtUren).toBe(12);
    expect(p.vanaf?.toISOString()).toBe(new Date(NU.getTime() + 10 * 3_600_000).toISOString());
    expect(p.daarnaUren).toBe(8);
    expect(planVolgendeKlanten({ laatsteToewijzing: new Date(uur(2)), aantalKlanten: 2, maxKlanten: 3, nu: NU }).daarnaUren).toBeNull();
  });
});
