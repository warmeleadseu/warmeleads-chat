import { describe, it, expect } from 'vitest';
import { standNaarFilterParams, filterParamsNaarStand } from '../leadFilterParams';
import { LEGE_LEADFILTERS, telActieveLeadFilters, type LeadFilterStand } from '../leadFilterState';

/**
 * De rondgangtest is de kern: elke filter die het scherm kan zetten moet het
 * exportvenster weer kunnen inlezen. Viel er één uit, dan exporteerde je stilletjes
 * een bredere verzameling dan de lijst liet zien.
 */

const VOL: LeadFilterStand = {
  search: 'jansen',
  selBranches: ['warmtepomp', 'zonnepanelen'],
  selCustomers: ['klant-a', 'klant-b'],
  selStatuses: ['nieuw'],
  selProvinces: ['Noord-Brabant', 'Limburg'],
  selSources: ['meta'],
  selCampaigns: ['camp-1'],
  assignmentFilter: 'unassigned',
  phoneFilter: 'true',
  bulkFilter: 'never',
  dateFrom: '2026-09-12',
  dateTo: '2026-09-24',
  includeUnknownDate: false,
  plaatsFilter: 'Eindhoven',
  plaatsRadiusKm: 25,
  postcodeRanges: '7500-7599',
  provincieMargeKm: 5,
};

describe('standNaarFilterParams en terug', () => {
  it('houdt een volledig gevulde stand ongewijzigd na heen en weer', () => {
    expect(filterParamsNaarStand(standNaarFilterParams(VOL))).toEqual(VOL);
  });

  it('houdt de lege stand leeg', () => {
    expect(standNaarFilterParams(LEGE_LEADFILTERS)).toEqual({});
    expect(filterParamsNaarStand({})).toEqual(LEGE_LEADFILTERS);
  });

  it('geeft elk veld van de stand een eigen parameter', () => {
    const p = standNaarFilterParams(VOL);
    /* Zou een veld geen parameter opleveren, dan verdwijnt dat filter ongemerkt
       zodra de stand door deze functie gaat. Dit is de test die het gemis van
       `assignment` in het exportvenster gevangen zou hebben. */
    for (const sleutel of Object.keys(VOL) as (keyof LeadFilterStand)[]) {
      const zonder = standNaarFilterParams({ ...VOL, [sleutel]: LEGE_LEADFILTERS[sleutel] });
      expect(Object.keys(p).length, `veld ${sleutel} levert geen parameter op`)
        .toBeGreaterThan(Object.keys(zonder).length);
    }
  });

  it('zet het uitdeelfilter om in beide richtingen', () => {
    expect(standNaarFilterParams({ ...LEGE_LEADFILTERS, assignmentFilter: 'unassigned' }))
      .toEqual({ assignment: 'unassigned' });
    expect(standNaarFilterParams({ ...LEGE_LEADFILTERS, assignmentFilter: 'assigned' }))
      .toEqual({ assignment: 'assigned' });
    expect(filterParamsNaarStand({ assignment: 'unassigned' }).assignmentFilter).toBe('unassigned');
    expect(filterParamsNaarStand({ assignment: 'assigned' }).assignmentFilter).toBe('assigned');
  });

  it('negeert een onzinnige waarde voor het uitdeelfilter', () => {
    expect(filterParamsNaarStand({ assignment: 'onzin' }).assignmentFilter).toBe('all');
  });

  it('telt het uitdeelfilter mee als actief filter', () => {
    const scherm: LeadFilterStand = {
      ...LEGE_LEADFILTERS,
      selBranches: ['warmtepomp'],
      selProvinces: ['Noord-Brabant'],
      assignmentFilter: 'unassigned',
      dateFrom: '2026-09-12',
      dateTo: '2026-09-24',
    };
    expect(telActieveLeadFilters(scherm)).toBe(4);
    /* En het venster telt hetzelfde, want het leest dezelfde stand terug. */
    expect(telActieveLeadFilters(filterParamsNaarStand(standNaarFilterParams(scherm)))).toBe(4);
  });

  it('laat de provinciemarge weg zonder gekozen provincie', () => {
    const p = standNaarFilterParams({ ...LEGE_LEADFILTERS, provincieMargeKm: 5 });
    expect(p.province_margin_km).toBeUndefined();
  });

  it('laat de straal weg zonder plaatsnaam', () => {
    const p = standNaarFilterParams({ ...LEGE_LEADFILTERS, plaatsRadiusKm: 25 });
    expect(p.plaats_radius_km).toBeUndefined();
  });

  it('stuurt onbekende datums alleen mee als er een datumbereik staat', () => {
    expect(standNaarFilterParams({ ...LEGE_LEADFILTERS, includeUnknownDate: false }).include_unknown_date)
      .toBeUndefined();
    expect(standNaarFilterParams({ ...LEGE_LEADFILTERS, dateFrom: '2026-01-01', includeUnknownDate: false }).include_unknown_date)
      .toBe('false');
  });
});
