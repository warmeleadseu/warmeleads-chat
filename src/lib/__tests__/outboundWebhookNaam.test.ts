import { describe, it, expect } from 'vitest';
import { splitsNaam } from '@/lib/integrations/outboundWebhook/naam';

describe('splitsNaam', () => {
  it('splitst een gewone naam', () => {
    expect(splitsNaam('Jan Jansen')).toEqual({ voornaam: 'Jan', achternaam: 'Jansen' });
  });

  it('houdt het tussenvoegsel bij de achternaam', () => {
    /* De hele reden dat deze functie bestaat: "Wielink" is niet zijn achternaam. */
    expect(splitsNaam('Ron van Wielink')).toEqual({ voornaam: 'Ron', achternaam: 'van Wielink' });
    expect(splitsNaam('Teus van der Klok')).toEqual({ voornaam: 'Teus', achternaam: 'van der Klok' });
    expect(splitsNaam('Bob van den Brand')).toEqual({ voornaam: 'Bob', achternaam: 'van den Brand' });
  });

  it('houdt dubbele voornamen bij elkaar in de achternaam', () => {
    expect(splitsNaam('Jan Willem Jansen')).toEqual({ voornaam: 'Jan', achternaam: 'Willem Jansen' });
  });

  it('behandelt een naam die met een tussenvoegsel begint als alleen achternaam', () => {
    expect(splitsNaam('van Wielink')).toEqual({ voornaam: null, achternaam: 'van Wielink' });
  });

  it('geeft bij één woord alleen een voornaam', () => {
    expect(splitsNaam('Ramon')).toEqual({ voornaam: 'Ramon', achternaam: null });
  });

  it('keert de volgorde om bij een komma', () => {
    expect(splitsNaam('Jansen, Jan')).toEqual({ voornaam: 'Jan', achternaam: 'Jansen' });
    expect(splitsNaam('van Wielink, Ron')).toEqual({ voornaam: 'Ron', achternaam: 'van Wielink' });
  });

  it('ruimt overtollige spaties op', () => {
    expect(splitsNaam('  Jan   Jansen  ')).toEqual({ voornaam: 'Jan', achternaam: 'Jansen' });
  });

  it('geeft niets terug bij een lege naam', () => {
    for (const leeg of [null, undefined, '', '   ']) {
      expect(splitsNaam(leeg)).toEqual({ voornaam: null, achternaam: null });
    }
  });

  it('kent buitenlandse tussenvoegsels', () => {
    expect(splitsNaam('Pablo de la Cruz').achternaam).toBe('de la Cruz');
    expect(splitsNaam('Damir von Trapp').achternaam).toBe('von Trapp');
  });
});
