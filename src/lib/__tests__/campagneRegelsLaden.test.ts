import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { campagneStaatToe, laadCampagneRegels } from '../campagneExclusiviteit';

function client(antwoord: (kolommen: string) => { data: unknown[] | null; error: { code?: string; message: string } | null }) {
  const gevraagd: string[] = [];
  const c = {
    from: () => ({
      select: (kolommen: string) => {
        gevraagd.push(kolommen);
        return { in: () => ({ limit: async () => antwoord(kolommen) }) };
      },
    }),
  };
  return { c: c as unknown as SupabaseClient, gevraagd };
}

describe('campagneregels laden', () => {
  it('leest "alleen eigen campagne" mee', async () => {
    const { c } = client(() => ({
      data: [{ id: 'cf', customer_id: 'k', status: 'active', meta_campagne_exclusief: {}, meta_campagne_uitgesloten: [], meta_campaign_ids: ['111'], alleen_eigen_campagne: true }],
      error: null,
    }));
    const r = await laadCampagneRegels(c);
    expect(campagneStaatToe('cf', { meta_campaign_id: '222' }, r)).toBe(false);
    expect(campagneStaatToe('cf', { meta_campaign_id: '111' }, r)).toBe(true);
  });

  it('zonder de nieuwe kolom (migratie nog niet gedraaid) gewoon verder met de oude regels', async () => {
    const { c, gevraagd } = client(k => (k.includes('alleen_eigen_campagne')
      ? { data: null, error: { code: '42703', message: 'column does not exist' } }
      : { data: [{ id: 'x', customer_id: 'k', status: 'active', meta_campagne_exclusief: { '111': 'altijd' }, meta_campagne_uitgesloten: [] }], error: null }));
    const r = await laadCampagneRegels(c);
    expect(gevraagd).toHaveLength(2);
    expect(campagneStaatToe('y', { meta_campaign_id: '111' }, r)).toBe(false);
  });

  it('een andere fout: niets verdelen', async () => {
    const { c } = client(() => ({ data: null, error: { code: '57014', message: 'timeout' } }));
    await expect(laadCampagneRegels(c)).rejects.toThrow(/campagneregels laden mislukt/);
  });
});
