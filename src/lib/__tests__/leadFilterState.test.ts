import { describe, it, expect } from 'vitest';
import { LEGE_LEADFILTERS, telActieveLeadFilters } from '../leadFilterState';

describe('telActieveLeadFilters', () => {
  it('telt de provinciemarge apart mee', () => {
    expect(telActieveLeadFilters({ ...LEGE_LEADFILTERS, provincieMargeKm: 10 })).toBe(1);
    expect(telActieveLeadFilters({ ...LEGE_LEADFILTERS, provincieMargeKm: 0 })).toBe(0);
    expect(telActieveLeadFilters({ ...LEGE_LEADFILTERS, provincieMargeKm: null })).toBe(0);
  });

  it('telt nul op een schone stand', () => {
    expect(telActieveLeadFilters(LEGE_LEADFILTERS)).toBe(0);
  });

  it('telt de zoekterm mee, maar niet als die alleen spaties is', () => {
    expect(telActieveLeadFilters({ ...LEGE_LEADFILTERS, search: 'jan' })).toBe(1);
    expect(telActieveLeadFilters({ ...LEGE_LEADFILTERS, search: '   ' })).toBe(0);
  });

  it('telt elke meerkeuzelijst als één filter, ongeacht het aantal keuzes', () => {
    expect(telActieveLeadFilters({ ...LEGE_LEADFILTERS, selBranches: ['a', 'b', 'c'] })).toBe(1);
  });

  it('telt een datumbereik als één filter', () => {
    expect(telActieveLeadFilters({ ...LEGE_LEADFILTERS, dateFrom: '2026-01-01' })).toBe(1);
    expect(telActieveLeadFilters({ ...LEGE_LEADFILTERS, dateFrom: '2026-01-01', dateTo: '2026-02-01' })).toBe(1);
  });

  it('telt de verfijning op onbekende datum niet apart', () => {
    expect(telActieveLeadFilters({ ...LEGE_LEADFILTERS, includeUnknownDate: false })).toBe(0);
  });

  it('telt de straal niet apart van de plaatsnaam', () => {
    expect(telActieveLeadFilters({ ...LEGE_LEADFILTERS, plaatsFilter: 'Utrecht', plaatsRadiusKm: 25 })).toBe(1);
  });

  it('telt de keuzelijsten met een vaste stand alleen als ze afwijken', () => {
    expect(telActieveLeadFilters({ ...LEGE_LEADFILTERS, assignmentFilter: 'unassigned' })).toBe(1);
    expect(telActieveLeadFilters({ ...LEGE_LEADFILTERS, phoneFilter: 'invalid' })).toBe(1);
    expect(telActieveLeadFilters({ ...LEGE_LEADFILTERS, bulkFilter: 'exported' })).toBe(1);
  });

  it('telt alles op bij een volle stand', () => {
    expect(telActieveLeadFilters({
      search: 'jan', selBranches: ['a'], selCustomers: ['b'], selStatuses: ['c'],
      selProvinces: ['d'], selSources: ['e'], selCampaigns: ['f'],
      assignmentFilter: 'assigned', phoneFilter: 'valid', bulkFilter: 'exported',
      dateFrom: '2026-01-01', dateTo: '2026-02-01', includeUnknownDate: false,
      plaatsFilter: 'Utrecht', plaatsRadiusKm: 25, postcodeRanges: '7500-7599',
      provincieMargeKm: 10,
    })).toBe(14);
  });
});
