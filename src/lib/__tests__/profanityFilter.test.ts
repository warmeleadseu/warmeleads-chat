import { describe, expect, it } from 'vitest';
import { checkLeadProfanity } from '../profanityFilter';

describe('checkLeadProfanity', () => {
  it('laat de voornaam Dick door', () => {
    expect(checkLeadProfanity({ naam_klant: 'Dick de Vries' }).blocked).toBe(false);
    expect(checkLeadProfanity({ naam_klant: 'dick', email: 'dick@example.nl' }).blocked).toBe(false);
  });

  it('houdt echte scheldwoorden nog tegen', () => {
    expect(checkLeadProfanity({ naam_klant: 'dickhead' })).toMatchObject({ blocked: true, word: 'dickhead' });
    expect(checkLeadProfanity({ naam_klant: 'Jan', notities: 'kankerzooi' }).blocked).toBe(true);
  });

  it('geen vals alarm op namen die een woord bevatten', () => {
    expect(checkLeadProfanity({ naam_klant: 'Hoernaert' }).blocked).toBe(false);
  });
});
