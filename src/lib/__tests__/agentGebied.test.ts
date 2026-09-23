import { describe, it, expect } from 'vitest';
import {
  agentDektLocatie,
  valtBinnenGebieden,
  valtBinnenProvincies,
  leesGebieden,
  isGeldigGebied,
  beschrijfGebied,
  type AgentRegels,
} from '../agentGebied';

/**
 * Regressietests bij de spiegelfout: distribution.ts controleerde alleen
 * provincies, appointmentAssignment.ts alleen postcodes, en de teampagina
 * schreef uitsluitend provincies weg. Bij afspraken werd het werkgebied van
 * een agent daardoor volledig genegeerd.
 */

const ROERMOND = { lat: 51.1942, lng: 5.9873 };
const ZWOLLE = { lat: 52.5168, lng: 6.0830 };

const inLimburg = { provincie: 'Limburg', land: 'NL', postcode: '6041 AA', ...ROERMOND };
const inOverijssel = { provincie: 'Overijssel', land: 'NL', postcode: '8011 AA', ...ZWOLLE };

describe('isGeldigGebied', () => {
  it('accepteert een compleet gebied', () => {
    expect(isGeldigGebied({ label: 'Roermond', lat: 51.19, lng: 5.98, radius_km: 30 })).toBe(true);
  });

  it('wijst onvolledige of onzinnige gebieden af', () => {
    expect(isGeldigGebied({ label: '', lat: 51, lng: 5, radius_km: 30 })).toBe(false);
    expect(isGeldigGebied({ label: 'X', lat: 51, lng: 5, radius_km: 0 })).toBe(false);
    expect(isGeldigGebied({ label: 'X', lat: 51, lng: 5 })).toBe(false);
    expect(isGeldigGebied({ label: 'X', lat: 'veel', lng: 5, radius_km: 10 })).toBe(false);
    expect(isGeldigGebied(null)).toBe(false);
  });
});

describe('leesGebieden', () => {
  it('filtert kapotte rijen eruit in plaats van te klappen', () => {
    const regels = {
      gebieden: [
        { label: 'Roermond', lat: 51.19, lng: 5.98, radius_km: 30 },
        { label: 'Kapot', lat: null },
      ],
    } as unknown as AgentRegels;
    expect(leesGebieden(regels)).toHaveLength(1);
  });

  it('gaat om met een ontbrekend of verkeerd veld', () => {
    expect(leesGebieden(null)).toEqual([]);
    expect(leesGebieden({ gebieden: 'onzin' } as unknown as AgentRegels)).toEqual([]);
  });
});

describe('valtBinnenGebieden', () => {
  const gebieden = [{ label: 'Roermond', ...ROERMOND, radius_km: 30 }];

  it('ziet een locatie binnen de straal', () => {
    expect(valtBinnenGebieden(gebieden, inLimburg)).toBe(true);
  });

  it('ziet een locatie ver buiten de straal niet', () => {
    expect(valtBinnenGebieden(gebieden, inOverijssel)).toBe(false);
  });

  it('kan niets zeggen zonder coordinaten', () => {
    expect(valtBinnenGebieden(gebieden, { provincie: 'Limburg', land: 'NL' })).toBe(false);
  });

  it('zonder gebieden is er niets om binnen te vallen', () => {
    expect(valtBinnenGebieden([], inLimburg)).toBe(false);
  });
});

describe('valtBinnenProvincies', () => {
  it('herkent de provincie', () => {
    const r: AgentRegels = { regions: { type: 'provinces', values: ['NL:Limburg'] } };
    expect(valtBinnenProvincies(r, inLimburg)).toBe(true);
    expect(valtBinnenProvincies(r, inOverijssel)).toBe(false);
  });

  it('ondersteunt ook postcodes', () => {
    /* Dit type werd door de leadverdeling genegeerd. */
    const r: AgentRegels = { regions: { type: 'postcodes', values: ['6041'] } };
    expect(valtBinnenProvincies(r, inLimburg)).toBe(true);
    expect(valtBinnenProvincies(r, inOverijssel)).toBe(false);
  });

  it('gaat uit van provincies als het type ontbreekt', () => {
    const r = { regions: { values: ['NL:Limburg'] } } as AgentRegels;
    expect(valtBinnenProvincies(r, inLimburg)).toBe(true);
  });
});

describe('agentDektLocatie', () => {
  it('dekt alles als er niets is ingesteld', () => {
    /* Een agent zonder werkgebied moet gewoon alles blijven ontvangen. */
    expect(agentDektLocatie({}, inLimburg)).toBe(true);
    expect(agentDektLocatie(null, inOverijssel)).toBe(true);
    expect(agentDektLocatie({ regions: { type: 'provinces', values: [] } }, inLimburg)).toBe(true);
  });

  it('dekt via de provincie', () => {
    const r: AgentRegels = { regions: { type: 'provinces', values: ['NL:Limburg'] } };
    expect(agentDektLocatie(r, inLimburg)).toBe(true);
    expect(agentDektLocatie(r, inOverijssel)).toBe(false);
  });

  it('dekt via een straal rond een plaats', () => {
    const r: AgentRegels = { gebieden: [{ label: 'Roermond', ...ROERMOND, radius_km: 30 }] };
    expect(agentDektLocatie(r, inLimburg)).toBe(true);
    expect(agentDektLocatie(r, inOverijssel)).toBe(false);
  });

  it('combineert provincies en stralen als OF, niet als EN', () => {
    /* Een agent met Limburg én een cirkel rond Zwolle werkt in allebei. Zou dit
       een EN zijn, dan stel je twee gebieden in en ontvang je niets meer. */
    const r: AgentRegels = {
      regions: { type: 'provinces', values: ['NL:Limburg'] },
      gebieden: [{ label: 'Zwolle', ...ZWOLLE, radius_km: 25 }],
    };
    expect(agentDektLocatie(r, inLimburg)).toBe(true);
    expect(agentDektLocatie(r, inOverijssel)).toBe(true);
    expect(agentDektLocatie(r, { provincie: 'Groningen', land: 'NL', lat: 53.219, lng: 6.566 })).toBe(false);
  });

  it('laat een lead zonder coordinaten toch door op de provincie', () => {
    /* Anders valt een lead die alleen een provincie heeft overal buiten. */
    const r: AgentRegels = {
      regions: { type: 'provinces', values: ['NL:Limburg'] },
      gebieden: [{ label: 'Zwolle', ...ZWOLLE, radius_km: 25 }],
    };
    expect(agentDektLocatie(r, { provincie: 'Limburg', land: 'NL' })).toBe(true);
  });
});

describe('beschrijfGebied', () => {
  it('beschrijft de samenstelling', () => {
    expect(beschrijfGebied({})).toBe('Heel het werkgebied');
    expect(beschrijfGebied({ regions: { type: 'provinces', values: ['NL:Limburg'] } })).toBe('1 provincie');
    expect(beschrijfGebied({ gebieden: [{ label: 'X', lat: 1, lng: 1, radius_km: 5 }] })).toBe('1 straal');
    expect(beschrijfGebied({
      regions: { type: 'provinces', values: ['NL:Limburg', 'NL:Brabant'] },
      gebieden: [{ label: 'X', lat: 1, lng: 1, radius_km: 5 }],
    })).toBe('2 provincies + 1 straal');
  });
});
