import { describe, it, expect } from 'vitest';
import {
  buildAfspraakCsv,
  afspraakNaarRij,
  AFSPRAAK_KOLOMMEN,
  type AfspraakRij,
} from '../afspraakExport';

function rij(over: Partial<AfspraakRij> = {}): AfspraakRij {
  return {
    starts_at: '2026-09-24T09:00:00.000Z',
    duration_minutes: 60,
    status: 'completed',
    branch: 'thuisbatterij',
    contact_name: 'Jan Jansen',
    contact_phone: '0612345678',
    outcome: 'deal',
    deal_value: 8750.5,
    ...over,
  };
}

describe('buildAfspraakCsv', () => {
  it('begint met een BOM en de kopregel', () => {
    const csv = buildAfspraakCsv([]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.replace(/^﻿/, '').split('\r\n')[0].split(';')).toEqual([...AFSPRAAK_KOLOMMEN]);
  });

  it('geeft elke rij evenveel kolommen als de kop', () => {
    const csv = buildAfspraakCsv([rij(), rij({ outcome: null, deal_value: null })]);
    for (const regel of csv.replace(/^﻿/, '').split('\r\n')) {
      expect(regel.split(';')).toHaveLength(AFSPRAAK_KOLOMMEN.length);
    }
  });

  it('schrijft het dealbedrag met een komma zodat Excel het als getal leest', () => {
    expect(afspraakNaarRij(rij())[13]).toBe('8750,5');
  });

  it('laat het dealbedrag leeg als er geen deal is', () => {
    expect(afspraakNaarRij(rij({ outcome: 'no_deal', deal_value: null, outcome_reason: 'prijs' }))[13]).toBe('');
  });

  it('vertaalt status, uitkomst en reden naar leesbare tekst', () => {
    const v = afspraakNaarRij(rij({ outcome: 'no_deal', deal_value: null, outcome_reason: 'prijs' }));
    expect(v[3]).toBe('Bezocht');
    expect(v[12]).toBe('Geen deal');
    expect(v[14]).toBe('Te duur');
  });

  it('gebruikt de branchenaam als die bekend is', () => {
    expect(afspraakNaarRij(rij(), { thuisbatterij: 'Thuisbatterij' })[4]).toBe('Thuisbatterij');
    expect(afspraakNaarRij(rij())[4]).toBe('thuisbatterij');
  });

  it('ontsnapt een opmerking met puntkomma zodat de kolommen niet verschuiven', () => {
    expect(buildAfspraakCsv([rij({ notes: 'bellen; dan mailen' })])).toContain('"bellen; dan mailen"');
  });

  it('laat een onleesbare datum leeg in plaats van Invalid Date', () => {
    const v = afspraakNaarRij(rij({ starts_at: 'onzin' }));
    expect(v[0]).toBe('');
    expect(v[1]).toBe('');
  });
});
