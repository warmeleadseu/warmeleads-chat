import { describe, expect, it } from 'vitest';
import {
  computeInvoiceVat,
  isValidBelgianVatFormat,
  qualifiesBelgiumReverseCharge,
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
