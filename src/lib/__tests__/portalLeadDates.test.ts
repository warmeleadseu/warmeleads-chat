import { describe, expect, it } from 'vitest';
import {
  daysAgoAmsterdam,
  formatRelativeLeadDate,
  mapsUrlForLead,
  startOfWeekAmsterdam,
  todayAmsterdam,
} from '../portalLeadDates';

describe('portalLeadDates', () => {
  it('returns ISO dates for today / week / daysAgo', () => {
    expect(todayAmsterdam()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(startOfWeekAmsterdam()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(daysAgoAmsterdam(7)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('formats relative dates', () => {
    expect(formatRelativeLeadDate(new Date().toISOString())).toMatch(/zojuist|\d+m geleden/);
    expect(formatRelativeLeadDate(null)).toBe('-');
  });

  it('builds maps url', () => {
    const url = mapsUrlForLead({
      postcode: '7511JE',
      huisnummer: '12',
      plaatsnaam: 'Enschede',
      land: 'NL',
    });
    expect(url).toContain('google.com/maps');
    expect(url).toContain('Enschede');
  });
});
