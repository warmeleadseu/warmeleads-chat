import { describe, it, expect } from 'vitest';
import { __internal } from '../aiCapiHooks';

describe('splitName', () => {
  it('handles empty input', () => {
    expect(__internal.splitName(null)).toEqual({});
    expect(__internal.splitName('')).toEqual({});
  });

  it('returns firstname only when single token', () => {
    expect(__internal.splitName('Jan')).toEqual({ firstName: 'Jan' });
  });

  it('splits first and last when multiple tokens', () => {
    expect(__internal.splitName('Jan de Vries')).toEqual({ firstName: 'Jan', lastName: 'Vries' });
  });

  it('trims whitespace', () => {
    expect(__internal.splitName('  Jan   Klaas Visser ')).toEqual({ firstName: 'Jan', lastName: 'Visser' });
  });
});

describe('mapCountry', () => {
  it('maps Belgium variants to be', () => {
    expect(__internal.mapCountry('BE')).toBe('be');
    expect(__internal.mapCountry('Belgium')).toBe('be');
    expect(__internal.mapCountry('België')).toBe('be');
    expect(__internal.mapCountry('Belgie')).toBe('be');
  });

  it('defaults to nl', () => {
    expect(__internal.mapCountry(null)).toBe('nl');
    expect(__internal.mapCountry('Nederland')).toBe('nl');
    expect(__internal.mapCountry('')).toBe('nl');
  });
});

describe('buildCapiUserDataFromLead', () => {
  it('extracts and normalizes user data', () => {
    const user = __internal.buildCapiUserDataFromLead({
      id: 'abc-123',
      email: 'Jan@Example.com',
      telefoonnummer: '0612345678',
      naam_klant: 'Jan Vries',
      postcode: '1234 AB',
      plaatsnaam: 'Amsterdam',
      land: 'BE',
    });
    expect(user.email).toBe('Jan@Example.com');
    expect(user.firstName).toBe('Jan');
    expect(user.lastName).toBe('Vries');
    expect(user.zip).toBe('1234 AB');
    expect(user.country).toBe('be');
    expect(user.externalId).toBe('abc-123');
  });

  it('handles missing optional fields', () => {
    const user = __internal.buildCapiUserDataFromLead({ id: 'x' });
    expect(user.externalId).toBe('x');
    expect(user.country).toBe('nl');
    expect(user.firstName).toBe(undefined);
  });
});

describe('isLeadMetaAttributable', () => {
  it('accepts leads with meta_leadgen_id', () => {
    expect(__internal.isLeadMetaAttributable({ meta_leadgen_id: 'x' })).toBe(true);
  });

  it('accepts leads with meta_campaign_id', () => {
    expect(__internal.isLeadMetaAttributable({ meta_campaign_id: '123' })).toBe(true);
  });

  it('accepts leads with zapier bron', () => {
    expect(__internal.isLeadMetaAttributable({ bron: 'zapier' })).toBe(true);
  });

  it('accepts leads with meta_lead_ads bron case-insensitive', () => {
    expect(__internal.isLeadMetaAttributable({ bron: 'Meta_Lead_Ads' })).toBe(true);
  });

  it('rejects excel_import without any meta-id', () => {
    expect(__internal.isLeadMetaAttributable({ bron: 'excel_import' })).toBe(false);
  });

  it('rejects empty lead', () => {
    expect(__internal.isLeadMetaAttributable({})).toBe(false);
  });
});
