import type { SupabaseClient } from '@supabase/supabase-js';
import { omzetPosten, type ExterneOmzetRij, type OmzetAfspraakBatch, type OmzetBatch, type OmzetFactuur, type OmzetPost } from './omzetPerMaand';
import type { AmBronnen } from './omzetPerAm';
import { amsterdamYmd } from './appointmentSlots';

/**
 * Laadt wat omzetPosten (src/lib/omzetPerMaand.ts) nodig heeft, sinds
 * `vanaf`. Batches en facturen van vóór `vanaf` tellen niet: een factuur die
 * in de periode betaald wordt, hoort bij een batch uit dezelfde periode of
 * kort ervoor, dus laad met ruime marge (het dashboard laadt sinds 1 januari).
 */

const SOORTEN = ['leads', 'bulk_leads', 'niche_research'];
/** Vanaf hier laden het dashboard, het leaderboard en de omzettargets. */
export const OMZET_LADEN_VANAF = '2026-01-01';
type Klant = { intern?: boolean } | { intern?: boolean }[] | null;
const intern = (k: Klant) => Boolean((Array.isArray(k) ? k[0] : k)?.intern);

async function alles<T>(haal: (van: number, tot: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>, wat: string): Promise<T[]> {
  const uit: T[] = [];
  for (let p = 0; p < 50; p++) {
    const { data, error } = await haal(p * 1000, p * 1000 + 999);
    if (error) throw new Error(`${wat}: ${error.message}`);
    uit.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return uit;
}

export async function laadBetaaldeBatches(supabase: SupabaseClient, vanaf: string): Promise<OmzetBatch[]> {
  const rijen = await alles<OmzetBatch & { customers: Klant }>(
    (van, tot) => supabase
      .from('customer_batches')
      .select('id, customer_id, batch_kind, created_at, total_price, extern_bedrag_excl, account_manager_id, customers(intern)')
      .in('batch_kind', SOORTEN)
      .eq('is_paid', true)
      .gte('created_at', vanaf)
      .order('id')
      .range(van, tot),
    'batches',
  );
  return rijen.map(({ customers, ...b }) => ({ ...b, intern: intern(customers) }));
}

export async function laadFacturen(supabase: SupabaseClient, vanaf: string): Promise<OmzetFactuur[]> {
  const rijen = await alles<OmzetFactuur & { customers: Klant }>(
    (van, tot) => supabase
      .from('invoices')
      .select('id, customer_id, batch_id, appointment_batch_id, credit_note_of, subtotal, status, paid_at, created_at, customers(intern)')
      .gte('created_at', vanaf)
      .order('id')
      .range(van, tot),
    'facturen',
  );
  return rijen.map(({ customers, ...f }) => ({ ...f, intern: intern(customers) }));
}

export async function laadBetaaldeAfspraakBatches(supabase: SupabaseClient, vanaf: string): Promise<OmzetAfspraakBatch[]> {
  const rijen = await alles<OmzetAfspraakBatch & { customers: Klant }>(
    (van, tot) => supabase
      .from('appointment_batches')
      .select('id, customer_id, total_price, created_at, customers(intern)')
      .eq('is_paid', true)
      .gte('created_at', vanaf)
      .order('id')
      .range(van, tot),
    'afsprakenbatches',
  );
  return rijen.map(({ customers, ...b }) => ({ ...b, intern: intern(customers) }));
}

/** Bestaat de tabel nog niet (migratie 191 niet toegepast), dan geen rijen. */
export function tabelOntbreekt(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42P01' || error.code === 'PGRST205' || (/externe_omzet/.test(error.message ?? '') && /(does not exist|schema cache)/.test(error.message ?? ''));
}

/**
 * Externe omzet die meetelt: niet uitgezet (telt_mee, migratie 192) en niet
 * onbetaald. Handmatige invoer heeft geen betaalstatus en telt gewoon.
 */
export async function laadExterneOmzet(supabase: SupabaseClient, vanaf: string): Promise<{ rijen: ExterneOmzetRij[]; ontbreekt: boolean }> {
  const uit: ExterneOmzetRij[] = [];
  for (let p = 0; p < 50; p++) {
    const { data, error } = await supabase
      .from('externe_omzet')
      .select('datum, bedrag_excl, soort, customer_id')
      .gte('datum', vanaf)
      .eq('telt_mee', true)
      .or('betaald.is.null,betaald.eq.true')
      .order('id')
      .range(p * 1000, p * 1000 + 999);
    if (tabelOntbreekt(error)) return { rijen: [], ontbreekt: true };
    if (error) throw new Error(`externe omzet: ${error.message}`);
    uit.push(...((data ?? []) as ExterneOmzetRij[]));
    if (!data || data.length < 1000) break;
  }
  return { rijen: uit, ontbreekt: false };
}

/**
 * Alle omzetposten sinds `vanaf` (zonder afspraken, zoals op het dashboard en
 * in Winst en verlies) plus wie de accountmanager is van elke batch en klant.
 * Basis voor het leaderboard en de omzettargets (src/lib/omzetPerAm.ts).
 */
export async function laadOmzetMetAm(supabase: SupabaseClient, vanaf: string): Promise<{ posten: OmzetPost[]; bronnen: AmBronnen; externOntbreekt: boolean }> {
  const [batches, facturen, extern, klanten] = await Promise.all([
    laadBetaaldeBatches(supabase, vanaf),
    laadFacturen(supabase, vanaf),
    laadExterneOmzet(supabase, vanaf),
    alles<{ id: string; account_manager_id: string | null }>(
      (van, tot) => supabase.from('customers').select('id, account_manager_id').order('id').range(van, tot),
      'klanten',
    ),
  ]);
  const posten = omzetPosten({ batches, facturen, afspraakBatches: null, extern: extern.rijen, dagVan: iso => amsterdamYmd(new Date(iso)) });
  return {
    posten,
    bronnen: {
      batchAm: new Map(batches.map(b => [b.id, b.account_manager_id ?? null])),
      klantAm: new Map(klanten.map(k => [k.id, k.account_manager_id])),
    },
    externOntbreekt: extern.ontbreekt,
  };
}
