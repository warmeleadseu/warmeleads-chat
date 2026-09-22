import { describe, it, expect, beforeAll } from 'vitest';
import {
  bouwAgendaIcs,
  vouwRegel,
  escapeIcs,
  formatIcsDate,
  maakAgendaToken,
  controleerAgendaToken,
  type IcsAfspraak,
} from '../agendaIcs';

beforeAll(() => {
  process.env.CRON_SECRET = 'testgeheim-voor-agenda-tokens';
});

function afspraak(over: Partial<IcsAfspraak> = {}): IcsAfspraak {
  return {
    id: 'a1',
    starts_at: '2026-09-24T09:00:00.000Z',
    duration_minutes: 60,
    status: 'scheduled',
    contact_name: 'Jan Jansen',
    contact_phone: '0612345678',
    street: 'Dorpsstraat',
    house_number: '12',
    postcode: '1011 AB',
    city: 'Amsterdam',
    branch: 'thuisbatterij',
    updated_at: '2026-09-22T08:00:00.000Z',
    ...over,
  };
}

const OPTIES = {
  kalenderNaam: 'WarmeLeads agenda',
  siteUrl: 'https://www.warmeleads.eu',
  branchNamen: { thuisbatterij: 'Thuisbatterij' },
};

describe('bouwAgendaIcs', () => {
  it('levert een geldig omhulsel met CRLF-regeleindes', () => {
    const ics = bouwAgendaIcs([], OPTIES);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    /* Losse \n zonder \r breekt Outlook. */
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('zet elke afspraak in een eigen VEVENT met een stabiele UID', () => {
    const ics = bouwAgendaIcs([afspraak(), afspraak({ id: 'a2' })], OPTIES);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain('UID:afspraak-a1@warmeleads.eu');
    expect(ics).toContain('UID:afspraak-a2@warmeleads.eu');
  });

  it('rekent de eindtijd uit de duur', () => {
    const ics = bouwAgendaIcs([afspraak({ duration_minutes: 90 })], OPTIES);
    expect(ics).toContain('DTSTART:20260924T090000Z');
    expect(ics).toContain('DTEND:20260924T103000Z');
  });

  it('zet branche en adres erbij', () => {
    const ics = bouwAgendaIcs([afspraak()], OPTIES);
    expect(ics).toContain('SUMMARY:Jan Jansen (Thuisbatterij)');
    expect(ics).toContain('LOCATION:Dorpsstraat 12');
  });

  it('slaat een afspraak met een onleesbare datum over in plaats van te crashen', () => {
    const ics = bouwAgendaIcs([afspraak({ starts_at: 'onzin' }), afspraak({ id: 'a2' })], OPTIES);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics).toContain('afspraak-a2');
  });

  it('markeert een geannuleerde afspraak als CANCELLED', () => {
    /* Zo verdwijnt hij uit de agenda van de gebruiker in plaats van te blijven
       staan als geldige afspraak. */
    expect(bouwAgendaIcs([afspraak({ status: 'cancelled' })], OPTIES)).toContain('STATUS:CANCELLED');
    expect(bouwAgendaIcs([afspraak({ status: 'rescheduled' })], OPTIES)).toContain('STATUS:CANCELLED');
    expect(bouwAgendaIcs([afspraak({ status: 'scheduled' })], OPTIES)).toContain('STATUS:CONFIRMED');
  });

  it('valt terug op de starttijd als er geen tijdstempel is', () => {
    const ics = bouwAgendaIcs([afspraak({ updated_at: null, created_at: null })], OPTIES);
    expect(ics).toContain('DTSTAMP:20260924T090000Z');
  });
});

describe('escapeIcs', () => {
  it('ontsnapt de tekens die het formaat zelf gebruikt', () => {
    expect(escapeIcs('a;b,c')).toBe('a\;b\\,c');
    expect(escapeIcs('regel1\nregel2')).toBe('regel1\\nregel2');
    expect(escapeIcs('pad\\naar')).toBe('pad\\\\naar');
  });

  it('houdt een puntkomma in een opmerking binnen hetzelfde veld', () => {
    const ics = bouwAgendaIcs([afspraak({ notes: 'bellen; daarna mailen' })], OPTIES);
    expect(ics).toContain('bellen\; daarna mailen');
  });
});

describe('vouwRegel', () => {
  it('laat een korte regel met rust', () => {
    expect(vouwRegel('SUMMARY:kort')).toBe('SUMMARY:kort');
  });

  it('vouwt een lange regel met een spatie als vervolgteken', () => {
    const lang = 'DESCRIPTION:' + 'x'.repeat(200);
    const gevouwen = vouwRegel(lang);
    const regels = gevouwen.split('\r\n');
    expect(regels.length).toBeGreaterThan(1);
    expect(regels[0].length).toBeLessThanOrEqual(75);
    for (const r of regels.slice(1)) expect(r.startsWith(' ')).toBe(true);
  });

  it('knipt niet midden door een teken van meerdere bytes', () => {
    /* Een half knipt UTF-8-teken maakt het hele bestand onleesbaar. */
    const lang = 'SUMMARY:' + 'é'.repeat(80);
    for (const r of vouwRegel(lang).split('\r\n')) {
      expect(Buffer.byteLength(r, 'utf8')).toBeLessThanOrEqual(76);
      expect(r).not.toContain('�');
    }
  });
});

describe('formatIcsDate', () => {
  it('schrijft UTC zonder streepjes en dubbele punten', () => {
    expect(formatIcsDate(new Date('2026-09-24T09:05:00.000Z'))).toBe('20260924T090500Z');
  });
});

describe('agenda-token', () => {
  it('is stabiel voor dezelfde combinatie', () => {
    expect(maakAgendaToken('klant-1', 'gebruiker-1')).toBe(maakAgendaToken('klant-1', 'gebruiker-1'));
  });

  it('verschilt per klant en per gebruiker', () => {
    expect(maakAgendaToken('klant-1', 'g1')).not.toBe(maakAgendaToken('klant-2', 'g1'));
    expect(maakAgendaToken('klant-1', 'g1')).not.toBe(maakAgendaToken('klant-1', 'g2'));
    expect(maakAgendaToken('klant-1', null)).not.toBe(maakAgendaToken('klant-1', 'g1'));
  });

  it('accepteert het eigen token en wijst andermans token af', () => {
    const goed = maakAgendaToken('klant-1', 'g1');
    expect(controleerAgendaToken('klant-1', 'g1', goed)).toBe(true);
    expect(controleerAgendaToken('klant-2', 'g1', goed)).toBe(false);
    expect(controleerAgendaToken('klant-1', 'g2', goed)).toBe(false);
  });

  it('wijst rommel af zonder te struikelen', () => {
    expect(controleerAgendaToken('klant-1', 'g1', '')).toBe(false);
    expect(controleerAgendaToken('klant-1', 'g1', 'kort')).toBe(false);
    expect(controleerAgendaToken('klant-1', 'g1', 'x'.repeat(40))).toBe(false);
  });
});
