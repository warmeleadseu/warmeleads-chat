import { describe, it, expect } from 'vitest';
import {
  applyConstants,
  buildLeadSourceValues,
  buildWebhookPayload,
} from '@/lib/integrations/outboundWebhook/payload';
import { sanitizeConstants, MAX_CONSTANTS } from '@/lib/integrations/outboundWebhook/fields';
import type { LeadForWebhook } from '@/lib/integrations/outboundWebhook/types';

const LEAD: LeadForWebhook = {
  id: 'lead-1',
  branch: 'thuisbatterij',
  naam_klant: 'Ron van Wielink',
  email: 'ron@voorbeeld.nl',
  telefoonnummer: '0612345678',
  postcode: '1676 GA',
  huisnummer: '12',
  plaatsnaam: 'Twisk',
  provincie: 'Noord-Holland',
  land: null,
  bron: 'meta',
  created_at: '2026-09-24T08:00:00.000Z',
  custom_fields: { zonnepanelen: 'Ja', budget: '€8.000' },
};

describe('afgeleide naamvelden', () => {
  it('levert voornaam en achternaam los van elkaar', () => {
    const v = buildLeadSourceValues(LEAD, 'toewijzing-1', 'Dorpsstraat');
    expect(v.naam).toBe('Ron van Wielink');
    expect(v.voornaam).toBe('Ron');
    expect(v.achternaam).toBe('van Wielink');
  });
});

describe('vaste waarden', () => {
  it('voegt een vaste waarde toe aan de payload', () => {
    const uit = applyConstants({ email: 'a@b.nl' }, [{ target: 'bron', value: 'WarmeLeads' }]);
    expect(uit).toEqual({ email: 'a@b.nl', bron: 'WarmeLeads' });
  });

  it('wint van een veld met dezelfde sleutel', () => {
    /* Wie een letterlijke waarde invult wil die zien staan, niet stilletjes
       overschreven worden door een leadveld. */
    const uit = applyConstants({ land: 'NL' }, [{ target: 'land', value: 'Nederland' }]);
    expect(uit.land).toBe('Nederland');
  });

  it('laat de payload ongemoeid zonder vaste waarden', () => {
    expect(applyConstants({ a: 1 }, null)).toEqual({ a: 1 });
    expect(applyConstants({ a: 1 }, [])).toEqual({ a: 1 });
  });

  it('gaat mee in de volledige payload', () => {
    const payload = buildWebhookPayload(
      LEAD,
      'toewijzing-1',
      [
        { source: 'voornaam', target: 'voornaam', enabled: true },
        { source: 'achternaam', target: 'achternaam', enabled: true },
        { source: 'plaats', target: 'stad', enabled: true },
      ],
      'Dorpsstraat',
      [{ target: 'bron', value: 'WarmeLeads' }],
    );
    expect(payload).toEqual({
      voornaam: 'Ron',
      achternaam: 'van Wielink',
      stad: 'Twisk',
      bron: 'WarmeLeads',
    });
  });
});

describe('sanitizeConstants', () => {
  it('weigert een lege sleutel maar staat een lege waarde toe', () => {
    expect(sanitizeConstants([{ target: '  ', value: 'x' }])).toEqual([]);
    expect(sanitizeConstants([{ target: 'vrij_veld_3', value: '' }]))
      .toEqual([{ target: 'vrij_veld_3', value: '' }]);
  });

  it('ontdubbelt op sleutel', () => {
    const uit = sanitizeConstants([
      { target: 'bron', value: 'eerste' },
      { target: 'bron', value: 'tweede' },
    ]);
    expect(uit).toEqual([{ target: 'bron', value: 'eerste' }]);
  });

  it('kapt af op het maximum', () => {
    const veel = Array.from({ length: MAX_CONSTANTS + 5 }, (_, i) => ({ target: `k${i}`, value: 'v' }));
    expect(sanitizeConstants(veel)).toHaveLength(MAX_CONSTANTS);
  });

  it('negeert onzin', () => {
    expect(sanitizeConstants(null)).toEqual([]);
    expect(sanitizeConstants('nee')).toEqual([]);
    expect(sanitizeConstants([1, null, 'x'])).toEqual([]);
  });
});
