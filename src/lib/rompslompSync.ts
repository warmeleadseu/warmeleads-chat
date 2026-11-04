import type { SupabaseClient } from '@supabase/supabase-js';
import { deelIn, VANAF, type RompslompFactuur, type Voorstel, type WlBatch } from './rompslomp';

/**
 * Haalt de verkoopfacturen uit Rompslomp op en zet ze in externe_omzet
 * (bron 'rompslomp'). Gebruikt door de nachtelijke cron en de knop op
 * /admin/externe-omzet. Een handmatige keuze (meetellen of niet) blijft staan;
 * datum, bedrag, klant en betaalstatus volgen altijd Rompslomp.
 *
 * Alleen de administraties van WarmeLeads; PakketAdvies B.V. staat onder
 * dezelfde token maar is een ander bedrijf.
 */

export const ADMINISTRATIES = [
  { id: 99334194, naam: 'WarmeLeads.eu' },
  { id: 864709919, naam: 'Warme Thuisbatterij Leads' },
];
const API = 'https://api.rompslomp.nl/api/v1';

export class RompslompFout extends Error {}

async function haalFacturen(token: string, companyId: number): Promise<RompslompFactuur[]> {
  const uit: RompslompFactuur[] = [];
  for (let pagina = 1; pagina <= 100; pagina++) {
    const res = await fetch(`${API}/companies/${companyId}/sales_invoices?per_page=100&page=${pagina}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (res.status === 401) throw new RompslompFout('De Rompslomp-token is ongeldig of verlopen');
    if (!res.ok) throw new RompslompFout(`Rompslomp gaf ${res.status}`);
    const d = (await res.json()) as { sales_invoices?: RompslompFactuur[] };
    const deel = d.sales_invoices ?? [];
    uit.push(...deel);
    /* Nieuwste eerst: zodra een hele pagina van vóór de startdatum is, zijn we klaar. */
    if (deel.length < 100 || deel.every(f => f.date < VANAF)) break;
  }
  return uit;
}

async function laadBatches(supabase: SupabaseClient): Promise<WlBatch[]> {
  const uit: WlBatch[] = [];
  for (let p = 0; p < 20; p++) {
    const { data, error } = await supabase
      .from('customer_batches')
      .select('id, created_at, total_price, extern_factuurnummer, extern_bedrag_excl, customers(name), invoices(subtotal, credit_note_of)')
      .gte('created_at', '2026-03-15')
      .order('id')
      .range(p * 1000, p * 1000 + 999);
    if (error) throw new Error(`batches: ${error.message}`);
    for (const b of data ?? []) {
      const k = (Array.isArray(b.customers) ? b.customers[0] : b.customers) as { name?: string } | null;
      const f = ((b.invoices ?? []) as { subtotal: number | string | null; credit_note_of: string | null }[]).filter(x => !x.credit_note_of);
      uit.push({
        id: b.id as string, klant: k?.name ?? null, created_at: b.created_at as string, total_price: b.total_price as number | null,
        extern_factuurnummer: b.extern_factuurnummer as string | null, extern_bedrag_excl: b.extern_bedrag_excl as number | null,
        factuurbedrag: f.length > 0 ? f.reduce((s, x) => s + (Number(x.subtotal) || 0), 0) : null,
      });
    }
    if (!data || data.length < 1000) break;
  }
  return uit;
}

async function laadKlanten(supabase: SupabaseClient) {
  const uit: { id: string; name: string | null }[] = [];
  for (let p = 0; p < 20; p++) {
    const { data, error } = await supabase.from('customers').select('id, name').order('id').range(p * 1000, p * 1000 + 999);
    if (error) throw new Error(`klanten: ${error.message}`);
    uit.push(...((data ?? []) as { id: string; name: string | null }[]));
    if (!data || data.length < 1000) break;
  }
  return uit;
}

export type SyncUitkomst = {
  facturen: number; nieuw: number; bijgewerkt: number; tellenMee: number; bedragMee: number;
  voorstellen?: (Voorstel & { administratie: string })[];
};

export async function synchroniseerRompslomp(supabase: SupabaseClient, opties: { proef?: boolean } = {}): Promise<SyncUitkomst> {
  const token = process.env.ROMPSLOMP_API_TOKEN?.trim();
  if (!token) throw new RompslompFout('ROMPSLOMP_API_TOKEN staat nog niet in de omgeving (Vercel)');

  const perAdministratie = await Promise.all(ADMINISTRATIES.map(async a => ({ a, facturen: await haalFacturen(token, a.id) })));
  const administratieVan = new Map<string, string>();
  for (const { a, facturen } of perAdministratie) for (const f of facturen) administratieVan.set(String(f.id), a.naam);
  const [batches, klanten] = await Promise.all([laadBatches(supabase), laadKlanten(supabase)]);

  const voorstellen = deelIn(perAdministratie.flatMap(x => x.facturen), batches, klanten)
    .map(v => ({ ...v, administratie: administratieVan.get(v.extern_id) ?? ADMINISTRATIES[0].naam }));
  const mee = voorstellen.filter(v => v.telt_mee && v.betaald);
  const samenvatting = {
    facturen: voorstellen.length,
    tellenMee: mee.length,
    bedragMee: Math.round(mee.reduce((s, v) => s + v.bedrag_excl, 0) * 100) / 100,
  };
  if (opties.proef) return { ...samenvatting, nieuw: 0, bijgewerkt: 0, voorstellen };

  const bestaand = new Map<string, { id: string; handmatig_beoordeeld: boolean }>();
  for (let p = 0; p < 20; p++) {
    const { data, error } = await supabase.from('externe_omzet').select('id, extern_id, handmatig_beoordeeld').eq('bron', 'rompslomp').order('id').range(p * 1000, p * 1000 + 999);
    if (error) throw new Error(`externe omzet: ${error.message}`);
    for (const r of data ?? []) bestaand.set(r.extern_id as string, { id: r.id as string, handmatig_beoordeeld: Boolean(r.handmatig_beoordeeld) });
    if (!data || data.length < 1000) break;
  }

  let nieuw = 0;
  let bijgewerkt = 0;
  const nieuwe: Record<string, unknown>[] = [];
  for (const v of voorstellen) {
    const gegevens = {
      datum: v.datum, factuurnummer: v.factuurnummer, klant_naam: v.klant_naam, customer_id: v.customer_id,
      bedrag_excl: v.bedrag_excl, omschrijving: v.omschrijving, betaald: v.betaald, administratie: v.administratie,
    };
    const oud = bestaand.get(v.extern_id);
    if (!oud) {
      nieuwe.push({ ...gegevens, soort: v.soort, telt_mee: v.telt_mee, reden: v.reden, bron: 'rompslomp', extern_id: v.extern_id, aangemaakt_door: 'Rompslomp' });
      continue;
    }
    const wijziging = oud.handmatig_beoordeeld ? gegevens : { ...gegevens, soort: v.soort, telt_mee: v.telt_mee, reden: v.reden };
    const { error } = await supabase.from('externe_omzet').update({ ...wijziging, updated_at: new Date().toISOString() }).eq('id', oud.id);
    if (error) throw new Error(`bijwerken ${v.factuurnummer ?? v.extern_id}: ${error.message}`);
    bijgewerkt++;
  }
  for (let i = 0; i < nieuwe.length; i += 200) {
    const { error } = await supabase.from('externe_omzet').insert(nieuwe.slice(i, i + 200));
    if (error) throw new Error(`opslaan: ${error.message}`);
    nieuw += Math.min(200, nieuwe.length - i);
  }
  return { ...samenvatting, nieuw, bijgewerkt };
}
