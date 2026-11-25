import type { SupabaseClient } from '@supabase/supabase-js';
import { amsterdamYmd } from './appointmentSlots';
import { berekenBatchWinst, type WinstBatchInvoer } from './batchWinst';
import { laadFacturenPerBatch, laadKostenPerBatch } from './batchWinstLaden';
import type { OmzetPost } from './omzetPerMaand';
import {
  WINSTDELING_SLEUTEL,
  leesWinstAfspraken,
  winstdeelVan,
  winstdelingBijPosten,
  type GedeeldeBatch,
  type WinstAfspraak,
  type WinstdelingPost,
} from './winstdeling';

/** De winstdelingsafspraken. Gooit bij een fout: zonder zou de winst ongemerkt te hoog zijn. */
export async function laadWinstAfspraken(supabase: SupabaseClient): Promise<WinstAfspraak[]> {
  const { data, error } = await supabase.from('app_settings').select('value').eq('key', WINSTDELING_SLEUTEL).maybeSingle();
  if (error) throw new Error(`winstdeling: ${error.message}`);
  return leesWinstAfspraken(data?.value as string | null | undefined);
}

/** Het winstdeel van een batch: op de Nederlandse aanmaakdag. */
export function winstdeelVanBatch(afspraken: WinstAfspraak[], b: { customer_id: string; created_at: string }): number {
  return winstdeelVan(afspraken, b.customer_id, amsterdamYmd(new Date(b.created_at)));
}

/** De winstdeling die hoort bij de betaalde omzetposten, op de dag van betalen. */
export async function laadWinstdelingBijPosten(supabase: SupabaseClient, posten: OmzetPost[]): Promise<WinstdelingPost[]> {
  const afspraken = await laadWinstAfspraken(supabase);
  if (afspraken.length === 0) return [];
  const klanten = new Set(afspraken.map(a => a.customer_id));
  const ids = [...new Set(posten.filter(p => p.batch_id && p.customer_id && klanten.has(p.customer_id)).map(p => p.batch_id as string))];

  type Rij = WinstBatchInvoer & { id: string; customer_id: string; created_at: string };
  const rijen: Rij[] = [];
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await supabase
      .from('customer_batches')
      .select('id, customer_id, created_at, batch_kind, status, batch_size, total_price, is_paid, mollie_payment_id, leads_delivered_external, extern_bedrag_excl')
      .in('id', ids.slice(i, i + 150));
    if (error) throw new Error(`winstdeling: ${error.message}`);
    rijen.push(...((data ?? []) as Rij[]));
  }
  const metDeel = rijen.filter(b => winstdeelVanBatch(afspraken, b) > 0);
  const batchIds = metDeel.map(b => b.id);
  const [facturen, kosten] = await Promise.all([laadFacturenPerBatch(supabase, batchIds), laadKostenPerBatch(supabase, batchIds)]);
  const batches = new Map<string, GedeeldeBatch>();
  for (const b of metDeel) {
    const w = berekenBatchWinst(b, facturen.get(b.id) ?? [], kosten.get(b.id) ?? null);
    /* Nog niets geleverd: geen kosten bekend, dus nog geen betrouwbare winst om te delen. */
    batches.set(b.id, { deel: winstdeelVanBatch(afspraken, b), omzet: w.omzet, winst: w.prognoseWinst ?? w.winst });
  }
  return winstdelingBijPosten(posten, batches, afspraken);
}
