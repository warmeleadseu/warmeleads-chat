import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized, forbidden } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { syncBatchDelivered } from '@/lib/batchSync';

async function getAmCustomerIds(supabase: ReturnType<typeof createServerClient>, adminId: string): Promise<string[]> {
  const { data } = await supabase.from('customers').select('id').eq('account_manager_id', adminId);
  return (data || []).map(c => c.id);
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const leadId = request.nextUrl.searchParams.get('lead_id');
  const customerId = request.nextUrl.searchParams.get('customer_id');
  const batchId = request.nextUrl.searchParams.get('batch_id');

  const isAM = admin.role === 'accountmanager';
  let amCustomerIds: string[] = [];
  if (isAM) {
    amCustomerIds = await getAmCustomerIds(supabase, admin.id);
    if (customerId && !amCustomerIds.includes(customerId)) return forbidden();
  }

  /** Default tijdvenster voor superadmin/admin zonder customer-scope. Configureerbaar via ?days=. */
  const DEFAULT_LOOKBACK_DAYS = 365;
  const daysParam = parseInt(request.nextUrl.searchParams.get('days') || '');
  const lookbackDays = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 1825) : DEFAULT_LOOKBACK_DAYS;
  const lookbackCutoff = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

  /** Harde paginatie-cap (100 pagina's × 1000 = 100k rijen) als ultieme safety net. */
  const MAX_PAGES = 100;
  const PAGE_SIZE = 1000;

  let baseQuery = supabase
    .from('lead_assignments')
    .select('*, customers(name), leads(naam_klant, email, branch, postcode, plaatsnaam)')
    .order('assigned_at', { ascending: false });

  if (isAM && !customerId) baseQuery = baseQuery.in('customer_id', amCustomerIds);
  if (leadId) baseQuery = baseQuery.eq('lead_id', leadId);
  if (customerId) baseQuery = baseQuery.eq('customer_id', customerId);
  if (batchId) baseQuery = baseQuery.eq('batch_id', batchId);
  // Alleen tijdvenster afdwingen bij brede queries (geen specifieke lead/customer/batch filter).
  const wideQuery = !leadId && !customerId && !batchId;
  if (wideQuery) baseQuery = baseQuery.gte('assigned_at', lookbackCutoff);

  const results: Record<string, unknown>[] = [];
  let partial = false;
  for (let p = 0; p < MAX_PAGES; p++) {
    const offset = p * PAGE_SIZE;
    const { data: batch, error: batchError } = await baseQuery.range(offset, offset + PAGE_SIZE - 1);
    if (batchError) return NextResponse.json({ error: batchError.message }, { status: 500 });
    if (!batch || batch.length === 0) break;
    results.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    if (p === MAX_PAGES - 1) partial = true;
  }

  if (customerId && !batchId) {
    const assignedLeadIds = new Set(results.map(a => String(a.lead_id)));

    const directLeads: Record<string, unknown>[] = [];
    for (let p = 0; p < MAX_PAGES; p++) {
      const dlOffset = p * PAGE_SIZE;
      const { data: dlBatch } = await supabase
        .from('leads')
        .select('id, naam_klant, email, branch, postcode, plaatsnaam, created_at')
        .eq('customer_id', customerId)
        .range(dlOffset, dlOffset + PAGE_SIZE - 1);
      if (!dlBatch || dlBatch.length === 0) break;
      directLeads.push(...dlBatch);
      if (dlBatch.length < PAGE_SIZE) break;
      if (p === MAX_PAGES - 1) partial = true;
    }

    const missing = directLeads.filter(l => !assignedLeadIds.has(String(l.id)));

    if (missing.length > 0) {
      const rows = missing.map(l => ({ lead_id: l.id, customer_id: customerId }));
      await supabase
        .from('lead_assignments')
        .upsert(rows, { onConflict: 'lead_id,customer_id' });

      for (const l of missing) {
        results.push({
          id: `synced-${l.id}`,
          lead_id: l.id,
          customer_id: customerId,
          batch_id: null,
          distance_km: null,
          assigned_at: l.created_at,
          customers: null,
          leads: {
            naam_klant: l.naam_klant,
            email: l.email,
            branch: l.branch,
            postcode: l.postcode,
            plaatsnaam: l.plaatsnaam,
          },
        });
      }
    }
  }

  if (partial || wideQuery) {
    console.info('[admin/assignments]', {
      returned: results.length,
      wideQuery,
      lookbackDays: wideQuery ? lookbackDays : null,
      partial,
    });
  }

  return NextResponse.json(results, {
    headers: {
      'X-Truncated': partial ? '1' : '0',
      'X-Lookback-Days': wideQuery ? String(lookbackDays) : '0',
    },
  });
}

export async function DELETE(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID ontbreekt' }, { status: 400 });

  const { data: assignment } = await supabase
    .from('lead_assignments')
    .select('batch_id, customer_id')
    .eq('id', id)
    .single();

  if (admin.role === 'accountmanager' && assignment?.customer_id) {
    const amCustIds = await getAmCustomerIds(supabase, admin.id);
    if (!amCustIds.includes(assignment.customer_id)) return forbidden();
  }

  const { error } = await supabase.from('lead_assignments').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (assignment?.batch_id) {
    await syncBatchDelivered(supabase, assignment.batch_id);
  }

  return NextResponse.json({ ok: true });
}
