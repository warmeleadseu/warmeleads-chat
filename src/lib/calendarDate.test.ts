import { describe, it, expect } from 'vitest';
import { toDateKey } from './calendarDate';

/**
 * Regressietest voor de boekingsbug van augustus 2026: een bezoeker die in
 * /plan-gesprek een dag aanklikte, boekte de dag ervóór. Oorzaak was
 * `toISOString()` op een Date die op lokale middernacht stond.
 */
describe('toDateKey', () => {
  it('geeft de aangeklikte dag terug, niet de dag ervoor', () => {
    // Zoals het kalenderraster zijn dagen bouwt: lokale middernacht.
    expect(toDateKey(new Date(2026, 7, 19))).toBe('2026-08-19');
  });

  it('wijkt af van toISOString zodra de bezoeker vóór UTC ligt', () => {
    const picked = new Date(2026, 7, 19);
    const naive = picked.toISOString().split('T')[0];

    // In een UTC+x-zone levert de naïeve variant 2026-08-18 op; in UTC zelf
    // vallen beide samen. De helper is in beide gevallen correct.
    expect(toDateKey(picked)).toBe('2026-08-19');
    if (picked.getTimezoneOffset() < 0) {
      expect(naive).not.toBe(toDateKey(picked));
    }
  });

  it('vult maand en dag aan tot twee cijfers', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toDateKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('houdt de dag heel rond de zomertijdovergang', () => {
    // Laatste zondag van maart 2026: klok gaat om 02:00 vooruit.
    expect(toDateKey(new Date(2026, 2, 29))).toBe('2026-03-29');
    // Laatste zondag van oktober 2026: klok gaat om 03:00 terug.
    expect(toDateKey(new Date(2026, 9, 25))).toBe('2026-10-25');
  });
});
