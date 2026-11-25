import { describe, expect, it, vi } from 'vitest';
import { alleProspectRijen, telPerStatus } from '../prospectTelling';

/** Doet de database na: nooit meer dan 1000 rijen per verzoek. */
function database(aantal: number) {
  const rijen = Array.from({ length: aantal }, (_, i) => ({ id: i, status: i % 2 ? 'nieuw' : 'verloren' }));
  return vi.fn(async (van: number, tot: number) => ({ data: rijen.slice(van, Math.min(tot + 1, van + 1000)), error: null }));
}

describe('alleProspectRijen', () => {
  it('haalt ook alles boven de 1000 op, zonder dubbele', async () => {
    const rijen = await alleProspectRijen(database(2522));
    expect(rijen).toHaveLength(2522);
    expect(new Set(rijen.map(r => r.id)).size).toBe(2522);
  });

  it('stopt bij precies 1000 en bij een lege lijst', async () => {
    expect(await alleProspectRijen(database(1000))).toHaveLength(1000);
    const leeg = database(0);
    expect(await alleProspectRijen(leeg)).toEqual([]);
    expect(leeg).toHaveBeenCalledTimes(1);
  });

  it('gooit bij een fout in plaats van een te laag aantal te geven', async () => {
    await expect(alleProspectRijen(async () => ({ data: null, error: { message: 'stuk' } }))).rejects.toThrow('stuk');
  });
});

describe('telPerStatus', () => {
  it('telt per status en houdt lege statussen op 0', () => {
    const t = telPerStatus([{ status: 'nieuw' }, { status: 'nieuw' }, { status: 'verloren' }, { status: 'bestaat-niet' }]);
    expect(t.nieuw).toBe(2);
    expect(t.verloren).toBe(1);
    expect(t.gewonnen).toBe(0);
    expect(t['bestaat-niet']).toBeUndefined();
  });
});
