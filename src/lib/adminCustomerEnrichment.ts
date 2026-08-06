import { createServerClient } from '@/lib/supabase';

type Supabase = ReturnType<typeof createServerClient>;

type CustomerRow = Record<string, unknown> & { id: string; password_hash?: string | null };

/**
 * Zelfde tellingen als GET /api/admin/customers (lijst): leads, bulk, actieve batches.
 * Lead-totaal = lead_assignments ∪ leads.customer_id (orphans zonder assignment).
 */
export async function enrichCustomersWithCounts(
  supabase: Supabase,
  customers: CustomerRow[],
): Promise<
  Array<
    Omit<CustomerRow, 'password_hash'> & {
      lead_count: number;
      bulk_lead_count: number;
      active_batch_count: number;
      has_password: boolean;
    }
  >
> {
  const customerIds = customers.map(c => c.id);
  const leadCounts: Record<string, number> = {};
  const bulkCounts: Record<string, number> = {};
  const batchCounts: Record<string, number> = {};

  if (customerIds.length > 0) {
    const [assignRes, batchRes] = await Promise.all([
      supabase.rpc('count_assignments_by_customer', { customer_ids: customerIds }),
      supabase
        .from('customer_batches')
        .select('customer_id, status')
        .in('customer_id', customerIds)
        .eq('status', 'active'),
    ]);

    if (assignRes.error) {
      console.error('[enrichCustomersWithCounts] RPC error', assignRes.error);
    }

    if (assignRes.data) {
      for (const row of assignRes.data as { customer_id: string; total_count?: number; bulk_count?: number }[]) {
        leadCounts[row.customer_id] = Number(row.total_count) || 0;
        bulkCounts[row.customer_id] = Number(row.bulk_count) || 0;
      }
    } else {
      // Fallback: assignments + orphan leads.customer_id
      const assignmentLeadKeys = new Set<string>();
      const { data: assignments } = await supabase
        .from('lead_assignments')
        .select('customer_id, batch_id, lead_id')
        .in('customer_id', customerIds);
      if (assignments) {
        for (const a of assignments) {
          assignmentLeadKeys.add(`${a.customer_id}:${a.lead_id}`);
          leadCounts[a.customer_id] = (leadCounts[a.customer_id] || 0) + 1;
          if (!a.batch_id) bulkCounts[a.customer_id] = (bulkCounts[a.customer_id] || 0) + 1;
        }
      }

      const { data: directLeads } = await supabase
        .from('leads')
        .select('id, customer_id')
        .in('customer_id', customerIds);
      if (directLeads) {
        for (const l of directLeads) {
          if (!l.customer_id) continue;
          const key = `${l.customer_id}:${l.id}`;
          if (assignmentLeadKeys.has(key)) continue;
          leadCounts[l.customer_id] = (leadCounts[l.customer_id] || 0) + 1;
          bulkCounts[l.customer_id] = (bulkCounts[l.customer_id] || 0) + 1;
        }
      }
    }

    if (batchRes.data) {
      for (const b of batchRes.data) {
        batchCounts[b.customer_id] = (batchCounts[b.customer_id] || 0) + 1;
      }
    }
  }

  return customers.map(c => {
    // password_hash én het (verouderde) plaintext portal_password nooit teruggeven.
    const { password_hash: _ph, portal_password: _pp, ...rest } = c as CustomerRow & { portal_password?: string | null };
    void _ph;
    void _pp;
    return {
      ...rest,
      lead_count: leadCounts[c.id] || 0,
      bulk_lead_count: bulkCounts[c.id] || 0,
      active_batch_count: batchCounts[c.id] || 0,
      has_password: !!c.password_hash,
    };
  });
}
