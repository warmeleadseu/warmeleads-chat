import { describe, expect, it } from 'vitest';
import { inhaalslagWeigering } from '../verdeelGrenzen';

const NU = new Date('2026-10-07T09:27:00Z');
const urenGeleden = (u: number) => new Date(NU.getTime() - u * 3_600_000).toISOString();
const MB = 'mediabink';

describe('inhaalslagWeigering', () => {
  it('lead zonder klanten mag', () => {
    expect(inhaalslagWeigering([], MB, NU)).toBeNull();
  });

  it('één andere klant, langer dan 12 uur geleden: mag (wordt 2e klant)', () => {
    expect(inhaalslagWeigering([{ customer_id: 'eco', assigned_at: urenGeleden(30) }], MB, NU)).toBeNull();
  });

  it('andere klant binnen 12 uur: pauze (Mediabink kreeg er een na 12 minuten)', () => {
    expect(inhaalslagWeigering([{ customer_id: 'eco', assigned_at: urenGeleden(0.2) }], MB, NU)).toBe('pauze');
    expect(inhaalslagWeigering([{ customer_id: 'eco', assigned_at: urenGeleden(11.9) }], MB, NU)).toBe('pauze');
  });

  it('al bij twee andere klanten: geen derde klant via de inhaalslag', () => {
    expect(inhaalslagWeigering([
      { customer_id: 'eco', assigned_at: urenGeleden(60) },
      { customer_id: 'infinite', assigned_at: urenGeleden(40) },
    ], MB, NU)).toBe('derde_klant');
  });

  it('toewijzingen ouder dan 30 dagen tellen niet als klant', () => {
    expect(inhaalslagWeigering([
      { customer_id: 'eco', assigned_at: urenGeleden(24 * 40) },
      { customer_id: 'infinite', assigned_at: urenGeleden(40) },
    ], MB, NU)).toBeNull();
  });

  it('eigen eerdere toewijzing telt niet mee', () => {
    expect(inhaalslagWeigering([{ customer_id: MB, assigned_at: urenGeleden(1) }], MB, NU)).toBeNull();
  });

  it('zonder datum voorzichtig: als recent behandelen', () => {
    expect(inhaalslagWeigering([{ customer_id: 'eco', assigned_at: null }], MB, NU)).toBe('pauze');
  });
});
