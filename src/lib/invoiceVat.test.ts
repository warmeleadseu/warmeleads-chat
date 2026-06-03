import { describe, expect, it } from 'vitest';
import {
  computeInvoiceVat,
  isReverseChargeRate,
  isValidBelgianVatFormat,
  isValidDutchVatFormat,
  normalizeVatId,
  qualifiesBelgiumReverseCharge,
  validateVatIdForCountry,
  vatTotalSuffix,
  vatUnitSuffix,
} from './invoiceVat';

describe('isValidBelgianVatFormat', () => {
  it('accepteert BE + 10 cijfers', () => {
    expect(isValidBelgianVatFormat('BE0123456789')).toBe(true);
    expect(isValidBelgianVatFormat('be 0.123.456.789')).toBe(true);
  });
  it('wijst te korte of ontbrekende codes af', () => {
    expect(isValidBelgianVatFormat('BE012345678')).toBe(false);
    expect(isValidBelgianVatFormat('NL123456789B01')).toBe(false);
    expect(isValidBelgianVatFormat('')).toBe(false);
  });
});

describe('qualifiesBelgiumReverseCharge', () => {
  it('alleen BE met geldig nummer', () => {
    expect(qualifiesBelgiumReverseCharge({ country: 'BE', vat_id: 'BE0123456789' })).toBe(true);
    expect(qualifiesBelgiumReverseCharge({ country: 'BE', vat_id: '' })).toBe(false);
    expect(qualifiesBelgiumReverseCharge({ country: 'NL', vat_id: 'BE0123456789' })).toBe(false);
  });
});

describe('isValidDutchVatFormat', () => {
  it('accepteert NL + 9 cijfers + B + 2 cijfers', () => {
    expect(isValidDutchVatFormat('NL123456789B01')).toBe(true);
    expect(isValidDutchVatFormat('nl 123.456.789B01')).toBe(true);
  });
  it('wijst onjuiste formaten af', () => {
    expect(isValidDutchVatFormat('NL123456789B0')).toBe(false);
    expect(isValidDutchVatFormat('BE0123456789')).toBe(false);
    expect(isValidDutchVatFormat('')).toBe(false);
  });
});

describe('normalizeVatId', () => {
  it('strip whitespace en dots, hoofdletters', () => {
    expect(normalizeVatId(' be 0.831.630.290 ')).toBe('BE0831630290');
    expect(normalizeVatId('  ')).toBe(null);
    expect(normalizeVatId(null)).toBe(null);
  });
});

describe('validateVatIdForCountry', () => {
  it('lege waarde is altijd OK', () => {
    expect(validateVatIdForCountry('BE', null)).toEqual({ ok: true, vat_id: null });
    expect(validateVatIdForCountry('NL', '')).toEqual({ ok: true, vat_id: null });
  });
  it('weigert e-mailadressen in vat_id-veld', () => {
    const r = validateVatIdForCountry('BE', 'bart@warmeleads.eu');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/alleen letters en cijfers/i);
  });
  it('BE: weigert ongeldig formaat', () => {
    const r = validateVatIdForCountry('BE', 'BE12345');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Belgisch BTW-nummer/i);
  });
  it('BE: accepteert + normaliseert geldig formaat', () => {
    const r = validateVatIdForCountry('BE', 'be 0.831.630.290');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.vat_id).toBe('BE0831630290');
  });
  it('NL: weigert vat_id zonder geldig NL-formaat', () => {
    const r = validateVatIdForCountry('NL', 'NL12345');
    expect(r.ok).toBe(false);
  });
  it('NL: accepteert geldig NL-formaat', () => {
    const r = validateVatIdForCountry('NL', 'NL123456789B01');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.vat_id).toBe('NL123456789B01');
  });
  it('weigert vat_id zonder landcode', () => {
    const r = validateVatIdForCountry('NL', '0831630290');
    expect(r.ok).toBe(false);
  });
});

describe('isReverseChargeRate', () => {
  it('btwRate=0 wijst op verlegging, 0.21 niet', () => {
    expect(isReverseChargeRate(0)).toBe(true);
    expect(isReverseChargeRate(0.21)).toBe(false);
  });
});

describe('vatUnitSuffix', () => {
  it('NL: " excl. BTW", BE: leeg', () => {
    expect(vatUnitSuffix({ reverseCharge: false })).toBe(' excl. BTW');
    expect(vatUnitSuffix({ reverseCharge: true })).toBe('');
  });
});

describe('vatTotalSuffix', () => {
  it('NL: "incl. BTW", BE: "BTW verlegd"', () => {
    expect(vatTotalSuffix({ reverseCharge: false })).toBe('incl. BTW');
    expect(vatTotalSuffix({ reverseCharge: true })).toBe('BTW verlegd');
  });
});

describe('computeInvoiceVat', () => {
  it('NL: 21%', () => {
    const r = computeInvoiceVat({ subtotalExclBtw: 100, country: 'NL', customerVatId: null });
    expect(r.vat_mode).toBe('domestic_nl');
    expect(r.btw_amount).toBe(21);
    expect(r.total_incl_btw).toBe(121);
  });
  it('BE met BTW: verlegd', () => {
    const r = computeInvoiceVat({
      subtotalExclBtw: 1000,
      country: 'BE',
      customerVatId: 'BE0123456789',
    });
    expect(r.vat_mode).toBe('reverse_charge_be');
    expect(r.btw_amount).toBe(0);
    expect(r.total_incl_btw).toBe(1000);
  });
});
