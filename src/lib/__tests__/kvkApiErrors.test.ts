/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { humanizeKvkError } from '@/lib/kvkApiErrors';

describe('humanizeKvkError', () => {
  it('vertaalt KVK IPD5200 JSON naar begrijpelijke tekst', () => {
    const body = JSON.stringify({
      fout: [{ code: 'IPD5200', omschrijving: 'Er zijn geen gegevens gevonden die voldoen aan de opgegeven zoekparameters.' }],
    });
    const msg = humanizeKvkError(404, body);
    expect(msg).toContain('Geen bedrijven gevonden');
    expect(msg).not.toContain('IPD5200');
    expect(msg).not.toContain('{');
  });

  it('gebruikt omschrijving voor onbekende codes', () => {
    const body = JSON.stringify({
      fout: [{ code: 'OTHER', omschrijving: 'Specifieke fout van de KVK.' }],
    });
    expect(humanizeKvkError(400, body)).toBe('Specifieke fout van de KVK.');
  });

  it('valt terug op status zonder parseerbare JSON', () => {
    expect(humanizeKvkError(404, '')).toContain('Geen gegevens');
    expect(humanizeKvkError(503, 'html error')).toContain('storing');
  });
});
