import { describe, it, expect, beforeAll } from 'vitest';
import {
  maakLeadToken,
  controleerLeadToken,
  leadAfspraakUrl,
  leadMagNogReageren,
} from '../leadAfspraakToken';

beforeAll(() => { process.env.CRON_SECRET = 'testgeheim-voor-afspraaktokens'; });

const NU = new Date('2026-09-22T12:00:00.000Z');

describe('leadtoken', () => {
  it('is stabiel per afspraak en verschilt tussen afspraken', () => {
    expect(maakLeadToken('a1')).toBe(maakLeadToken('a1'));
    expect(maakLeadToken('a1')).not.toBe(maakLeadToken('a2'));
  });

  it('accepteert het eigen token en niet dat van een andere afspraak', () => {
    /* Anders kan iemand met één geldige link de afspraken van anderen afzeggen
       door alleen het id in de URL te wijzigen. */
    const t = maakLeadToken('a1');
    expect(controleerLeadToken('a1', t)).toBe(true);
    expect(controleerLeadToken('a2', t)).toBe(false);
  });

  it('wijst rommel af zonder te struikelen', () => {
    expect(controleerLeadToken('a1', '')).toBe(false);
    expect(controleerLeadToken('a1', 'kort')).toBe(false);
    expect(controleerLeadToken('a1', 'x'.repeat(32))).toBe(false);
  });

  it('bouwt een link met id en token erin', () => {
    const url = leadAfspraakUrl('a1', 'https://voorbeeld.nl');
    expect(url).toBe(`https://voorbeeld.nl/afspraak/a1?t=${maakLeadToken('a1')}`);
  });
});

describe('leadMagNogReageren', () => {
  it('mag reageren op een toekomstige ingeplande afspraak', () => {
    expect(leadMagNogReageren({ status: 'scheduled', starts_at: '2026-09-25T10:00:00Z' }, NU)).toBe(true);
  });

  it('mag niet meer reageren als de afspraak voorbij is', () => {
    expect(leadMagNogReageren({ status: 'scheduled', starts_at: '2026-09-21T10:00:00Z' }, NU)).toBe(false);
  });

  it('mag niet reageren op een al afgeboekte afspraak', () => {
    /* Een oude link uit de mailbox mag de administratie van de klant niet
       overschrijven. */
    for (const status of ['completed', 'cancelled', 'no_show', 'rescheduled']) {
      expect(leadMagNogReageren({ status, starts_at: '2026-09-25T10:00:00Z' }, NU), status).toBe(false);
    }
  });

  it('valt niet over een onleesbare datum', () => {
    expect(leadMagNogReageren({ status: 'scheduled', starts_at: 'onzin' }, NU)).toBe(false);
  });
});
