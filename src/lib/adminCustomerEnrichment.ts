import { createServerClient } from '@/lib/supabase';

type Supabase = ReturnType<typeof createServerClient>;

type CustomerRow = Record<string, unknown> & { id: string; password_hash?: string | null };

/**
 * Zelfde tellingen als GET /api/admin/customers (lijst): leads, bulk, actieve batches.
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

    if (assignRes.data) {
      for (const row of assignRes.data as { customer_id: string; total_count?: number; bulk_count?: number }[]) {
        leadCounts[row.customer_id] = row.total_count || 0;
        bulkCounts[row.customer_id] = row.bulk_count || 0;
      }
    } else {
      const { data: assignments } = await supabase
        .from('lead_assignments')
        .select('customer_id, batch_id')
        .in('customer_id', customerIds);
      if (assignments) {
        for (const a of assignments) {
          leadCounts[a.customer_id] = (leadCounts[a.customer_id] || 0) + 1;
          if (!a.batch_id) bulkCounts[a.customer_id] = (bulkCounts[a.customer_id] || 0) + 1;
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
