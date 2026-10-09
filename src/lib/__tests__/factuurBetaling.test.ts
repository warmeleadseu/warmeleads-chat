import { describe, expect, it } from 'vitest';
import { beheerderNaam, betaaldViaUitBetaalId } from '../factuurBetaling';

describe('betaaldViaUitBetaalId', () => {
  it('echte Mollie-betaling', () => {
    expect(betaaldViaUitBetaalId('tr_WDqYK6vllg')).toBe('mollie');
  });
  it('markering van het beheer: handmatig', () => {
    expect(betaaldViaUitBetaalId('admin-manual')).toBe('handmatig');
    expect(betaaldViaUitBetaalId('admin-manual-1760000000000')).toBe('handmatig');
  });
  it('geen betaal-ID: handmatig', () => {
    expect(betaaldViaUitBetaalId(null)).toBe('handmatig');
    expect(betaaldViaUitBetaalId(undefined)).toBe('handmatig');
    expect(betaaldViaUitBetaalId('')).toBe('handmatig');
  });
});

describe('beheerderNaam', () => {
  it('naam, anders e-mail, anders niets', () => {
    expect(beheerderNaam({ name: 'Rick', email: 'r@x.nl' })).toBe('Rick');
    expect(beheerderNaam({ name: null, email: 'r@x.nl' })).toBe('r@x.nl');
    expect(beheerderNaam(null)).toBeNull();
  });
});

import { leesExterneFactuur } from '../factuurBetaling';

describe('leesExterneFactuur', () => {
  it('nummer en bedrag, komma als decimaalteken', () => {
    expect(leesExterneFactuur({ extern_factuurnummer: ' RS-2026-041 ', extern_bedrag_excl: '1.250,50'.replace('.', '') }))
      .toEqual({ ok: true, waarde: { extern_factuurnummer: 'RS-2026-041', extern_bedrag_excl: 1250.5 } });
  });
  it('leeg: de batchprijs geldt', () => {
    expect(leesExterneFactuur({ extern_factuurnummer: '', extern_bedrag_excl: '' }))
      .toEqual({ ok: true, waarde: { extern_factuurnummer: null, extern_bedrag_excl: null } });
  });
  it('ongeldig bedrag', () => {
    expect(leesExterneFactuur({ extern_bedrag_excl: 'abc' }).ok).toBe(false);
    expect(leesExterneFactuur({ extern_bedrag_excl: -5 }).ok).toBe(false);
  });
});
