import type { SupabaseClient } from '@supabase/supabase-js';
import { laadOmzetMetAm, OMZET_LADEN_VANAF } from './omzetPerMaandLaden';
import { omzetPerAm } from './omzetPerAm';

export type OmzetBron = ReturnType<typeof laadOmzetMetAm>;

/** Laadt de omzet één keer voor meerdere targets. */
export function omzetBronVoorTargets(supabase: SupabaseClient): () => OmzetBron {
  let bron: OmzetBron | null = null;
  return () => (bron ??= laadOmzetMetAm(supabase, OMZET_LADEN_VANAF));
}

const ASSIGN_PAGE = 1000;
const ASSIGN_MAX_PAGES = 200;

/** Alleen verse/warme distributie-leads; geen bulk-export of demo. */
export function shouldCountAssignmentForAmTargetLead(
  source: string | null | undefined,
  batchId: string | null | undefined,
  bulkBatchIds: ReadonlySet<string>,
): boolean {
  const src = source || 'distribution';
  if (src === 'bulk_export' || src === 'demo' || src === 'mirror') return false;
  if (batchId && bulkBatchIds.has(batchId)) return false;
  return true;
}

/**
 * Voortgang van een target. Omzet: dezelfde betaalde omzet als het dashboard
 * en het leaderboard (src/lib/omzetPerAm.ts): excl. btw, op de dag van
 * betalen, met losse en externe facturen en min creditnota's; de
 * accountmanager van de batch, anders die van de klant. Tot 4 nov 2026 telde
 * hier de batchprijs bij aanmaken, ook als de batch nog niet betaald was.
 * Uitsluitingen van het leaderboard gelden hier niet.
 */
export async function calculateAmTargetProgress(
  supabase: SupabaseClient,
  adminUserId: string,
  targetType: string,
  periodStart: string,
  periodEnd: string,
  omzet: () => OmzetBron = omzetBronVoorTargets(supabase),
): Promise<number> {
  const endPlusOne = new Date(periodEnd);
  endPlusOne.setDate(endPlusOne.getDate() + 1);
  const endISO = endPlusOne.toISOString();

  switch (targetType) {
    case 'revenue': {
      const { posten, bronnen } = await omzet();
      const r = omzetPerAm(posten, { vanDag: periodStart.slice(0, 10), totDag: periodEnd.slice(0, 10) }, bronnen).get(adminUserId);
      return r?.totaal ?? 0;
    }
    case 'batches': {
      const { count } = await supabase
        .from('customer_batches')
        .select('id', { count: 'exact', head: true })
        .eq('account_manager_id', adminUserId)
        .gte('created_at', periodStart)
        .lt('created_at', endISO);
      return count || 0;
    }
    case 'new_customers': {
      const { count } = await supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('account_manager_id', adminUserId)
        .gte('created_at', periodStart)
        .lt('created_at', endISO);
      return count || 0;
    }
    case 'leads_delivered': {
      const { data: custRows } = await supabase.from('customers').select('id').eq('account_manager_id', adminUserId);
      const custIds = (custRows || []).map(c => c.id);
      if (custIds.length === 0) return 0;

      const { data: bulkBatchRows } = await supabase
        .from('customer_batches')
        .select('id')
        .in('customer_id', custIds)
        .eq('batch_kind', 'bulk_leads');
      const bulkBatchIds = new Set((bulkBatchRows || []).map(b => b.id as string));

      let pipelineCount = 0;
      let offset = 0;
      for (let page = 0; page < ASSIGN_MAX_PAGES; page++) {
        const { data: rows, error } = await supabase
          .from('lead_assignments')
          .select('id, source, batch_id')
          .in('customer_id', custIds)
          .gte('assigned_at', periodStart)
          .lt('assigned_at', endISO)
          .range(offset, offset + ASSIGN_PAGE - 1);
        if (error) throw new Error(error.message);
        if (!rows?.length) break;
        for (const row of rows) {
          if (
            shouldCountAssignmentForAmTargetLead(
              row.source as string | null,
              row.batch_id as string | null,
              bulkBatchIds,
            )
          ) {
            pipelineCount++;
          }
        }
        if (rows.length < ASSIGN_PAGE) break;
        offset += rows.length;
      }

      /* Leveringen aan niche-onderzoeksbatches staan al in lead_assignments en
         zitten dus in de telling hierboven. Daar telde ook leads_delivered van
         die batches nog eens bij op, waardoor niche-leads dubbel meetelden. */
      return pipelineCount;
    }
    default:
      return 0;
  }
}

/** Eerste en laatste kalenderdag van een maand als `YYYY-MM-DD` (lokale datum). */
export function calendarMonthDateBounds(yearMonth: string): { first: string; last: string } {
  const m = /^(\d{4})-(\d{2})$/.exec(yearMonth.trim());
  if (!m) throw new Error(`Invalid year_month: ${yearMonth}`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) throw new Error(`Invalid year_month: ${yearMonth}`);
  const first = `${y}-${String(mo).padStart(2, '0')}-01`;
  const lastD = new Date(y, mo, 0).getDate();
  const last = `${y}-${String(mo).padStart(2, '0')}-${String(lastD).padStart(2, '0')}`;
  return { first, last };
}
