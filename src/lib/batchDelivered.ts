import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Eén definitie van "hoeveel leads heeft deze batch geleverd".
 *
 * ACHTERGROND (incident 16 aug – 4 sep 2026)
 * ------------------------------------------
 * Er bestonden twee definities naast elkaar:
 *   - `customer_batches.leads_delivered` (trigger `trg_sync_batch_leads_delivered`
 *     en `syncBatchDelivered`) telde **DISTINCT lead_id**;
 *   - de laatste veiligheidscheck in `distributeLead` telde **rijen**.
 *
 * Eén dubbele toewijzingsrij (race op 14 augustus) liet die twee 1 uit elkaar
 * lopen. Gevolg: een batch van 100 stond op 99/100 (dus "actief, nog ruimte"),
 * won bij elke lead de sortering, en werd daarna door de rij-check geweigerd.
 * Omdat er per lead maar één kandidaat werd geprobeerd, viel de lead volledig
 * op de grond. Negentien dagen lang werd zo in zes provincies niets geleverd.
 *
 * Daarom: distinct leads is de enige waarheid, en beide kanten gebruiken
 * hieronder dezelfde functie. Wijzig je de definitie, wijzig hem hier.
 *
 * Een lead die twee keer aan dezelfde batch hangt is één geleverde lead: de
 * klant koopt leads, geen regels in een koppeltabel.
 */

/** Paginagrootte voor de fallback-telling (PostgREST geeft max. 1000 rijen). */
const PAGE = 1000;
/** Ruim boven de grootste batch (grootste is nu 432); voorkomt oneindige loops. */
const MAX_PAGES = 50;

/**
 * Aantal **unieke** leads dat aan deze batch is toegewezen, exclusief de
 * externe offset (`leads_delivered_external`).
 *
 * Gebruikt de SQL-functie `count_distinct_leads_for_batch` (migratie 147).
 * Faalt die, dan telt de fallback client-side distinct — nooit rijen, want
 * juist dat verschil veroorzaakte het incident hierboven.
 */
export async function countDistinctLeadsForBatch(
  supabase: SupabaseClient,
  batchId: string,
): Promise<number> {
  const { data, error } = await supabase.rpc('count_distinct_leads_for_batch', {
    p_batch_id: batchId,
  });
  if (!error && typeof data === 'number') return data;

  const ids = new Set<string>();
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE;
    const { data: rows, error: pageError } = await supabase
      .from('lead_assignments')
      .select('lead_id')
      .eq('batch_id', batchId)
      .range(from, from + PAGE - 1);
    if (pageError) {
      console.error('[batchDelivered] fallback-telling mislukt:', pageError.message);
      break;
    }
    if (!rows?.length) break;
    for (const row of rows) if (row.lead_id) ids.add(row.lead_id);
    if (rows.length < PAGE) break;
  }
  return ids.size;
}

/**
 * Geleverd zoals de klant het ziet: unieke leads + de handmatige externe
 * offset. Dit is exact de waarde die in `customer_batches.leads_delivered`
 * hoort te staan.
 */
export async function countDeliveredForBatch(
  supabase: SupabaseClient,
  batchId: string,
  externalOffset: number | null | undefined,
): Promise<number> {
  const distinct = await countDistinctLeadsForBatch(supabase, batchId);
  return distinct + (externalOffset || 0);
}
