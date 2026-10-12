import { describe, expect, it } from 'vitest';
import { slotsVoorDag } from '../appointmentSlots';

/* Maandag 19 okt 2026, Nederlandse tijd (CEST, UTC+2). */
const t = (hm: string) => new Date(`2026-10-19T${hm}:00+02:00`);
const NU = new Date('2026-10-12T10:00:00Z');
const basis = { durationMinutes: 60, bufferMinutes: 30, step: 30, now: NU, from: t('00:00'), to: t('23:59') };
const tijden = (s: { start: string }[]) => s.map(x => new Date(x.start).toLocaleTimeString('nl-NL', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit' }));

describe('slotsVoorDag', () => {
  it('RJ CV: beschikbaar 18:00-19:30, afspraak 60 min met 30 min reistijd -> 18:00 en 18:30', () => {
    const s = slotsVoorDag({ ...basis, beschikbaar: [{ start: t('18:00'), end: t('19:30') }], afspraken: [] });
    expect(tijden(s)).toEqual(['18:00', '18:30']);
  });

  it('afspraak moet binnen de beschikbaarheid eindigen', () => {
    const s = slotsVoorDag({ ...basis, beschikbaar: [{ start: t('18:00'), end: t('18:50') }], afspraken: [] });
    expect(s).toEqual([]);
  });

  it('reistijd tussen twee afspraken blijft vrij', () => {
    /* Bestaande afspraak 10:00-11:00 met 30 min reistijd: niet vóór 11:30 en niet later beginnen dan dat hij om 09:30 eindigt. */
    const s = slotsVoorDag({
      ...basis,
      beschikbaar: [{ start: t('08:00'), end: t('14:00') }],
      afspraken: [{ start: t('10:00'), end: t('11:00'), buffer: 30 }],
    });
    expect(tijden(s)).toEqual(['08:00', '08:30', '11:30', '12:00', '12:30', '13:00']);
  });

  it('de grootste reistijd van beide afspraken telt', () => {
    const s = slotsVoorDag({
      ...basis,
      bufferMinutes: 15,
      beschikbaar: [{ start: t('11:00'), end: t('14:00') }],
      afspraken: [{ start: t('10:00'), end: t('11:00'), buffer: 45 }],
    });
    expect(tijden(s)[0]).toBe('12:00');
  });

  it('geen tijdsloten in het verleden', () => {
    const s = slotsVoorDag({ ...basis, now: t('18:10'), beschikbaar: [{ start: t('18:00'), end: t('19:30') }], afspraken: [] });
    expect(tijden(s)).toEqual(['18:30']);
  });
});
