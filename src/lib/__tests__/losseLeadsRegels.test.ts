import { describe, expect, it } from 'vitest';
import { canAssignWithinCap, effectiveMaxAssignments } from '../assignmentCap';
import {
  exclusiefVoorKoper, isVerkoopbaar, leeftijdTekst, prijsVoorLeeftijd, prijzenVanAankoop, regelsPerPrijs, terugbetaling,
  zichtbareAntwoorden, type Bezet,
} from '../losseLeadsRegels';

const nu = new Date('2026-10-27T12:00:00Z');
const uurGeleden = (u: number) => new Date(nu.getTime() - u * 3_600_000).toISOString();
const leeg = (): Bezet => ({ uitgedeeld: new Set(), gepland: new Set(), gereserveerd: new Set(), exclusiefElders: new Set() });
const lead = (over: Partial<{ id: string; branch: string; created_at: string; bron: string; phone_valid: boolean | null }> = {}) =>
  ({ id: 'l1', branch: 'thuisbatterij', created_at: uurGeleden(5), bron: 'meta', phone_valid: true, ...over });

describe('isVerkoopbaar', () => {
  it('een verse, nooit uitgedeelde lead in een toegestane branche', () => {
    expect(isVerkoopbaar(lead(), leeg(), nu)).toBe(true);
    for (const b of ['warmtepomp', 'zonnepanelen', 'airco', 'financial_lease']) {
      expect(isVerkoopbaar(lead({ branch: b }), leeg(), nu)).toBe(true);
    }
  });
  it('andere branches niet', () => {
    expect(isVerkoopbaar(lead({ branch: 'kozijnen' }), leeg(), nu)).toBe(false);
    expect(isVerkoopbaar(lead({ branch: 'dakrenovatie' }), leeg(), nu)).toBe(false);
  });
  it('tot en met 10 dagen oud', () => {
    expect(isVerkoopbaar(lead({ created_at: uurGeleden(10 * 24 + 23) }), leeg(), nu)).toBe(true);
    expect(isVerkoopbaar(lead({ created_at: uurGeleden(11 * 24) }), leeg(), nu)).toBe(false);
    expect(isVerkoopbaar(lead({ created_at: uurGeleden(-1) }), leeg(), nu)).toBe(false);
  });
  it('niet als hij is uitgedeeld, gepland, door een ander gereserveerd of exclusief elders', () => {
    for (const k of ['uitgedeeld', 'gepland', 'gereserveerd', 'exclusiefElders'] as const) {
      const b = leeg();
      b[k].add('l1');
      expect(isVerkoopbaar(lead(), b, nu)).toBe(false);
    }
  });
  it('geen import, demo of ongeldig nummer', () => {
    expect(isVerkoopbaar(lead({ bron: 'excel_import' }), leeg(), nu)).toBe(false);
    expect(isVerkoopbaar(lead({ bron: 'demo' }), leeg(), nu)).toBe(false);
    expect(isVerkoopbaar(lead({ phone_valid: false }), leeg(), nu)).toBe(false);
    expect(isVerkoopbaar(lead({ phone_valid: null }), leeg(), nu)).toBe(true);
  });
});

describe('prijsVoorLeeftijd', () => {
  it('staffels naar hele dagen, zoals het portaal de leeftijd toont', () => {
    expect(prijsVoorLeeftijd(uurGeleden(0), nu)).toBe(15);
    expect(prijsVoorLeeftijd(uurGeleden(3 * 24 + 23), nu)).toBe(15);
    expect(prijsVoorLeeftijd(uurGeleden(4 * 24), nu)).toBe(12.5);
    expect(prijsVoorLeeftijd(uurGeleden(5 * 24 + 23), nu)).toBe(12.5);
    expect(prijsVoorLeeftijd(uurGeleden(6 * 24), nu)).toBe(10);
    expect(prijsVoorLeeftijd(uurGeleden(7 * 24 + 23), nu)).toBe(10);
    expect(prijsVoorLeeftijd(uurGeleden(8 * 24), nu)).toBe(7.5);
    expect(prijsVoorLeeftijd(uurGeleden(10 * 24 + 23), nu)).toBe(7.5);
  });
  it('te oud of nog niet binnen: geen prijs', () => {
    expect(prijsVoorLeeftijd(uurGeleden(11 * 24), nu)).toBeNull();
    expect(prijsVoorLeeftijd(uurGeleden(-25), nu)).toBeNull();
    expect(prijsVoorLeeftijd('geen datum', nu)).toBeNull();
  });
  it('label en prijs vallen samen', () => {
    expect(leeftijdTekst(uurGeleden(3 * 24 + 23), nu)).toBe('3 dagen oud');
    expect(leeftijdTekst(uurGeleden(4 * 24), nu)).toBe('4 dagen oud');
  });
});

describe('prijzenVanAankoop', () => {
  const binnen = new Map([['a', uurGeleden(5)], ['b', uurGeleden(4 * 24 + 2)], ['c', uurGeleden(9 * 24)]]);
  /* De aankoop werd een uur geleden afgerekend: toen was b 4 dagen en 1 uur oud. */
  const aankoop = { lead_ids: ['a', 'b', 'c'], created_at: uurGeleden(1), totaal_excl: 35, prijs_per_lead: 11.67 };
  it('de prijs van het moment van afrekenen, ook als die nu lager zou zijn', () => {
    expect([...prijzenVanAankoop(aankoop, binnen)]).toEqual([['a', 15], ['b', 12.5], ['c', 7.5]]);
  });
  it('som klopt niet met het betaalde bedrag (oude aankoop): gemiddelde prijs', () => {
    const oud = { ...aankoop, totaal_excl: 45, prijs_per_lead: 15 };
    expect([...prijzenVanAankoop(oud, binnen).values()]).toEqual([15, 15, 15]);
  });
  it('lead bestaat niet meer: gemiddelde prijs', () => {
    expect([...prijzenVanAankoop({ ...aankoop, lead_ids: ['a', 'x'] }, binnen).values()]).toEqual([11.67, 11.67]);
  });
  it('factuurregels per prijs, duurste eerst', () => {
    expect(regelsPerPrijs([7.5, 15, 7.5, 12.5])).toEqual([
      { aantal: 1, prijs_per_lead: 15 }, { aantal: 1, prijs_per_lead: 12.5 }, { aantal: 2, prijs_per_lead: 7.5 },
    ]);
  });
});

describe('zichtbareAntwoorden', () => {
  it('laat persoons- en adresgegevens en vrije tekst weg', () => {
    const a = zichtbareAntwoorden({
      straat: 'Dorpsstraat', huisnummer: '12', postcode: '1234AB', email: 'a@b.nl', telefoon: '0612345678',
      opmerkingen: 'Bel na 18u', type_airco: 'Multi split-unit airco', hoeveel_ruimtes: '3 ruimtes of meer',
      vreemd: 'mail mij op x@y.nl', nummer_in_tekst: 'bel 0612345678',
    });
    expect(a).toEqual([
      { label: 'Type airco', waarde: 'Multi split-unit airco' },
      { label: 'Hoeveel ruimtes', waarde: '3 ruimtes of meer' },
    ]);
  });
  it('geen object: niets', () => {
    expect(zichtbareAntwoorden(null)).toEqual([]);
    expect(zichtbareAntwoorden(['x'])).toEqual([]);
  });
});

describe('leeftijdTekst en terugbetaling', () => {
  it('leesbare leeftijd', () => {
    expect(leeftijdTekst(uurGeleden(0.5), nu)).toBe('net binnen');
    expect(leeftijdTekst(uurGeleden(5), nu)).toBe('5 uur oud');
    expect(leeftijdTekst(uurGeleden(30), nu)).toBe('1 dag oud');
    expect(leeftijdTekst(uurGeleden(80), nu)).toBe('3 dagen oud');
  });
  it('terugbetaling naar rato van de prijs, volledig als niets geleverd kon worden', () => {
    expect(terugbetaling(54.45, 45, 0)).toBe(0);
    expect(terugbetaling(54.45, 45, 15)).toBe(18.15);
    expect(terugbetaling(54.45, 45, 45)).toBe(54.45);
    /* 15 + 12,50 + 7,50 = 35 excl, 42,35 incl; de lead van 7,50 was weg. */
    expect(terugbetaling(42.35, 35, 7.5)).toBe(9.08);
  });
});

describe('exclusiefVoorKoper', () => {
  it('zet het plafond op 1 en laat de rest staan', () => {
    expect(exclusiefVoorKoper({ dak: 'plat', max_customer_assignments: 3 })).toEqual({ dak: 'plat', max_customer_assignments: 1 });
  });
  it('werkt ook zonder of met ongeldige custom_fields', () => {
    expect(exclusiefVoorKoper(null)).toEqual({ max_customer_assignments: 1 });
    expect(exclusiefVoorKoper(['x'])).toEqual({ max_customer_assignments: 1 });
  });
  it('de verdeling ziet de lead daarna als vol na de koper', () => {
    const cf = exclusiefVoorKoper({});
    expect(effectiveMaxAssignments({ custom_fields: cf })).toBe(1);
    expect(canAssignWithinCap({ custom_fields: cf }, [{ customer_id: 'koper', assigned_at: nu.toISOString() }], 'ander', nu)).toBe(false);
  });
  it('interne velden komen niet in de zichtbare antwoorden', () => {
    expect(zichtbareAntwoorden({ max_customer_assignments: 1, meta_lead_form_id: 'abc', dak: 'plat' })).toEqual([{ label: 'Dak', waarde: 'plat' }]);
  });
});
