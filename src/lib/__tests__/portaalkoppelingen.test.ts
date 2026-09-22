import { describe, it, expect } from 'vitest';
import {
  koppelingGeldtVoorBranche,
  bronMagNogWijzigen,
  boekingsVelden,
  type Portaalkoppeling,
} from '../portaalkoppelingen';

function koppeling(over: Partial<Portaalkoppeling> = {}): Portaalkoppeling {
  return {
    id: 'k1',
    bron_customer_id: 'infinite-scale',
    doel_customer_id: 'installateur',
    branches: null,
    verbruikt_batch: true,
    deelt_leadgegevens: false,
    mag_wijzigen_tot_bevestiging: true,
    actief: true,
    notities: null,
    ...over,
  };
}

describe('koppelingGeldtVoorBranche', () => {
  it('geldt voor alles als er geen branches zijn ingesteld', () => {
    expect(koppelingGeldtVoorBranche(koppeling(), 'thuisbatterij')).toBe(true);
    expect(koppelingGeldtVoorBranche(koppeling({ branches: [] }), 'kozijnen')).toBe(true);
  });

  it('beperkt tot de ingestelde branches', () => {
    const k = koppeling({ branches: ['thuisbatterij'] });
    expect(koppelingGeldtVoorBranche(k, 'thuisbatterij')).toBe(true);
    expect(koppelingGeldtVoorBranche(k, 'kozijnen')).toBe(false);
  });
});

describe('bronMagNogWijzigen', () => {
  it('mag wijzigen zolang de doelklant niet heeft bevestigd', () => {
    expect(bronMagNogWijzigen(koppeling(), { bevestigd_at: null, status: 'scheduled' })).toBe(true);
  });

  it('mag niet meer wijzigen na bevestiging', () => {
    /* Anders verschuift een callcenter de agenda van een installateur die er
       al rekening mee houdt. */
    expect(bronMagNogWijzigen(koppeling(), { bevestigd_at: '2026-09-22T10:00:00Z', status: 'scheduled' })).toBe(false);
  });

  it('mag nooit wijzigen als de koppeling dat uitzet', () => {
    const k = koppeling({ mag_wijzigen_tot_bevestiging: false });
    expect(bronMagNogWijzigen(k, { bevestigd_at: null, status: 'scheduled' })).toBe(false);
  });

  it('mag een afgeboekte afspraak niet meer aanraken', () => {
    for (const status of ['completed', 'cancelled', 'no_show', 'rescheduled']) {
      expect(bronMagNogWijzigen(koppeling(), { bevestigd_at: null, status }), status).toBe(false);
    }
  });
});

describe('boekingsVelden', () => {
  it('houdt de lead weg als delen uitstaat', () => {
    /* De kern van de privacykeuze: met lead_id erbij kan de ontvangende klant
       de hele lead in zijn portaal openen, en dat is een leadlevering. */
    expect(boekingsVelden(koppeling({ deelt_leadgegevens: false }), { lead_id: 'l1', lead_assignment_id: 'a1' }))
      .toEqual({ lead_id: null, lead_assignment_id: null });
  });

  it('geeft de lead mee als delen aanstaat', () => {
    expect(boekingsVelden(koppeling({ deelt_leadgegevens: true }), { lead_id: 'l1', lead_assignment_id: 'a1' }))
      .toEqual({ lead_id: 'l1', lead_assignment_id: 'a1' });
  });

  it('gaat om met een boeking zonder lead', () => {
    expect(boekingsVelden(koppeling({ deelt_leadgegevens: true }), {}))
      .toEqual({ lead_id: null, lead_assignment_id: null });
  });
});
