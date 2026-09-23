import { describe, it, expect } from 'vitest';
import {
  overlapt,
  vensterVan,
  vindConflicten,
  beschrijfConflict,
  type AfspraakVenster,
} from '../appointmentAssignee';

/**
 * Tot deze module bestond werd er bij het wijzigen van alleen de adviseur
 * helemaal niets gecontroleerd: twee afspraken op hetzelfde moment bij dezelfde
 * persoon gingen er zonder melding doorheen.
 */

function a(over: Partial<AfspraakVenster> = {}): AfspraakVenster {
  return {
    id: 'x',
    starts_at: '2026-09-24T09:00:00.000Z',
    duration_minutes: 60,
    travel_buffer_minutes: 0,
    portal_user_id: 'jan',
    status: 'scheduled',
    ...over,
  };
}

describe('vensterVan', () => {
  it('telt de reistijd aan beide kanten mee', () => {
    const v = vensterVan(a({ duration_minutes: 60, travel_buffer_minutes: 15 }))!;
    expect(new Date(v.van).toISOString()).toBe('2026-09-24T08:45:00.000Z');
    expect(new Date(v.tot).toISOString()).toBe('2026-09-24T10:15:00.000Z');
  });

  it('geeft niets terug bij een onleesbare datum', () => {
    expect(vensterVan(a({ starts_at: 'onzin' }))).toBeNull();
  });
});

describe('overlapt', () => {
  it('ziet overlap bij gedeeltelijke botsing', () => {
    expect(overlapt(a(), a({ id: 'y', starts_at: '2026-09-24T09:30:00.000Z' }))).toBe(true);
  });

  it('ziet aansluitende afspraken niet als overlap', () => {
    /* Eindigt de een om 10:00 en begint de ander om 10:00, dan is dat precies
       waarvoor de reistijdbuffer bedoeld is. */
    expect(overlapt(a(), a({ id: 'y', starts_at: '2026-09-24T10:00:00.000Z' }))).toBe(false);
  });

  it('laat de reistijdbuffer wel botsen', () => {
    const eerste = a({ travel_buffer_minutes: 30 });
    const tweede = a({ id: 'y', starts_at: '2026-09-24T10:15:00.000Z', travel_buffer_minutes: 30 });
    expect(overlapt(eerste, tweede)).toBe(true);
  });

  it('ziet geen overlap bij afspraken op andere dagen', () => {
    expect(overlapt(a(), a({ id: 'y', starts_at: '2026-09-25T09:00:00.000Z' }))).toBe(false);
  });
});

describe('vindConflicten', () => {
  const agenda = [
    a({ id: '1', portal_user_id: 'jan' }),
    a({ id: '2', portal_user_id: 'piet' }),
    a({ id: '3', portal_user_id: 'jan', status: 'cancelled' }),
    a({ id: '4', portal_user_id: null }),
  ];

  it('vindt de botsing bij de juiste adviseur', () => {
    const c = vindConflicten(agenda, a({ id: 'nieuw' }), 'jan');
    expect(c.map(x => x.id)).toEqual(['1']);
  });

  it('laat de afspraken van een andere adviseur met rust', () => {
    expect(vindConflicten(agenda, a({ id: 'nieuw' }), 'klaas')).toHaveLength(0);
  });

  it('telt een geannuleerde afspraak niet als bezetting', () => {
    /* Die houdt geen tijd meer bezet; hem laten blokkeren zou herplannen
       onnodig tegenhouden. */
    const c = vindConflicten(agenda, a({ id: 'nieuw' }), 'jan');
    expect(c.some(x => x.id === '3')).toBe(false);
  });

  it('botst niet met zichzelf', () => {
    expect(vindConflicten(agenda, a({ id: '1' }), 'jan')).toHaveLength(0);
  });

  it('geeft niets terug als er geen adviseur wordt toegewezen', () => {
    /* Niemand toewijzen kan altijd; dan is er geen agenda om mee te botsen. */
    expect(vindConflicten(agenda, a({ id: 'nieuw' }), null)).toHaveLength(0);
  });

  it('telt een niet-toegewezen afspraak niet mee als bezetting van een adviseur', () => {
    expect(vindConflicten(agenda, a({ id: 'nieuw' }), 'jan').some(x => x.id === '4')).toBe(false);
  });
});

describe('beschrijfConflict', () => {
  it('noemt de naam en het tijdstip van de botsende afspraak', () => {
    const tekst = beschrijfConflict([a({ contact_name: 'Jan Jansen' })]);
    expect(tekst).toContain('Jan Jansen');
    expect(tekst).toContain('11:00'); // 09:00 UTC is 11:00 in Amsterdam (zomertijd)
  });

  it('meldt hoeveel er nog meer botsen', () => {
    expect(beschrijfConflict([a(), a({ id: 'b' }), a({ id: 'c' })])).toContain('en nog 2');
  });

  it('geeft niets terug zonder conflicten', () => {
    expect(beschrijfConflict([])).toBe('');
  });
});
