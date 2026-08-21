import { describe, it, expect } from 'vitest';
import { brancheKeuringNodig, btwKeuringNodig } from './customerUpdateValidation';

/**
 * Regressietest voor augustus 2026: klanten met historisch foute data konden
 * helemaal niet meer bewerkt worden. Het formulier stuurt altijd alle velden
 * mee, dus een oude partner-branche of een e-mailadres in het btw-veld
 * blokkeerde ook het wijzigen van een e-mailadres of telefoonnummer.
 */
describe('brancheKeuringNodig', () => {
  it('keurt niet opnieuw wanneer de branches gelijk blijven', () => {
    expect(brancheKeuringNodig(['kozijnen', 'warmtepomp'], ['kozijnen', 'warmtepomp'])).toBe(false);
  });

  it('negeert volgorde, hoofdletters en spaties', () => {
    expect(brancheKeuringNodig(['kozijnen', 'warmtepomp'], [' Warmtepomp ', 'KOZIJNEN'])).toBe(false);
  });

  it('laat een bestaande partner-branche ongemoeid zolang die niet wijzigt', () => {
    // Precies het geval dat klant Bardan onbewerkbaar maakte.
    const bestaand = ['thuisbatterij_partners', 'warmtepomp_partners'];
    expect(brancheKeuringNodig(bestaand, bestaand)).toBe(false);
  });

  it('keurt wel zodra er een branche bij komt', () => {
    expect(brancheKeuringNodig(['kozijnen'], ['kozijnen', 'zonnepaneel_partners'])).toBe(true);
  });

  it('keurt wel zodra er een branche af gaat', () => {
    expect(brancheKeuringNodig(['kozijnen', 'warmtepomp'], ['kozijnen'])).toBe(true);
  });

  it('keurt wel wanneer de lijst wordt leeggemaakt', () => {
    expect(brancheKeuringNodig(['kozijnen'], [])).toBe(true);
  });

  it('laat een klant zonder branches met rust zolang dat zo blijft', () => {
    expect(brancheKeuringNodig([], [])).toBe(false);
    expect(brancheKeuringNodig(null, [])).toBe(false);
  });
});

describe('btwKeuringNodig', () => {
  const basis = {
    vatOpgeslagen: 'NL867490238B01',
    vatIngediend: 'NL867490238B01',
    landOpgeslagen: 'NL',
    landIngediend: 'NL',
    landMeegestuurd: true,
  };

  it('keurt niet opnieuw wanneer btw en land gelijk blijven', () => {
    expect(btwKeuringNodig(basis)).toBe(false);
  });

  it('laat een bestaand ongeldig btw-nummer staan zolang het niet wijzigt', () => {
    // Twaalf klanten hadden een e-mailadres in dit veld staan.
    expect(
      btwKeuringNodig({ ...basis, vatOpgeslagen: 'luigi@warmeleads.eu', vatIngediend: 'luigi@warmeleads.eu' }),
    ).toBe(false);
  });

  it('keurt wel zodra het btw-nummer verandert', () => {
    expect(btwKeuringNodig({ ...basis, vatIngediend: 'NL123456789B01' })).toBe(true);
  });

  it('keurt wel zodra het land verandert, ook bij gelijk btw-nummer', () => {
    // Een NL-nummer is niet zomaar geldig als BE-nummer.
    expect(btwKeuringNodig({ ...basis, landIngediend: 'BE' })).toBe(true);
  });

  it('negeert een landwijziging die niet is meegestuurd', () => {
    expect(btwKeuringNodig({ ...basis, landIngediend: 'BE', landMeegestuurd: false })).toBe(false);
  });
});
