import { describe, expect, it } from 'vitest';
import { PROVINCES_BE, PROVINCES_NL } from '@/data/provinces';
import { dektLandelijk, prijsUitStaffel } from '../bestelPrijs';
import { bestelPrijsPerLead } from '@/app/portal/_ui/math';

const heelNL = PROVINCES_NL.map(p => `NL:${p}`);

describe('landelijke dekking', () => {
  it('alle 12 Nederlandse provincies is landelijk', () => {
    expect(dektLandelijk([{ target_type: 'province', provinces: heelNL }])).toBe(true);
  });
  it('ook als de provincies over meerdere gebieden verdeeld zijn', () => {
    expect(dektLandelijk([
      { target_type: 'province', provinces: heelNL.slice(0, 6) },
      { target_type: 'province', provinces: heelNL.slice(6) },
    ])).toBe(true);
  });
  it('heel België telt ook', () => {
    expect(dektLandelijk([{ target_type: 'province', provinces: PROVINCES_BE.map(p => `BE:${p}`) }])).toBe(true);
  });
  it('een provincie minder, een straal of uitgeschakeld gebied is niet landelijk', () => {
    expect(dektLandelijk([{ target_type: 'province', provinces: heelNL.slice(1) }])).toBe(false);
    expect(dektLandelijk([{ target_type: 'radius', provinces: null }])).toBe(false);
    expect(dektLandelijk([{ target_type: 'province', provinces: heelNL, is_active: false }])).toBe(false);
    expect(dektLandelijk([])).toBe(false);
  });
});

describe('bestelprijs uit staffel', () => {
  const staffel = [{ min_leads: 10, price_per_lead: 30 }];
  it('€30 per lead, €25 bij landelijke dekking', () => {
    expect(prijsUitStaffel(staffel, 50, 5, false)).toMatchObject({ pricePerLead: 30, staffelPrijs: 30, landelijkeKorting: 0 });
    expect(prijsUitStaffel(staffel, 50, 5, true)).toMatchObject({ pricePerLead: 25, staffelPrijs: 30, landelijkeKorting: 5 });
  });
  it('maatwerkstaffel gaat voor (al samengevoegd door de aanroeper)', () => {
    expect(prijsUitStaffel([...staffel, { min_leads: 250, price_per_lead: 20.5 }], 300, 5, false, true)).toMatchObject({ pricePerLead: 20.5, maatwerk: true });
  });
  it('onder de minimale grootte: geen prijs', () => {
    expect(prijsUitStaffel(staffel, 5, 5, false)).toBeNull();
  });
  it('portaal toont dezelfde prijs als de server rekent', () => {
    expect(bestelPrijsPerLead({ tiers: staffel, nationwide_discount: 5, landelijk: true }, 50)).toBe(25);
    expect(bestelPrijsPerLead({ tiers: staffel, nationwide_discount: 5, landelijk: false }, 50)).toBe(30);
  });
});
