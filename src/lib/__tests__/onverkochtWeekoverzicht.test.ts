import { describe, expect, it, vi } from 'vitest';

vi.mock('../email', () => ({ EMAIL_BASE_URL: 'https://www.warmeleads.eu' }));

import { bouwInhoud, crmLink, groepeer, vorigeWeek } from '../onverkochtWeekoverzicht';

describe('vorigeWeek', () => {
  it('maandagochtend: de week ervoor, maandag t/m zondag', () => {
    expect(vorigeWeek(new Date('2026-10-12T06:00:00Z'))).toEqual({ van: '2026-10-05', tot: '2026-10-11' });
  });
  it('zondagavond: nog de week daarvoor', () => {
    expect(vorigeWeek(new Date('2026-10-11T20:00:00Z'))).toEqual({ van: '2026-09-28', tot: '2026-10-04' });
  });
  it('zondag 23:30 UTC is in Nederland al maandag', () => {
    expect(vorigeWeek(new Date('2026-10-11T23:30:00Z'))).toEqual({ van: '2026-10-05', tot: '2026-10-11' });
  });
});

describe('groepeer', () => {
  it('per branche en regio, grootste eerst', () => {
    const g = groepeer([
      { branch: 'warmtepomp', provincie: 'Gelderland', land: 'NL' },
      { branch: 'warmtepomp', provincie: 'Gelderland', land: 'NL' },
      { branch: 'warmtepomp', provincie: 'Limburg', land: 'NL' },
      { branch: 'kozijnen', provincie: 'Groningen', land: 'NL' },
      { branch: 'isolatie', provincie: null, land: 'BE' },
    ]);
    expect(g[0]).toEqual({ branch: 'warmtepomp', totaal: 3, regios: [{ provincie: 'Gelderland', aantal: 2 }, { provincie: 'Limburg', aantal: 1 }] });
    expect(g.find(x => x.branch === 'isolatie')?.regios[0].provincie).toBe('België (provincie onbekend)');
  });
});

describe('crmLink', () => {
  const week = { van: '2026-10-05', tot: '2026-10-11' };
  it('zet de filters van Leads CRM klaar', () => {
    const u = new URL(crmLink(week, 'warmtepomp', 'Noord-Brabant'));
    expect(u.pathname).toBe('/admin/leads');
    expect(Object.fromEntries(u.searchParams)).toEqual({
      assignment: 'unassigned', phone_valid: 'true', date_from: '2026-10-05', date_to: '2026-10-11',
      include_unknown_date: 'false', branch: 'warmtepomp', province: 'Noord-Brabant',
    });
  });
  it('geen provinciefilter bij een onbekende regio', () => {
    expect(new URL(crmLink(week, 'isolatie', 'België (provincie onbekend)')).searchParams.has('province')).toBe(false);
  });
});

describe('bouwInhoud', () => {
  it('noemt het datumbereik en ontsnapt namen', () => {
    const { onderwerp, html } = bouwInhoud({ van: '2026-10-05', tot: '2026-10-11' }, groepeer([{ branch: 'x', provincie: '<b>', land: 'NL' }]), s => s, { totaalLeads: 10, nepnummers: 2 });
    expect(onderwerp).toBe('Onverkochte leads week 05-10 t/m 11-10: 1 zonder koper');
    expect(html).toContain('maandag 5 oktober 2026 t/m zondag 11 oktober 2026');
    expect(html).toContain('&lt;b&gt;');
    expect(html).toContain('2 leads met een ongeldig nummer');
  });
});
