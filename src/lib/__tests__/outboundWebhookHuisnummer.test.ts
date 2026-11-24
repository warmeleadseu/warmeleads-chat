import { describe, expect, it } from 'vitest';
import { buildWebhookPayload, schoonHuisnummer } from '../integrations/outboundWebhook/payload';
import { isDefinitieveWeigering } from '../integrations/outboundWebhook/transport';
import type { LeadForWebhook } from '../integrations/outboundWebhook/types';

describe('schoonHuisnummer', () => {
  it('laat een gewoon huisnummer ongemoeid', () => {
    for (const h of ['12', '12a', '12 A', '12-2', '12 bis', '12 hs', '12/3', '14 bus 2']) {
      expect(schoonHuisnummer(h)).toBe(h);
    }
  });

  it('haalt het nummer uit vrije tekst', () => {
    expect(schoonHuisnummer('Bremerf 13 nieuwbouw is over 6 maanden klaar')).toBe('13');
    expect(schoonHuisnummer('Flintdijk 140/140/140')).toBe('140');
    expect(schoonHuisnummer('Dorpsstraat 5b')).toBe('5b');
  });

  it('geeft null bij leeg en de tekst zelf als er geen nummer in staat', () => {
    expect(schoonHuisnummer('  ')).toBeNull();
    expect(schoonHuisnummer(null)).toBeNull();
    expect(schoonHuisnummer('onbekend')).toBe('onbekend');
  });
});

describe('buildWebhookPayload met een rommelig huisnummer', () => {
  const lead: LeadForWebhook = {
    id: 'lead-1',
    branch: 'thuisbatterij',
    naam_klant: 'Test Persoon',
    email: 't@example.com',
    telefoonnummer: '+31600000000',
    postcode: '3554 HE',
    huisnummer: 'Bremerf 13 nieuwbouw is over 6 maanden klaar',
    plaatsnaam: 'Hoef en Haag',
    provincie: 'Utrecht',
    land: 'NL',
    bron: 'meta',
    created_at: '2026-11-24T10:00:00Z',
    custom_fields: { budget: '€5.000' },
  };
  const mapping = [
    { source: 'huisnummer', target: 'huisnummer', enabled: true },
    { source: 'adres', target: 'adres', enabled: true },
    { source: 'samenvatting', target: 'opmerking', enabled: true },
  ];

  it('stuurt het opgeschoonde nummer en bewaart de oorspronkelijke tekst in de opmerking', () => {
    const p = buildWebhookPayload(lead, 'a-1', mapping, 'Bremerf');
    expect(p.huisnummer).toBe('13');
    expect(p.adres).toBe('Bremerf 13');
    expect(p.opmerking).toBe('Budget: €5.000. Huisnummer zoals ingevuld: Bremerf 13 nieuwbouw is over 6 maanden klaar');
  });

  it('voegt niets toe aan de opmerking bij een gewoon huisnummer', () => {
    const p = buildWebhookPayload({ ...lead, huisnummer: '13' }, 'a-1', mapping, 'Bremerf');
    expect(p.huisnummer).toBe('13');
    expect(p.opmerking).toBe('Budget: €5.000');
  });
});

describe('isDefinitieveWeigering', () => {
  it('stopt bij 400 en 401, niet bij 429, 408 of 5xx', () => {
    expect(isDefinitieveWeigering(400)).toBe(true);
    expect(isDefinitieveWeigering(401)).toBe(true);
    expect(isDefinitieveWeigering(422)).toBe(true);
    expect(isDefinitieveWeigering(429)).toBe(false);
    expect(isDefinitieveWeigering(408)).toBe(false);
    expect(isDefinitieveWeigering(500)).toBe(false);
    expect(isDefinitieveWeigering(502)).toBe(false);
    expect(isDefinitieveWeigering(200)).toBe(false);
  });
});
