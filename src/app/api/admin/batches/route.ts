import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { backfillBatch, distributeUnassignedLeads } from '@/lib/distribution';
import { checkBatchMilestones } from '@/lib/batchNotifications';
import { createInvoice, markInvoicePaid, sendNewBatchAdminEmail } from '@/lib/invoice';
import { isPipelineBatchKind, normalizeBatchKind } from '@/lib/batchKind';

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const customerId = request.nextUrl.searchParams.get('customer_id');

  let query = supabase
    .from('customer_batches')
    .select('*, customers(name)')
    .order('created_at', { ascending: false });

  if (customerId) {
    query = query.eq('customer_id', customerId);
  }

  if (admin.role === 'accountmanager') {
    const { data: myCustomers } = await supabase.from('customers').select('id').eq('account_manager_id', admin.id);
    const ids = (myCustomers || []).map(c => c.id);
    if (ids.length === 0) return NextResponse.json([]);
    query = query.in('customer_id', ids);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const body = await request.json();

  const {
    customer_id, branch, batch_size, price_per_lead, leads_per_week, leads_per_day, notes, lead_filters, lookback_days, starts_at,
    batch_kind: rawBatchKind,
    niche_title: rawNicheTitle,
  } = body;
  const batch_kind = normalizeBatchKind(typeof rawBatchKind === 'string' ? rawBatchKind : undefined);

  if (admin.role === 'accountmanager' && customer_id) {
    const { data: myCust } = await supabase.from('customers').select('id').eq('account_manager_id', admin.id).eq('id', customer_id).single();
    if (!myCust) return NextResponse.json({ error: 'Geen toegang tot deze klant' }, { status: 403 });
  }

  /** Zelfde productregels als portaal: €1.000, batch_size 1, branch `niche_research`. */
  if (batch_kind === 'niche_research') {
    if (!customer_id) {
      return NextResponse.json({ error: 'Vereiste velden ontbreken' }, { status: 400 });
    }
    const nicheTitle = typeof rawNicheTitle === 'string' ? rawNicheTitle.trim() : '';
    if (nicheTitle.length < 3) {
      return NextResponse.json(
        { error: 'Geef een duidelijke naam voor de niche (minimaal 3 tekens).' },
        { status: 400 },
      );
    }

    const RESEARCH_EXCL = 1000;
    const branchSlug = 'niche_research';
    const nicheBatchSize = 1;
    const nichePpl = RESEARCH_EXCL;
    const nicheTotal = RESEARCH_EXCL;
    const startsAtValue = starts_at ? new Date(starts_at).toISOString() : null;
    const userNotes = typeof notes === 'string' && notes.trim() ? notes.trim() : '';
    const combinedNotes = [`[Onderzoeksbatch, admin] ${nicheTitle}`, userNotes].filter(Boolean).join('\n');

    const { data: custRow, error: custErr } = await supabase
      .from('customers')
      .select('name, account_manager_id, vat_id')
      .eq('id', customer_id)
      .single();
    if (custErr || !custRow) {
      return NextResponse.json({ error: 'Klant niet gevonden' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('customer_batches')
      .insert({
        customer_id,
        branch: branchSlug,
        batch_size: nicheBatchSize,
        price_per_lead: nichePpl,
        total_price: nicheTotal,
        leads_per_week: null,
        leads_per_day: null,
        notes: combinedNotes || null,
        lead_filters: [],
        is_paid: body.is_paid === true,
        lookback_days: 0,
        starts_at: startsAtValue,
        account_manager_id: custRow.account_manager_id || null,
        batch_kind: 'niche_research',
        niche_title: nicheTitle,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const batchIsPaid = body.is_paid === true;
    const { data: brRow } = await supabase.from('branches').select('name').eq('slug', branchSlug).maybeSingle();
    const brName = brRow?.name || 'Niche-onderzoek';

    sendNewBatchAdminEmail({
      customer_name: custRow.name || 'Onbekend',
      branch_name: brName,
      batch_size: nicheBatchSize,
      total_price: nicheTotal,
      price_per_lead: nichePpl,
      is_paid: batchIsPaid,
      source: 'admin',
      batch_kind: 'niche_research',
      niche_title: nicheTitle,
      billing_country: (custRow as { country?: string | null }).country ?? 'NL',
      billing_vat_id: custRow.vat_id,
    }).catch(() => {});

    try {
      await createInvoice({
        customer_id,
        batch_id: data.id,
        branch_name: brName,
        batch_size: nicheBatchSize,
        price_per_lead: nichePpl,
        total_price: nicheTotal,
        status: batchIsPaid ? 'paid' : 'open',
        invoice_product: 'niche_research',
        niche_title: nicheTitle,
        ...(batchIsPaid ? { paid_at: new Date().toISOString() } : {}),
        ...(!batchIsPaid ? { email_context: 'new_batch_order' as const } : {}),
      });
    } catch (e) {
      console.error('[admin/batches] invoice creation failed:', e);
    }

    return NextResponse.json(data, { status: 201 });
  }

  if (!customer_id || !branch || !batch_size) {
    return NextResponse.json({ error: 'Vereiste velden ontbreken' }, { status: 400 });
  }

  const total_price = price_per_lead ? price_per_lead * batch_size : null;
  const lookback = typeof lookback_days === 'number' ? Math.max(0, Math.min(30, lookback_days)) : 3;
  const sanitizedFilters = Array.isArray(lead_filters) ? lead_filters.filter(
    (f: { field?: string; operator?: string; value?: string; values?: string[] }) =>
      f.field && f.operator && ((f.values && f.values.length > 0) || (f.value !== undefined && f.value !== ''))
  ) : [];

  const startsAtValue = starts_at ? new Date(starts_at).toISOString() : null;

  const { data: custRow } = await supabase.from('customers').select('name, account_manager_id, vat_id').eq('id', customer_id).single();

  const { data, error } = await supabase
    .from('customer_batches')
    .insert({
      customer_id,
      branch,
      batch_size,
      price_per_lead,
      total_price,
      leads_per_week: leads_per_week || null,
      leads_per_day: leads_per_day || null,
      notes,
      lead_filters: sanitizedFilters,
      is_paid: body.is_paid === true,
      lookback_days: lookback,
      starts_at: startsAtValue,
      account_manager_id: custRow?.account_manager_id || null,
      batch_kind,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Targeted backfill: only if starts_at is NULL or in the past
  const startsInFuture = startsAtValue && new Date(startsAtValue) > new Date();
  if (lookback > 0 && !startsInFuture && isPipelineBatchKind(batch_kind)) {
    try { backfillBatch(data.id, lookback); } catch { /* non-blocking */ }
  }

  // Admin notification email + invoice if paid with pricing
  const batchIsPaid = body.is_paid === true;
  const { data: brRow } = await supabase.from('branches').select('name').eq('slug', branch).single();
  const brName = brRow?.name || branch;

  sendNewBatchAdminEmail({
    customer_name: custRow?.name || 'Onbekend',
    branch_name: brName,
    batch_size,
    total_price: total_price || 0,
    price_per_lead: price_per_lead || 0,
    is_paid: batchIsPaid,
    source: 'admin',
    batch_kind,
    billing_country: (custRow as { country?: string | null } | undefined)?.country ?? 'NL',
    billing_vat_id: custRow?.vat_id,
  }).catch(() => {});

  if (price_per_lead && total_price) {
    try {
      await createInvoice({
        customer_id,
        batch_id: data.id,
        branch_name: brName,
        batch_size,
        price_per_lead,
        total_price,
        status: batchIsPaid ? 'paid' : 'open',
        ...(batchIsPaid ? { paid_at: new Date().toISOString() } : {}),
        ...(batch_kind === 'bulk_leads' ? { invoice_product: 'bulk_leads' as const } : {}),
        ...(!batchIsPaid ? { email_context: 'new_batch_order' as const } : {}),
      });
    } catch (e) {
      console.error('[admin/batches] invoice creation failed:', e);
    }
  }

  return NextResponse.json(data, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const body = await request.json();
  const { id, trigger_backfill, compensation, ...updates } = body;

  if (!id) return NextResponse.json({ error: 'ID ontbreekt' }, { status: 400 });

  if (updates.lead_filters && Array.isArray(updates.lead_filters)) {
    updates.lead_filters = updates.lead_filters.filter(
      (f: { field?: string; operator?: string; values?: string[]; value?: string }) =>
        f.field && f.operator && ((f.values && f.values.length > 0) || (f.value !== undefined && f.value !== ''))
    );
  }

  const { data: existing, error: fetchError } = await supabase
    .from('customer_batches')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    console.error('[admin/batches PUT] fetch error:', fetchError?.message);
    return NextResponse.json({ error: fetchError?.message || 'Batch niet gevonden' }, { status: fetchError ? 500 : 404 });
  }

  if (updates.batch_kind !== undefined) {
    const nextKind = normalizeBatchKind(typeof updates.batch_kind === 'string' ? updates.batch_kind : undefined);
    if (nextKind === 'niche_research') {
      return NextResponse.json(
        { error: 'Een bestaande batch kan niet naar onderzoeksbatch worden omgezet. Maak een nieuwe onderzoeksbatch aan.' },
        { status: 400 },
      );
    }
    updates.batch_kind = nextKind;
  }

  if (admin.role === 'accountmanager') {
    const { data: myCust } = await supabase.from('customers').select('id').eq('account_manager_id', admin.id).eq('id', existing.customer_id).single();
    if (!myCust) return NextResponse.json({ error: 'Geen toegang tot deze batch' }, { status: 403 });
  }

  // Append compensation entry when extra leads are added
  if (compensation && compensation.amount > 0) {
    const existingComps = Array.isArray(existing.compensations) ? existing.compensations : [];
    updates.compensations = [
      ...existingComps,
      { amount: compensation.amount, reason: compensation.reason || '', date: new Date().toISOString() },
    ];
  }

  const isNicheExisting = (existing as { batch_kind?: string }).batch_kind === 'niche_research';

  if (isNicheExisting && updates.batch_size !== undefined && Number(updates.batch_size) !== 1) {
    return NextResponse.json({ error: 'Onderzoeksbatch heeft altijd omvang 1.' }, { status: 400 });
  }

  // Recalculate total_price - exclude compensation leads (those are free)
  if (!isNicheExisting && (updates.batch_size || updates.price_per_lead)) {
    const ppl = updates.price_per_lead ?? existing.price_per_lead;
    const totalComps = (updates.compensations || existing.compensations || [])
      .reduce((s: number, c: { amount: number }) => s + (c.amount || 0), 0);
    const paidLeads = (updates.batch_size ?? existing.batch_size) - totalComps;
    if (ppl) updates.total_price = ppl * Math.max(0, paidLeads);
  }

  // Validate leads_delivered and compute external offset
  if (updates.leads_delivered !== undefined) {
    const delivered = Number(updates.leads_delivered);
    if (isNaN(delivered) || delivered < 0) {
      return NextResponse.json({ error: 'Geleverde leads moet 0 of hoger zijn' }, { status: 400 });
    }

    const { count: assignmentCount } = await supabase
      .from('lead_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('batch_id', id);

    const systemCount = assignmentCount || 0;
    const external = Math.max(0, delivered - systemCount);

    updates.leads_delivered = systemCount + external;
    updates.leads_delivered_external = external;

    const batchSize = updates.batch_size ?? existing.batch_size;

    if (!updates.status) {
      if (updates.leads_delivered >= batchSize && existing.status !== 'completed') {
        updates.status = 'completed';
        updates.completed_at = new Date().toISOString();
      } else if (updates.leads_delivered < batchSize && existing.status === 'completed') {
        updates.status = 'active';
        updates.completed_at = null;
      }
    }
  }

  // Only send columns that exist in the table
  const allowedFields = [
    'batch_size', 'leads_delivered', 'leads_delivered_external', 'is_paid',
    'price_per_lead', 'total_price', 'leads_per_day', 'leads_per_week',
    'notes', 'lead_filters', 'status', 'completed_at', 'lookback_days',
    'compensations', 'starts_at', 'account_manager_id', 'batch_kind', 'niche_title',
  ];
  const safeUpdates: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in updates) safeUpdates[key] = updates[key];
  }

  const { data, error } = await supabase
    .from('customer_batches')
    .update(safeUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[admin/batches PUT] update error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const effectiveBatchKind =
    updates.batch_kind !== undefined
      ? String(updates.batch_kind)
      : (existing as { batch_kind?: string }).batch_kind;

  // Trigger milestone notifications when leads_delivered changes
  if (updates.leads_delivered !== undefined && updates.leads_delivered !== existing.leads_delivered) {
    const batchSize = updates.batch_size ?? existing.batch_size;
    if (isPipelineBatchKind(effectiveBatchKind)) {
      checkBatchMilestones(supabase, id, updates.leads_delivered, batchSize).catch(() => {});
    }
  }

  // When batch_size grew and backfill requested, fill the extra slots
  const batchGrew = trigger_backfill && updates.batch_size && updates.batch_size > existing.batch_size;
  if (batchGrew && isPipelineBatchKind(effectiveBatchKind)) {
    const lookback = existing.lookback_days ?? 3;
    try { backfillBatch(id, Math.max(lookback, 3)); } catch { /* non-blocking */ }
  }

  // When admin manually marks batch as paid, update any open invoice
  if (updates.is_paid === true && existing.is_paid === false) {
    markInvoicePaid(id, 'admin-manual').catch(e => console.error('[admin/batches] markInvoicePaid failed:', e));
  }

  // When a batch is (re)activated, trigger distribution
  if (updates.status === 'active' && !batchGrew) {
    try { distributeUnassignedLeads(); } catch { /* non-blocking */ }
  }

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID ontbreekt' }, { status: 400 });

  if (admin.role === 'accountmanager') {
    const { data: batch } = await supabase.from('customer_batches').select('customer_id').eq('id', id).single();
    if (batch) {
      const { data: myCust } = await supabase.from('customers').select('id').eq('account_manager_id', admin.id).eq('id', batch.customer_id).single();
      if (!myCust) return NextResponse.json({ error: 'Geen toegang tot deze batch' }, { status: 403 });
    }
  }

  const { error } = await supabase.from('customer_batches').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
