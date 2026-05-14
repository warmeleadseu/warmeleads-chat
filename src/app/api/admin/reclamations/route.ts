import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { digitsOnlyPhone, phoneSearchDigitVariants } from '@/lib/phoneSearch';

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const url = request.nextUrl.searchParams;
  const status = url.get('status');
  const search = url.get('search');
  const countOnly = url.get('count_only') === 'true';

  const supabase = createServerClient();

  if (countOnly) {
    let countQuery = supabase
      .from('lead_reclamations')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (admin.role === 'accountmanager') {
      const { data: myCustomers } = await supabase.from('customers').select('id').eq('account_manager_id', admin.id);
      const ids = (myCustomers || []).map(c => c.id);
      if (ids.length === 0) return NextResponse.json({ pending_count: 0 });
      countQuery = countQuery.in('customer_id', ids);
    }

    const { count } = await countQuery;
    return NextResponse.json({ pending_count: count || 0 });
  }

  /** Cap voor reclamaties-fetch om DB-load te beperken. Configureerbaar via ?limit (max 1000). */
  const DEFAULT_LIMIT = 500;
  const MAX_LIMIT = 1000;
  const limitParam = parseInt(url.get('limit') || '');
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, MAX_LIMIT) : DEFAULT_LIMIT;

  let query = supabase
    .from('lead_reclamations')
    .select(
      '*, customers(name, email), leads(naam_klant, telefoonnummer, email, postcode, plaatsnaam, provincie, branch)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .limit(limit + 1); // +1 om te detecteren of er meer is dan de cap.

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  if (admin.role === 'accountmanager') {
    const { data: myCustomers } = await supabase.from('customers').select('id').eq('account_manager_id', admin.id);
    const ids = (myCustomers || []).map(c => c.id);
    if (ids.length === 0) return NextResponse.json([]);
    query = query.in('customer_id', ids);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('[admin/reclamations GET]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let reclamations = data || [];
  const partial = reclamations.length > limit;
  if (partial) reclamations = reclamations.slice(0, limit);

  if (partial || (count != null && count > limit)) {
    console.info('[admin/reclamations]', {
      returned: reclamations.length,
      total: count ?? null,
      limit,
      partial: true,
    });
  }

  if (search) {
    const s = search.toLowerCase();
    const phoneVariants = phoneSearchDigitVariants(search);
    const filtered = reclamations.filter(r => {
      const custName = (r.customers as { name?: string })?.name?.toLowerCase() || '';
      const leadName = (r.leads as { naam_klant?: string })?.naam_klant?.toLowerCase() || '';
      const leadPhone = (r.leads as { telefoonnummer?: string })?.telefoonnummer || '';
      const leadPhoneDigits = digitsOnlyPhone(leadPhone);
      const phoneHit =
        leadPhone.toLowerCase().includes(s) ||
        phoneVariants.some(
          v =>
            v.length >= 3 &&
            (leadPhoneDigits.includes(v) || v.includes(leadPhoneDigits)),
        );
      return (
        custName.includes(s) ||
        leadName.includes(s) ||
        phoneHit ||
        (r.reason || '').toLowerCase().includes(s) ||
        (r.description || '').toLowerCase().includes(s)
      );
    });
    return NextResponse.json(filtered, {
      headers: {
        'X-Total-Count': String(count ?? reclamations.length),
        'X-Truncated': partial ? '1' : '0',
      },
    });
  }

  return NextResponse.json(reclamations, {
    headers: {
      'X-Total-Count': String(count ?? reclamations.length),
      'X-Truncated': partial ? '1' : '0',
    },
  });
}

const REASON_LABELS: Record<string, string> = {
  foutief_telefoonnummer: 'Foutief telefoonnummer',
  dubbele_lead: 'Dubbele lead binnen 30 dagen',
  buiten_doelgebied: 'Buiten afgesproken gebied',
};

async function findTargetBatch(
  supabase: ReturnType<typeof createServerClient>,
  leadId: string,
  customerId: string,
): Promise<Record<string, any> | null> {
  const { data: assignment } = await supabase
    .from('lead_assignments')
    .select('batch_id')
    .eq('lead_id', leadId)
    .eq('customer_id', customerId)
    .maybeSingle();

  if (assignment?.batch_id) {
    const { data: batch } = await supabase
      .from('customer_batches')
      .select('*')
      .eq('id', assignment.batch_id)
      .single();
    if (batch) return batch;
  }

  const { data: fallbackBatch } = await supabase
    .from('customer_batches')
    .select('*')
    .eq('customer_id', customerId)
    .in('status', ['active', 'completed'])
    .neq('is_paid', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return fallbackBatch || null;
}

async function addCompensation(
  supabase: ReturnType<typeof createServerClient>,
  reclamationId: string,
  reason: string,
  targetBatch: Record<string, any>,
): Promise<{ updated: boolean; reactivated: boolean }> {
  const existingComps: { amount: number; reclamation_id?: string }[] = Array.isArray(targetBatch.compensations) ? targetBatch.compensations : [];

  if (existingComps.some(c => c.reclamation_id === reclamationId)) {
    return { updated: true, reactivated: false };
  }

  const newComps = [
    ...existingComps,
    {
      amount: 1,
      reason: `Reclamatie: ${REASON_LABELS[reason] || reason}`,
      date: new Date().toISOString(),
      reclamation_id: reclamationId,
    },
  ];
  const newBatchSize = targetBatch.batch_size + 1;
  const totalComps = newComps.reduce((s, c) => s + (c.amount || 0), 0);
  const paidLeads = newBatchSize - totalComps;
  const newTotalPrice = targetBatch.price_per_lead
    ? targetBatch.price_per_lead * Math.max(0, paidLeads)
    : targetBatch.total_price;

  const batchUpdate: Record<string, unknown> = {
    batch_size: newBatchSize,
    compensations: newComps,
    total_price: newTotalPrice,
  };

  let reactivated = false;
  if (targetBatch.status === 'completed') {
    batchUpdate.status = targetBatch.is_paid === true ? 'active' : 'pending_payment';
    batchUpdate.completed_at = null;
    reactivated = true;
  }

  const { error } = await supabase
    .from('customer_batches')
    .update(batchUpdate)
    .eq('id', targetBatch.id);

  if (error) {
    console.error('[admin/reclamations] batch compensation error:', error.message);
    return { updated: false, reactivated: false };
  }

  return { updated: true, reactivated };
}

async function removeCompensation(
  supabase: ReturnType<typeof createServerClient>,
  reclamationId: string,
  targetBatch: Record<string, any>,
): Promise<{ reverted: boolean }> {
  const existingComps: { amount: number; reclamation_id?: string; [k: string]: unknown }[] =
    Array.isArray(targetBatch.compensations) ? targetBatch.compensations : [];

  const compIndex = existingComps.findIndex(c => c.reclamation_id === reclamationId);
  if (compIndex === -1) {
    return { reverted: false };
  }

  const removedAmount = existingComps[compIndex].amount || 1;
  const newComps = existingComps.filter((_, i) => i !== compIndex);
  const newBatchSize = Math.max(0, targetBatch.batch_size - removedAmount);
  const totalComps = newComps.reduce((s, c) => s + (c.amount || 0), 0);
  const paidLeads = newBatchSize - totalComps;
  const newTotalPrice = targetBatch.price_per_lead
    ? targetBatch.price_per_lead * Math.max(0, paidLeads)
    : targetBatch.total_price;

  const { error } = await supabase
    .from('customer_batches')
    .update({
      batch_size: newBatchSize,
      compensations: newComps,
      total_price: newTotalPrice,
    })
    .eq('id', targetBatch.id);

  if (error) {
    console.error('[admin/reclamations] batch compensation revert error:', error.message);
    return { reverted: false };
  }

  return { reverted: true };
}

export async function PUT(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  if (admin.role === 'accountmanager') {
    return NextResponse.json({ error: 'Alleen superadmin/admin kan reclamaties beoordelen' }, { status: 403 });
  }

  const body = await request.json();
  const { id, status, admin_notes } = body;

  if (!id) return NextResponse.json({ error: 'ID ontbreekt' }, { status: 400 });
  if (!status || !['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Status moet approved of rejected zijn' }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data: current, error: fetchErr } = await supabase
    .from('lead_reclamations')
    .select('status')
    .eq('id', id)
    .single();

  if (fetchErr || !current) {
    return NextResponse.json({ error: 'Reclamatie niet gevonden' }, { status: 404 });
  }

  const previousStatus = current.status;
  if (previousStatus === status) {
    return NextResponse.json({ error: 'Status is al ' + (status === 'approved' ? 'goedgekeurd' : 'afgewezen') }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('lead_reclamations')
    .update({
      status,
      admin_notes: admin_notes ?? null,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*, customers(name, email), leads(naam_klant, telefoonnummer, email, postcode, plaatsnaam, provincie, branch)')
    .single();

  if (error) {
    console.error('[admin/reclamations PUT]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let batchUpdated = false;
  let batchReactivated = false;
  let compensationReverted = false;

  if (data.customer_id) {
    const targetBatch = await findTargetBatch(supabase, data.lead_id, data.customer_id);

    if (targetBatch) {
      if (previousStatus === 'approved' && status === 'rejected') {
        const result = await removeCompensation(supabase, data.id, targetBatch);
        compensationReverted = result.reverted;
      } else if (status === 'approved' && previousStatus !== 'approved') {
        const result = await addCompensation(supabase, data.id, data.reason, targetBatch);
        batchUpdated = result.updated;
        batchReactivated = result.reactivated;
      }
    }
  }

  return NextResponse.json({
    ...data,
    batch_updated: batchUpdated,
    batch_reactivated: batchReactivated,
    compensation_reverted: compensationReverted,
    previous_status: previousStatus,
  });
}
