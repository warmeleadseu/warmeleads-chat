import { describe, expect, it, vi } from 'vitest';
import { groepeerMomenten, isEigen, leesMoment, momentLabel, nlNaarIso, nlTijd, popupFase, schoonApparaat, snelkeuzes, telLink, uitstelkeuzes } from '../terugbellen';
import { aanmeldingenVoor, bouwDagoverzicht, dagoverzichtNu, nogNietAanwezig } from '../terugbelMeldingen';
import { bouwAgendaIcs } from '../agendaIcs';

vi.mock('../email', () => ({ EMAIL_BASE_URL: 'https://x', layout: (_: string, h: string) => h, sendEmail: vi.fn() }));
vi.mock('../pushNotification', () => ({ verstuurPush: vi.fn() }));

/** Woensdag 25 november 2026, 11:02 in Nederland (wintertijd). */
const NU = new Date('2026-11-25T10:02:00Z');

describe('tijdstip kiezen', () => {
  it('rekent in Nederlandse tijd, ook in de zomer', () => {
    expect(nlNaarIso('2026-11-26', '10:00')).toBe('2026-11-26T09:00:00.000Z');
    expect(nlNaarIso('2027-07-01', '10:00')).toBe('2027-07-01T08:00:00.000Z');
    expect(nlNaarIso('26-11-2026', '10:00')).toBeNull();
    expect(nlTijd('2026-11-26T09:00:00Z')).toBe('10:00');
  });
  it('weigert voorbij, te ver weg en onzin', () => {
    expect(leesMoment('2026-11-25T12:00:00Z', NU)).toEqual({ ok: true, iso: '2026-11-25T12:00:00.000Z' });
    expect(leesMoment('2026-11-25T09:00:00Z', NU).ok).toBe(false);
    expect(leesMoment('2028-01-01T09:00:00Z', NU).ok).toBe(false);
    expect(leesMoment('morgen', NU).ok).toBe(false);
    expect(leesMoment(undefined, NU).ok).toBe(false);
  });
  it('snelkeuzes passen bij het moment van de dag', () => {
    expect(snelkeuzes(NU)).toEqual([
      { label: 'Over 1 uur', iso: '2026-11-25T11:05:00.000Z' },
      { label: 'Vanmiddag 14:00', iso: '2026-11-25T13:00:00.000Z' },
      { label: 'Morgen 10:00', iso: '2026-11-26T09:00:00.000Z' },
      { label: 'Morgen 19:00', iso: '2026-11-26T18:00:00.000Z' },
      { label: 'Maandag 10:00', iso: '2026-11-30T09:00:00.000Z' },
    ]);
    expect(snelkeuzes(new Date('2026-11-25T15:00:00Z')).map(k => k.label)).toContain('Vanavond 19:00');
    /* Zondag: maandag is al "morgen". Maandag: de volgende maandag. */
    expect(snelkeuzes(new Date('2026-11-29T10:00:00Z')).map(k => k.label)).not.toContain('Maandag 10:00');
    expect(snelkeuzes(new Date('2026-11-30T10:00:00Z')).at(-1)).toEqual({ label: 'Maandag 10:00', iso: '2026-12-07T09:00:00.000Z' });
    for (const k of [...snelkeuzes(NU), ...uitstelkeuzes(NU)]) expect(leesMoment(k.iso, NU).ok).toBe(true);
  });
  it('labels', () => {
    expect(momentLabel('2026-11-25T13:00:00Z', NU)).toBe('vandaag 14:00');
    expect(momentLabel('2026-11-26T09:00:00Z', NU)).toBe('morgen 10:00');
    expect(momentLabel('2026-11-24T09:00:00Z', NU)).toBe('gisteren 10:00');
    expect(momentLabel('2026-12-01T09:00:00Z', NU)).toMatch(/1 dec.* 10:00$/);
  });
});

describe('voor wie is het seintje', () => {
  const basis = { portal_user_id: null, apparaat: null, voor_iedereen: false };
  it('een gebruiker, een browser, of iedereen', () => {
    expect(isEigen({ ...basis, portal_user_id: 'u1' }, { portalUserId: 'u1', apparaat: 'a' })).toBe(true);
    expect(isEigen({ ...basis, portal_user_id: 'u1' }, { portalUserId: null, apparaat: 'a' })).toBe(false);
    expect(isEigen({ ...basis, apparaat: 'a' }, { portalUserId: null, apparaat: 'a' })).toBe(true);
    expect(isEigen({ ...basis, apparaat: 'a' }, { portalUserId: null, apparaat: 'b' })).toBe(false);
    expect(isEigen({ ...basis, portal_user_id: 'u1', voor_iedereen: true }, { portalUserId: 'u2', apparaat: null })).toBe(true);
    expect(isEigen(basis, { portalUserId: null, apparaat: 'b' })).toBe(true);
  });
  it('dezelfde verdeling voor pushmeldingen', () => {
    const subs = [{ id: 1, portal_user_id: 'u1', apparaat: 'a' }, { id: 2, portal_user_id: null, apparaat: 'b' }, { id: 3, portal_user_id: null, apparaat: null }];
    expect(aanmeldingenVoor({ ...basis, portal_user_id: 'u1' }, subs).map(s => s.id)).toEqual([1]);
    expect(aanmeldingenVoor({ ...basis, apparaat: 'b' }, subs).map(s => s.id)).toEqual([2]);
    expect(aanmeldingenVoor({ ...basis, apparaat: 'z' }, subs)).toEqual([]);
    expect(aanmeldingenVoor({ ...basis, voor_iedereen: true }, subs)).toHaveLength(3);
  });
  it('accepteert alleen een net apparaatkenmerk', () => {
    expect(schoonApparaat('0b1c2d3e-aaaa-4bbb-8ccc-123456789abc')).toBeTruthy();
    expect(schoonApparaat('a,b.eq.c')).toBeNull();
    expect(schoonApparaat(5)).toBeNull();
  });
});

describe('pop-up', () => {
  const t = Date.parse('2026-11-25T12:00:00Z');
  const fase = (eigen: boolean, min: number) => popupFase({ terug_op: '2026-11-25T12:00:00Z', eigen }, t + min * 60_000);
  it('bij de eigenaar vanaf 5 minuten ervoor tot 30 minuten erna', () => {
    expect(fase(true, -6)).toBeNull();
    expect(fase(true, -5)).toBe('vooraf');
    expect(fase(true, 0)).toBe('nu');
    expect(fase(true, 30)).toBe('nu');
    expect(fase(true, 31)).toBeNull();
  });
  it('bij de anderen pas als niemand reageert', () => {
    expect(fase(false, -5)).toBeNull();
    expect(fase(false, 1)).toBeNull();
    expect(fase(false, 2)).toBe('nu');
    expect(fase(false, 16)).toBeNull();
  });
});

describe('lijst, mail en agenda', () => {
  const m = (terug_op: string, naam = 'Jan') => ({ terug_op, naam, plaats: 'Utrecht', notitie: null });
  it('groepeert op gemist, vandaag en later, op tijd', () => {
    const g = groepeerMomenten([m('2026-11-26T09:00:00Z'), m('2026-11-25T15:00:00Z'), m('2026-11-25T12:00:00Z'), m('2026-11-24T12:00:00Z')], NU);
    expect(g.gemist).toHaveLength(1);
    expect(g.vandaag.map(x => x.terug_op)).toEqual(['2026-11-25T12:00:00Z', '2026-11-25T15:00:00Z']);
    expect(g.later).toHaveLength(1);
  });
  it('geen mail als er vandaag niets is, en geen html uit namen', () => {
    expect(bouwDagoverzicht([m('2026-11-27T09:00:00Z')], NU)).toBeNull();
    const mail = bouwDagoverzicht([m('2026-11-25T12:00:00Z', '<b>Jan</b>'), m('2026-11-24T12:00:00Z')], NU)!;
    expect(mail.onderwerp).toBe('Vandaag terugbellen: 2 leads');
    expect(mail.html).toContain('&lt;b&gt;Jan');
    expect(mail.html).toContain('Gemist (1)');
  });
  it('het dagoverzicht gaat om 8 uur Nederlandse tijd, zomer en winter', () => {
    expect(dagoverzichtNu(new Date('2026-11-25T07:05:00Z'))).toBe(true);
    expect(dagoverzichtNu(new Date('2026-11-25T06:05:00Z'))).toBe(false);
    expect(dagoverzichtNu(new Date('2026-07-01T06:05:00Z'))).toBe(true);
    expect(dagoverzichtNu(new Date('2026-11-25T07:20:00Z'))).toBe(false);
  });
  it('doet niets zolang de migratie ontbreekt', () => {
    expect(nogNietAanwezig({ code: 'PGRST205' })).toBe(true);
    expect(nogNietAanwezig({ code: '42703' })).toBe(true);
    expect(nogNietAanwezig({ code: '57014' })).toBe(false);
    expect(nogNietAanwezig(null)).toBe(false);
  });
  it('staat als terugbelmoment in de agenda en houdt die niet bezet', () => {
    const ics = bouwAgendaIcs(
      [{ id: '1', starts_at: '2026-11-25T12:00:00Z', duration_minutes: 15, status: 'scheduled', contact_name: 'Jan', soort: 'terugbellen' },
        { id: '2', starts_at: '2026-11-25T13:00:00Z', duration_minutes: 60, status: 'scheduled', contact_name: 'Piet' }],
      { kalenderNaam: 'x', siteUrl: 'https://x' },
    );
    expect(ics).toContain('SUMMARY:Terugbellen: Jan');
    expect(ics).toContain('UID:terugbellen-1@warmeleads.eu');
    expect(ics).toContain('TRANSP:TRANSPARENT');
    expect(ics).toContain('SUMMARY:Piet');
    expect(ics).toContain('UID:afspraak-2@warmeleads.eu');
  });
  it('tel-link', () => {
    expect(telLink('06 - 12 34 56 78')).toBe('tel:0612345678');
    expect(telLink('+31 6 12345678')).toBe('tel:+31612345678');
    expect(telLink('onbekend')).toBeNull();
    expect(telLink(null)).toBeNull();
  });
});
