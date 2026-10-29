import { describe, expect, it } from 'vitest';
import { beoordeelSollit, bouwSollitPayload, leesSollitSleutel, splitsHuisnummer } from '../integrations/partners/sollit';

/* Verzonnen sleutel; nooit een echte sleutel van een klant in de code. */
const NEP = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';

const lead = {
  id: 'lead-1', branch: 'thuisbatterij', naam_klant: 'Jan de Vries', email: 'jan@example.com', telefoonnummer: '06 12345678',
  postcode: '9723 jp', huisnummer: '50a', plaatsnaam: 'Groningen', provincie: 'Groningen', land: 'NL', created_at: '2026-10-29T13:00:00Z',
  custom_fields: { zonnepanelen: 'Ja', meta_lead_form_id: '123456789', max_customer_assignments: 1 },
};
const ctx = { straat: 'Kattegat', brancheNaam: 'Thuisbatterij', toegestaneVelden: [{ key: 'zonnepanelen', label: 'Heeft zonnepanelen' }] };

describe('Sollit', () => {
  it('leest een API-sleutel, ook met "Bearer " of aanhalingstekens', () => {
    expect(leesSollitSleutel(NEP)).toBe(NEP);
    expect(leesSollitSleutel(` 'Bearer ${NEP}' `)).toBe(NEP);
    expect(leesSollitSleutel('https://evil.example/x')).toBeNull();
    expect(leesSollitSleutel('kort')).toBeNull();
  });
  it('splitst huisnummer en toevoeging', () => {
    expect(splitsHuisnummer('50a')).toEqual({ nummer: '50', toevoeging: 'a' });
    expect(splitsHuisnummer('12-2')).toEqual({ nummer: '12', toevoeging: '2' });
    expect(splitsHuisnummer('7')).toEqual({ nummer: '7', toevoeging: null });
  });
  it('bouwt een aanvraag met de verplichte velden en zonder interne velden', () => {
    const p = bouwSollitPayload(lead, ctx);
    expect(p).toMatchObject({
      postcode: '9723JP', number: '50', number_ext: 'a', first_name: 'Jan', street: 'Kattegat', city: 'Groningen',
      country: 'Netherlands', mobile: '06 12345678', product_type: 'battery', reference_number: 'lead-1', skip_postcode_check: true,
    });
    expect(String(p.last_name)).toContain('Vries');
    expect(p.telephone).toBeUndefined();
    expect(String(p.comments)).toContain('Heeft zonnepanelen: Ja');
    expect(JSON.stringify(p)).not.toContain('meta_lead_form_id');
    expect(JSON.stringify(p)).not.toContain('max_customer_assignments');
  });
  it('vast nummer gaat naar telephone, België naar Belgium', () => {
    const p = bouwSollitPayload({ ...lead, telefoonnummer: '050 1234567', land: 'BE' }, ctx);
    expect(p.telephone).toBe('050 1234567');
    expect(p.mobile).toBeUndefined();
    expect(p.country).toBe('Belgium');
  });
  it('beoordeelt de antwoorden', () => {
    const a = (status: number, body = '') => ({ status, body, timeout: false, netwerkfout: false, retryAfter: null });
    expect(beoordeelSollit(a(200, '{"success":"Person saved","request_id":"1"}')).soort).toBe('gelukt');
    expect(beoordeelSollit(a(401)).soort).toBe('blijvend');
    expect(beoordeelSollit(a(400, '{"error":"No postcode and number"}')).soort).toBe('blijvend');
    expect(beoordeelSollit(a(429)).soort).toBe('tijdelijk');
    expect(beoordeelSollit(a(503)).soort).toBe('tijdelijk');
    expect(beoordeelSollit({ ...a(0), timeout: true }).soort).toBe('tijdelijk');
  });
});
