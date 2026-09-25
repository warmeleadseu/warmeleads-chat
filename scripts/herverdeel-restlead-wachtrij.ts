/**
 * Smeert de openstaande Restleads-leveringen eenmalig opnieuw uit over de werkdag.
 *
 * Nodig voor leveringen die zijn ingepland vóór de spreiding in Nederlandse tijd
 * bestond; die stonden allemaal op 10:00. Nieuwe uitdelingen doen dit zelf.
 *
 *   npx tsx scripts/herverdeel-restlead-wachtrij.ts             # alleen tonen
 *   npx tsx scripts/herverdeel-restlead-wachtrij.ts --uitvoeren # echt verplaatsen
 */
import { config } from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { herverdeelRestleadWachtrij } from '../src/lib/restleadWachtrij';
import { beschrijfMoment } from '../src/lib/restleadPlanning';

config({ path: '.env.local' });

const uitvoeren = process.argv.includes('--uitvoeren');

async function main() {
  const echt = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: voor } = await echt
    .from('geplande_leadleveringen')
    .select('id, gepland_voor, customers:customer_id(name)')
    .eq('status', 'gepland')
    .like('reden', 'Restleads:%')
    .order('gepland_voor');
  const oud = new Map((voor || []).map(r => [r.id, r]));

  /* Zonder --uitvoeren gaan de updates naar een nepclient die alleen noteert. */
  const verplaatsingen = new Map<string, string>();
  const client: SupabaseClient = uitvoeren
    ? echt
    : (new Proxy(echt, {
        get(doel, prop) {
          if (prop !== 'from') return Reflect.get(doel, prop);
          return (tabel: string) => {
            const q = doel.from(tabel);
            if (tabel !== 'geplande_leadleveringen') return q;
            return new Proxy(q, {
              get(qd, p) {
                if (p !== 'update') return Reflect.get(qd, p);
                return (waarden: { gepland_voor: string }) => ({
                  eq: (_k: string, id: string) => ({
                    eq: async () => { verplaatsingen.set(id, waarden.gepland_voor); return { error: null }; },
                  }),
                });
              },
            });
          };
        },
      }) as SupabaseClient);

  const resultaat = await herverdeelRestleadWachtrij(client);

  if (uitvoeren) {
    const { data: na } = await echt.from('geplande_leadleveringen').select('id, gepland_voor').in('id', [...oud.keys()]);
    for (const r of na || []) {
      if (r.gepland_voor !== oud.get(r.id)?.gepland_voor) verplaatsingen.set(r.id, r.gepland_voor);
    }
  }

  for (const [id, nieuw] of [...verplaatsingen].sort((a, b) => a[1].localeCompare(b[1]))) {
    const r = oud.get(id);
    const klant = (r?.customers as unknown as { name?: string } | null)?.name ?? '?';
    console.log(`${klant.padEnd(26)} ${beschrijfMoment(new Date(r!.gepland_voor)).padEnd(16)} -> ${beschrijfMoment(new Date(nieuw))}`);
  }
  console.log(`\n${resultaat.bekeken} bekeken, ${verplaatsingen.size} ${uitvoeren ? 'verplaatst' : 'zouden verplaatst worden'}.`);
}

main().catch(e => { console.error(e); process.exit(1); });
