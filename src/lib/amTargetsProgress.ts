import type { SupabaseClient } from '@supabase/supabase-js';

const ASSIGN_PAGE = 1000;
const ASSIGN_MAX_PAGES = 200;

/** Alleen verse/warme distributie-leads; geen bulk-export of demo. */
export function shouldCountAssignmentForAmTargetLead(
  source: string | null | undefined,
  batchId: string | null | undefined,
  bulkBatchIds: ReadonlySet<string>,
): boolean {
  const src = source || 'distribution';
  if (src === 'bulk_export' || src === 'demo') return false;
  if (batchId && bulkBatchIds.has(batchId)) return false;
  return true;
}

/**
 * Zelfde meetlogica als `/api/admin/am-targets` (batch.account_manager_id op customer_batches;
 * geen fallback naar klant-AM — dat kan afwijken van het live leaderboard).
 */
export async function calculateAmTargetProgress(
  supabase: SupabaseClient,
  adminUserId: string,
  targetType: string,
  periodStart: string,
  periodEnd: string,
): Promise<number> {
  const endPlusOne = new Date(periodEnd);
  endPlusOne.setDate(endPlusOne.getDate() + 1);
  const endISO = endPlusOne.toISOString();

  switch (targetType) {
    case 'revenue': {
      const { data } = await supabase
        .from('customer_batches')
        .select('total_price')
        .eq('account_manager_id', adminUserId)
        .gte('created_at', periodStart)
        .lt('created_at', endISO);
      return (data || []).reduce((sum: number, b: { total_price?: unknown }) => sum + (Number(b.total_price) || 0), 0);
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

      const { data: nicheRows } = await supabase
        .from('customer_batches')
        .select('leads_delivered')
        .eq('account_manager_id', adminUserId)
        .eq('batch_kind', 'niche_research')
        .gte('created_at', periodStart)
        .lt('created_at', endISO);

      const nicheCount = (nicheRows || []).reduce(
        (sum: number, b: { leads_delivered?: unknown }) => sum + (Number(b.leads_delivered) || 0),
        0,
      );

      return pipelineCount + nicheCount;
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
