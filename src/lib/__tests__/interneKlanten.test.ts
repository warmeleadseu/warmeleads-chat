import { describe, expect, it } from 'vitest';
import { zonderInterneKlanten } from '../interneKlanten';
import { canAssignWithinCap } from '../assignmentCap';
import { volgendeKlantVanaf } from '../wachttijdKlanten';

const nu = new Date('2026-11-10T12:00:00Z');
const uurGeleden = (u: number) => new Date(nu.getTime() - u * 3_600_000).toISOString();
const intern = new Set(['wl-intern']);

describe('zonderInterneKlanten', () => {
  it('laat interne klanten weg en houdt de rest', () => {
    const rijen = [{ customer_id: 'wl-intern' }, { customer_id: 'a' }, { customer_id: null }];
    expect(zonderInterneKlanten(rijen, intern)).toEqual([{ customer_id: 'a' }, { customer_id: null }]);
  });

  it('zonder interne klanten blijft alles staan', () => {
    expect(zonderInterneKlanten([{ customer_id: 'a' }], new Set())).toEqual([{ customer_id: 'a' }]);
  });

  it('een interne klant bezet geen plek: drie betalende naast een interne', () => {
    const bestaand = [
      { customer_id: 'wl-intern', assigned_at: uurGeleden(40) },
      { customer_id: 'a', assigned_at: uurGeleden(30) },
      { customer_id: 'b', assigned_at: uurGeleden(20) },
    ];
    expect(canAssignWithinCap({}, bestaand, 'c', nu)).toBe(false);
    expect(canAssignWithinCap({}, zonderInterneKlanten(bestaand, intern), 'c', nu)).toBe(true);
  });

  it('een vierde externe klant blijft geweigerd', () => {
    const bestaand = [
      { customer_id: 'a', assigned_at: uurGeleden(30) },
      { customer_id: 'b', assigned_at: uurGeleden(20) },
      { customer_id: 'c', assigned_at: uurGeleden(10) },
    ];
    expect(canAssignWithinCap({}, zonderInterneKlanten(bestaand, intern), 'd', nu)).toBe(false);
  });

  it('na alleen een interne klant hoeft de eerste betalende klant niet te wachten', () => {
    const bestaand = [{ customer_id: 'wl-intern', assigned_at: uurGeleden(1) }];
    expect(volgendeKlantVanaf(bestaand, 'a', nu)).not.toBeNull();
    expect(volgendeKlantVanaf(zonderInterneKlanten(bestaand, intern), 'a', nu)).toBeNull();
  });
});
