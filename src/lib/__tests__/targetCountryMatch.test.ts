import { describe, it, expect } from 'vitest';
import { targetCountryAllowsLead } from '../targetCountryMatch';

describe('targetCountryAllowsLead', () => {
  it('NULL country = geen restrictie (alle landen toegestaan)', () => {
    expect(targetCountryAllowsLead({ country: null }, { land: 'BE' })).toBe(true);
    expect(targetCountryAllowsLead({}, { land: 'NL' })).toBe(true);
    expect(targetCountryAllowsLead({ country: '' }, { land: null })).toBe(true);
  });

  it('country=NL accepteert NL-leads', () => {
    expect(targetCountryAllowsLead({ country: 'NL' }, { land: 'NL' })).toBe(true);
    expect(targetCountryAllowsLead({ country: 'NL' }, { land: 'nl' })).toBe(true);
  });

  it('country=NL weigert BE-leads (echte case Den Held Dakwerk)', () => {
    expect(
      targetCountryAllowsLead(
        { country: 'NL' },
        { land: 'BE', postcode: '9070' },
      ),
    ).toBe(false);
  });

  it('country=BE weigert NL-leads', () => {
    expect(targetCountryAllowsLead({ country: 'BE' }, { land: 'NL' })).toBe(false);
  });

  it('country=BE accepteert BE-leads', () => {
    expect(targetCountryAllowsLead({ country: 'BE' }, { land: 'BE' })).toBe(true);
  });

  it('country=NL met lege land-veld maar NL-postcode (4-cijfers + 2 letters)', () => {
    expect(
      targetCountryAllowsLead(
        { country: 'NL' },
        { land: null, postcode: '1234AB' },
      ),
    ).toBe(true);
  });

  it('country=NL met lege land-veld maar BE-postcode (4 cijfers) wordt geweigerd', () => {
    expect(
      targetCountryAllowsLead(
        { country: 'NL' },
        { land: null, postcode: '9070' },
      ),
    ).toBe(false);
  });

  it('country=NL maar geen land/postcode → ondetecteerbaar → weigert (faalveilig)', () => {
    expect(targetCountryAllowsLead({ country: 'NL' }, { land: null })).toBe(false);
  });

  it('hoofdletters in country worden genormaliseerd', () => {
    expect(targetCountryAllowsLead({ country: 'nl' as 'NL' }, { land: 'NL' })).toBe(true);
    expect(targetCountryAllowsLead({ country: 'be' as 'BE' }, { land: 'BE' })).toBe(true);
  });

  it('onbekende country-waarde wordt behandeld als NULL (geen restrictie)', () => {
    expect(targetCountryAllowsLead({ country: 'DE' }, { land: 'NL' })).toBe(true);
  });
});
