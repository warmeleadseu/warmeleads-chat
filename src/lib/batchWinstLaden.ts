import type { SupabaseClient } from '@supabase/supabase-js';
import type { WinstFactuur, WinstKosten } from './batchWinst';

/**
 * Facturen per batch, met creditnota's (ook die zonder eigen batch_id, via de
 * factuur waar ze bij horen). Gedeeld door het winstoverzicht en de batchkaart.
 */
export async function laadFacturenPerBatch(supabase: SupabaseClient, ids: string[]): Promise<Map<string, WinstFactuur[]>> {
  const perBatch = new Map<string, WinstFactuur[]>();
  const factuurNaarBatch = new Map<string, string>();
  const voegToe = (batchId: string, f: WinstFactuur) => perBatch.set(batchId, [...(perBatch.get(batchId) ?? []), f]);

  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await supabase
      .from('invoices')
      .select('id, batch_id, subtotal, credit_note_of')
      .in('batch_id', ids.slice(i, i + 150));
    for (const f of data ?? []) {
      if (!f.batch_id) continue;
      if (!f.credit_note_of) factuurNaarBatch.set(f.id as string, f.batch_id as string);
      voegToe(f.batch_id as string, { subtotal: f.subtotal as number, credit: Boolean(f.credit_note_of) });
    }
  }
  const factuurIds = [...factuurNaarBatch.keys()];
  for (let i = 0; i < factuurIds.length; i += 150) {
    const { data } = await supabase
      .from('invoices')
      .select('subtotal, credit_note_of')
      .in('credit_note_of', factuurIds.slice(i, i + 150))
      .is('batch_id', null);
    for (const c of data ?? []) {
      const batchId = factuurNaarBatch.get(c.credit_note_of as string);
      if (batchId) voegToe(batchId, { subtotal: c.subtotal as number, credit: true });
    }
  }
  return perBatch;
}

/** Geleverde leads en toegerekende kosten per batch (zie migratie 174). */
export async function laadKostenPerBatch(supabase: SupabaseClient, ids: string[]): Promise<Map<string, WinstKosten>> {
  const perBatch = new Map<string, WinstKosten>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase.rpc('batch_winst_kosten', { p_batch_ids: ids.slice(i, i + 200) });
    if (error) throw new Error(error.message);
    for (const k of (data ?? []) as (WinstKosten & { batch_id: string })[]) perBatch.set(k.batch_id, k);
  }
  return perBatch;
}
