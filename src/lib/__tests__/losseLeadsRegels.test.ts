import { describe, expect, it } from 'vitest';
import { canAssignWithinCap, effectiveMaxAssignments } from '../assignmentCap';
import { exclusiefVoorKoper, isVerkoopbaar, leeftijdTekst, terugbetaling, zichtbareAntwoorden, type Bezet } from '../losseLeadsRegels';

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
  it('alleen tot 7 dagen oud', () => {
    expect(isVerkoopbaar(lead({ created_at: uurGeleden(7 * 24 - 1) }), leeg(), nu)).toBe(true);
    expect(isVerkoopbaar(lead({ created_at: uurGeleden(7 * 24 + 1) }), leeg(), nu)).toBe(false);
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
  it('terugbetaling naar rato, volledig als niets geleverd kon worden', () => {
    expect(terugbetaling(54.45, 3, 0)).toBe(0);
    expect(terugbetaling(54.45, 3, 1)).toBe(18.15);
    expect(terugbetaling(54.45, 3, 3)).toBe(54.45);
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
