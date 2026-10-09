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
