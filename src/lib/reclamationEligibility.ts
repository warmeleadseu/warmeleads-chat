import type { SupabaseClient } from '@supabase/supabase-js';
import { isNicheResearchBatchKind } from './batchKind';

/** Getoond in portaal wanneer de lead via een onderzoeksbatch is geleverd. */
export const NICHE_RESEARCH_RECLAMATION_BLOCK_MESSAGE =
  'Voor leads uit een niche-onderzoeksbatch kunnen geen reclamaties worden ingediend.';

export function isReclamationBlockedForBatchKind(batchKind: string | null | undefined): boolean {
  return isNicheResearchBatchKind(batchKind);
}

type AssignmentBatchRow = {
  batch_id: string | null;
  customer_batches: { batch_kind: string | null } | { batch_kind: string | null }[] | null;
};

function batchKindFromAssignmentRow(row: AssignmentBatchRow): string | null {
  const cb = row.customer_batches;
  if (!cb) return null;
  if (Array.isArray(cb)) return cb[0]?.batch_kind ?? null;
  return cb.batch_kind ?? null;
}

/**
 * Bepaalt of een klant een reclamatie mag indienen voor een lead.
 * Geblokkeerd wanneer de toewijzing aan een niche_research-batch hangt.
 */
export async function getLeadReclamationEligibility(
  supabase: SupabaseClient,
  customerId: string,
  leadId: string,
): Promise<{ allowed: boolean; message?: string }> {
  const { data: assignments, error } = await supabase
    .from('lead_assignments')
    .select('batch_id, customer_batches(batch_kind)')
    .eq('lead_id', leadId)
    .eq('customer_id', customerId);

  if (error) {
    console.error('[reclamationEligibility] assignment lookup failed:', error.message);
    return { allowed: false, message: 'Kon reclamatiestatus niet bepalen' };
  }

  const rows = (assignments || []) as unknown as AssignmentBatchRow[];

  if (rows.length === 0) {
    const { data: directLead } = await supabase
      .from('leads')
      .select('id')
      .eq('id', leadId)
      .eq('customer_id', customerId)
      .maybeSingle();
    if (!directLead) {
      return { allowed: false, message: 'Lead niet gevonden' };
    }
    return { allowed: true };
  }

  for (const row of rows) {
    const kind = batchKindFromAssignmentRow(row);
    if (isReclamationBlockedForBatchKind(kind)) {
      return { allowed: false, message: NICHE_RESEARCH_RECLAMATION_BLOCK_MESSAGE };
    }
  }

  return { allowed: true };
}
