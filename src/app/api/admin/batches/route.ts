import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { backfillBatch, distributeUnassignedLeads } from '@/lib/distribution';
import { checkBatchMilestones } from '@/lib/batchNotifications';
import { createInvoice, markInvoicePaid, sendNewBatchAdminEmail } from '@/lib/invoice';
import { isMetaCampaignSyncBatchKind, isPipelineBatchKind, normalizeBatchKind } from '@/lib/batchKind';
import { initialPipelineBatchStatus } from '@/lib/customerBatchStatus';
import {
  reconcileBatchMetaCampaigns,
  normalizeCampaignIds,
  sanitizePausedMetaCampaignIds,
  metaDefaultsBranchForBatch,
} from '@/lib/metaBatchCampaignSync';
import { adminBatchListSelect, adminBatchListSelectNoBatchTargets, isMissingBatchTargetsError } from '@/lib/adminBatchQueries';
import { resolveMetaCampaignFieldsForNewLeadBatch, upsertCustomerBranchMetaDefaults } from '@/lib/metaCampaignInheritance';
import {
  ensureCustomerHasBranch,
  validateLeadBranchSlug,
} from '@/lib/nicheResearch';
import { deliveryModelForNewBatch, isCappedDeliveryModel } from '@/lib/batchDeliveryModel';
import { insertBatchTargets, type BatchTargetInsertInput } from '@/lib/batchTargetInsert';
import { logAudit } from '@/lib/audit';
import { amCustomerAccessOrFilter } from '@/lib/permissions';

function sanitizeMetaCampaignIdsInput(raw: unknown): string[] | undefined {
  if (raw === undefined) return undefined;
  const list: string[] = [];
  if (Array.isArray(raw)) {
    for (const x of raw) list.push(String(x).trim());
  } else if (typeof raw === 'string') {
    list.push(...raw.split(/[\s,;\n]+/).map(s => s.trim()));
  } else return undefined;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of list) {
    if (!/^\d+$/.test(s) || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= 10) break;
  }
  return out;
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const customerId = request.nextUrl.searchParams.get('customer_id');

  let amCustomerIds: string[] | null = null;
  if (admin.role === 'accountmanager') {
    const { data: myCustomers } = await supabase.from('customers').select('id').or(amCustomerAccessOrFilter(admin.id));
    amCustomerIds = (myCustomers || []).map(c => c.id);
    if (amCustomerIds.length === 0) return NextResponse.json([]);
  }

  const runQuery = (select: string) => {
    let q = supabase.from('customer_batches').select(select).order('created_at', { ascending: false });
    if (customerId) q = q.eq('customer_id', customerId);
    if (amCustomerIds) q = q.in('customer_id', amCustomerIds);
    return q;
  };

  let { data, error } = await runQuery(adminBatchListSelect);
  // Fallback: `batch_targets` bestaat nog niet (migratie 144 niet toegepast).
  if (error && isMissingBatchTargetsError(error.message)) {
    ({ data, error } = await runQuery(adminBatchListSelectNoBatchTargets));
  }
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
    lead_branch_slug: rawLeadBranchSlug,
  } = body;
  const batch_kind = normalizeBatchKind(typeof rawBatchKind === 'string' ? rawBatchKind : undefined);
  // Optionele betaallink-mail bij open factuur. Default true (backwards compat); admin/AM
  // kan in de UI uitvinken zodat alleen de factuur + Mollie-checkout wordt aangemaakt
  // zonder dat de klant direct gemaild wordt.
  const sendPaymentEmail = body.send_payment_email !== false;

  if (admin.role === 'accountmanager' && customer_id) {
    const { data: myCust } = await supabase.from('customers').select('id').or(amCustomerAccessOrFilter(admin.id)).eq('id', customer_id).single();
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

    const leadBranchSlug = typeof rawLeadBranchSlug === 'string' ? rawLeadBranchSlug.trim() : '';
    const branchCheck = await validateLeadBranchSlug(supabase, leadBranchSlug);
    if (!branchCheck.ok) {
      return NextResponse.json({ error: branchCheck.error }, { status: 400 });
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
      .select('name, account_manager_id, country, vat_id')
      .eq('id', customer_id)
      .single();
    if (custErr || !custRow) {
      return NextResponse.json({ error: 'Klant niet gevonden' }, { status: 404 });
    }

    const nichePaid = body.is_paid === true;
    const nicheInsertPayload: Record<string, unknown> = {
      customer_id,
      branch: branchSlug,
      batch_size: nicheBatchSize,
      price_per_lead: nichePpl,
      total_price: nicheTotal,
      leads_per_week: null,
      leads_per_day: null,
      notes: combinedNotes || null,
      lead_filters: [],
      status: initialPipelineBatchStatus(nichePaid),
      is_paid: nichePaid,
      lookback_days: 0,
      starts_at: startsAtValue,
      account_manager_id: custRow.account_manager_id || null,
      batch_kind: 'niche_research',
      delivery_model: deliveryModelForNewBatch('niche_research'),
      niche_title: nicheTitle,
      lead_branch_slug: leadBranchSlug,
    };
    if (body.meta_campaign_ids !== undefined) {
      nicheInsertPayload.meta_campaign_ids = sanitizeMetaCampaignIdsInput(body.meta_campaign_ids) ?? [];
    }
    if (body.meta_campaign_sync_enabled !== undefined) {
      nicheInsertPayload.meta_campaign_sync_enabled = body.meta_campaign_sync_enabled === true;
    }
    if (body.meta_campaign_paused_ids !== undefined) {
      const linked = normalizeCampaignIds(nicheInsertPayload.meta_campaign_ids ?? []);
      nicheInsertPayload.meta_campaign_paused_ids = sanitizePausedMetaCampaignIds(
        linked,
        body.meta_campaign_paused_ids,
      );
    }

    const { data, error } = await supabase
      .from('customer_batches')
      .insert(nicheInsertPayload)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await ensureCustomerHasBranch(supabase, customer_id, leadBranchSlug);

    const batchIsPaid = nichePaid;
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
      billing_country: (custRow.country as string | null | undefined) ?? 'NL',
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
        ...(!batchIsPaid ? { email_context: 'new_batch_order' as const, send_payment_email: sendPaymentEmail } : {}),
      });
    } catch (e) {
      console.error('[admin/batches] invoice creation failed:', e);
    }

    if (nichePaid && data.status === 'active') {
      try {
        distributeUnassignedLeads();
      } catch {
        /* non-blocking */
      }
    }

    reconcileBatchMetaCampaigns(supabase, data.id, 'admin').catch(e =>
      console.error('[admin/batches] niche meta reconcile:', e),
    );

    return NextResponse.json(data, { status: 201 });
  }

  if (!customer_id || !branch || !batch_size) {
    return NextResponse.json({ error: 'Vereiste velden ontbreken' }, { status: 400 });
  }

  const { data: branchRow } = await supabase
    .from('branches')
    .select('slug, is_active, is_partner_branch')
    .eq('slug', branch)
    .maybeSingle();
  if (!branchRow) {
    return NextResponse.json({ error: `Branche '${branch}' bestaat niet.` }, { status: 400 });
  }
  if (!branchRow.is_active) {
    return NextResponse.json({ error: `Branche '${branch}' is niet actief.` }, { status: 400 });
  }
  if ((branchRow as { is_partner_branch?: boolean | null }).is_partner_branch === true) {
    return NextResponse.json(
      { error: `Branche '${branch}' is een partner-branche en is niet leverbaar als leadbatch. Gebruik de prospects-pijplijn.` },
      { status: 400 },
    );
  }

  const total_price = price_per_lead ? price_per_lead * batch_size : null;
  const lookback = typeof lookback_days === 'number' ? Math.max(0, Math.min(30, lookback_days)) : 3;
  const sanitizedFilters = Array.isArray(lead_filters) ? lead_filters.filter(
    (f: { field?: string; operator?: string; value?: string; values?: string[] }) =>
      f.field && f.operator && ((f.values && f.values.length > 0) || (f.value !== undefined && f.value !== ''))
  ) : [];

  const startsAtValue = starts_at ? new Date(starts_at).toISOString() : null;

  const { data: custRow } = await supabase.from('customers').select('name, account_manager_id, country, vat_id').eq('id', customer_id).single();

  const batchIsPaid = body.is_paid === true;

  const insertPayload: Record<string, unknown> = {
    customer_id,
    branch,
    batch_size,
    price_per_lead,
    total_price,
    leads_per_week: leads_per_week || null,
    leads_per_day: leads_per_day || null,
    notes,
    lead_filters: sanitizedFilters,
    status: initialPipelineBatchStatus(batchIsPaid),
    is_paid: batchIsPaid,
    lookback_days: lookback,
    starts_at: startsAtValue,
    account_manager_id: custRow?.account_manager_id || null,
    batch_kind,
    delivery_model: deliveryModelForNewBatch(batch_kind),
  };

  if (isMetaCampaignSyncBatchKind(batch_kind)) {
    if (body.meta_campaign_ids !== undefined) {
      insertPayload.meta_campaign_ids = sanitizeMetaCampaignIdsInput(body.meta_campaign_ids) ?? [];
    }
    if (body.meta_campaign_sync_enabled !== undefined) {
      insertPayload.meta_campaign_sync_enabled = body.meta_campaign_sync_enabled === true;
    }
    if (body.meta_campaign_paused_ids !== undefined) {
      const linked = normalizeCampaignIds(insertPayload.meta_campaign_ids ?? []);
      insertPayload.meta_campaign_paused_ids = sanitizePausedMetaCampaignIds(
        linked,
        body.meta_campaign_paused_ids,
      );
    }
    if (body.meta_campaign_ids === undefined) {
      const resolved = await resolveMetaCampaignFieldsForNewLeadBatch(supabase, {
        customerId: customer_id,
        branch,
        sourceBatchId: typeof body.source_batch_id === 'string' ? body.source_batch_id : null,
      });
      if (resolved.meta_campaign_ids.length > 0) {
        insertPayload.meta_campaign_ids = resolved.meta_campaign_ids;
        insertPayload.meta_campaign_sync_enabled = resolved.meta_campaign_sync_enabled;
        insertPayload.meta_campaign_paused_ids = resolved.meta_campaign_paused_ids;
      }
    }
  }

  if (isPipelineBatchKind(batch_kind)) {
    insertPayload.distribution_priority = body.distribution_priority === true;
  }

  const { data, error } = await supabase.from('customer_batches').insert(insertPayload).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Optionele batch-target-overrides direct bij aanmaak (vóór backfill).
  const rawBatchTargets = body.batch_targets;
  if (Array.isArray(rawBatchTargets) && rawBatchTargets.length > 0) {
    const targets: BatchTargetInsertInput[] = rawBatchTargets
      .filter((t: unknown) => t && typeof t === 'object' && typeof (t as { label?: unknown }).label === 'string')
      .map((t: BatchTargetInsertInput) => ({
        label: String(t.label).trim(),
        target_type: (t.target_type === 'province' ? 'province' : 'radius') as 'radius' | 'province',
        lat: t.lat ?? null,
        lng: t.lng ?? null,
        radius_km: t.radius_km ?? null,
        provinces: Array.isArray(t.provinces) ? t.provinces : null,
        country: t.country ?? null,
      }))
      .filter(t => t.label.length > 0);
    if (targets.length > 0) {
      const ins = await insertBatchTargets(supabase, data.id, customer_id, targets);
      if (!ins.ok) {
        return NextResponse.json({ error: `Batch aangemaakt maar targets mislukt: ${ins.error}` }, { status: 500 });
      }
    }
  }

  // Targeted backfill: only if starts_at is NULL or in the past
  const startsInFuture = startsAtValue && new Date(startsAtValue) > new Date();
  if (lookback > 0 && !startsInFuture && batchIsPaid && isPipelineBatchKind(batch_kind)) {
    try { backfillBatch(data.id, lookback); } catch { /* non-blocking */ }
  }

  // Admin notification email + invoice if paid with pricing
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
    billing_country: (custRow?.country as string | null | undefined) ?? 'NL',
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
        ...(!batchIsPaid ? { email_context: 'new_batch_order' as const, send_payment_email: sendPaymentEmail } : {}),
      });
    } catch (e) {
      console.error('[admin/batches] invoice creation failed:', e);
    }
  }

  if (isPipelineBatchKind(batch_kind)) {
    reconcileBatchMetaCampaigns(supabase, data.id, 'admin').catch(e =>
      console.error('[admin/batches POST] meta reconcile:', e),
    );
  }

  return NextResponse.json(data, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const body = await request.json();
  const { id, trigger_backfill, compensation, save_branch_meta_default, ...updates } = body;

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

  if (updates.meta_campaign_ids !== undefined) {
    updates.meta_campaign_ids = sanitizeMetaCampaignIdsInput(updates.meta_campaign_ids) ?? [];
  }
  if (updates.meta_campaign_paused_ids !== undefined) {
    const linked =
      updates.meta_campaign_ids !== undefined
        ? (updates.meta_campaign_ids as string[])
        : normalizeCampaignIds(existing.meta_campaign_ids);
    updates.meta_campaign_paused_ids = sanitizePausedMetaCampaignIds(
      linked,
      updates.meta_campaign_paused_ids,
    );
  }
  if (updates.meta_campaign_sync_enabled !== undefined) {
    updates.meta_campaign_sync_enabled = updates.meta_campaign_sync_enabled === true;
  }

  const oldLinkedMetaIds = normalizeCampaignIds(existing.meta_campaign_ids);
  const newLinkedMetaIds =
    updates.meta_campaign_ids !== undefined
      ? normalizeCampaignIds(updates.meta_campaign_ids)
      : oldLinkedMetaIds;
  const removedMetaCampaignIds = oldLinkedMetaIds.filter(id => !newLinkedMetaIds.includes(id));

  if (admin.role === 'accountmanager') {
    const { data: myCust } = await supabase.from('customers').select('id').or(amCustomerAccessOrFilter(admin.id)).eq('id', existing.customer_id).single();
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

  if (isNicheExisting && body.lead_branch_slug !== undefined) {
    const slug = typeof body.lead_branch_slug === 'string' ? body.lead_branch_slug.trim() : '';
    const branchCheck = await validateLeadBranchSlug(supabase, slug);
    if (!branchCheck.ok) {
      return NextResponse.json({ error: branchCheck.error }, { status: 400 });
    }
    updates.lead_branch_slug = slug;
    await ensureCustomerHasBranch(supabase, existing.customer_id, slug);
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
    const paidForLifecycle =
      updates.is_paid !== undefined ? updates.is_paid === true : existing.is_paid === true;

    const isCappedExisting = isCappedDeliveryModel(
      (existing as { delivery_model?: string }).delivery_model,
      (existing as { batch_kind?: string }).batch_kind,
    );

    if (!updates.status && isCappedExisting) {
      if (
        updates.leads_delivered >= batchSize &&
        (existing.status === 'active' || existing.status === 'paused')
      ) {
        updates.status = 'completed';
        updates.completed_at = new Date().toISOString();
      } else if (updates.leads_delivered < batchSize && existing.status === 'completed') {
        updates.status = paidForLifecycle ? 'active' : 'pending_payment';
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
    'meta_campaign_ids', 'meta_campaign_paused_ids', 'meta_campaign_sync_enabled',
    'lead_branch_slug', 'distribution_priority',
  ];
  const effectiveBatchKind =
    updates.batch_kind !== undefined
      ? String(updates.batch_kind)
      : String((existing as { batch_kind?: string }).batch_kind || 'leads');
  if (updates.distribution_priority !== undefined) {
    if (!isPipelineBatchKind(effectiveBatchKind)) {
      delete updates.distribution_priority;
    } else {
      updates.distribution_priority = updates.distribution_priority === true;
    }
  }
  const safeUpdates: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in updates) safeUpdates[key] = updates[key];
  }

  const ex = existing as { status: string; is_paid: boolean | null };
  const nextPaid =
    safeUpdates.is_paid !== undefined ? safeUpdates.is_paid === true : ex.is_paid === true;
  let nextStatus = safeUpdates.status !== undefined ? String(safeUpdates.status) : ex.status;

  if (safeUpdates.is_paid === true && ex.is_paid !== true) {
    if (nextStatus === 'pending_payment') nextStatus = 'active';
  }
  if (safeUpdates.is_paid === false && ex.is_paid === true) {
    if (nextStatus === 'active' || nextStatus === 'paused') nextStatus = 'pending_payment';
  }
  if (nextStatus === 'paused' && !nextPaid) {
    return NextResponse.json(
      { error: 'Pauzeren is alleen mogelijk voor betaalde batches.' },
      { status: 400 },
    );
  }
  if (nextStatus === 'active' && !nextPaid) {
    nextStatus = 'pending_payment';
  }
  safeUpdates.status = nextStatus;

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

  // Auditlog voor handmatige compensatie / vergroting van de batchgrootte.
  const prevSize = Number(existing.batch_size ?? 0);
  const newSize = Number((data as { batch_size?: number }).batch_size ?? prevSize);
  const sizeGrew = newSize > prevSize;
  if ((compensation && compensation.amount > 0) || sizeGrew) {
    const compAmount = compensation?.amount ?? (sizeGrew ? newSize - prevSize : 0);
    logAudit({
      adminId: admin.id,
      adminName: (admin as { name?: string | null }).name ?? null,
      action: 'update_batch',
      entityType: 'customer_batch',
      entityId: id,
      details: {
        reason: 'compensatie',
        customer_id: existing.customer_id,
        amount: compAmount,
        note: compensation?.reason ?? null,
        batch_size_before: prevSize,
        batch_size_after: newSize,
        status_before: existing.status,
        status_after: (data as { status?: string }).status ?? null,
        reopened: existing.status === 'completed' && (data as { status?: string }).status === 'active',
      },
    }).catch(() => {});
  }

  const batchKindAfterUpdate = String(
    (data as { batch_kind?: string }).batch_kind ?? effectiveBatchKind,
  );

  // Trigger milestone notifications when leads_delivered changes
  if (updates.leads_delivered !== undefined && updates.leads_delivered !== existing.leads_delivered) {
    const batchSize = updates.batch_size ?? existing.batch_size;
    if (isPipelineBatchKind(batchKindAfterUpdate)) {
      checkBatchMilestones(supabase, id, updates.leads_delivered, batchSize).catch(() => {});
    }
  }

  // When batch_size grew and backfill requested, fill the extra slots
  const batchGrew = trigger_backfill && updates.batch_size && updates.batch_size > existing.batch_size;
  if (batchGrew && isPipelineBatchKind(batchKindAfterUpdate) && data.is_paid === true) {
    const lookback = (data as { lookback_days?: number | null }).lookback_days ?? existing.lookback_days ?? 3;
    try { backfillBatch(id, Math.max(lookback, 0)); } catch { /* non-blocking */ }
  }

  // Lookback gewijzigd → met terugwerkende kracht opnieuw backfillen (alleen extra
  // leads in het verlengde venster; bestaande toewijzingen blijven staan).
  const prevLookback = existing.lookback_days ?? 3;
  const nextLookback =
    safeUpdates.lookback_days !== undefined ? Number(safeUpdates.lookback_days) : prevLookback;
  const lookbackChanged =
    safeUpdates.lookback_days !== undefined && nextLookback !== prevLookback;
  if (
    lookbackChanged &&
    isPipelineBatchKind(batchKindAfterUpdate) &&
    data.is_paid === true &&
    data.status === 'active' &&
    nextLookback > 0 &&
    !batchGrew
  ) {
    try { backfillBatch(id, nextLookback); } catch { /* non-blocking */ }
    try { distributeUnassignedLeads(); } catch { /* non-blocking */ }
  }

  // When admin manually marks batch as paid, update any open invoice
  if (updates.is_paid === true && existing.is_paid === false) {
    markInvoicePaid(id, 'admin-manual').catch(e => console.error('[admin/batches] markInvoicePaid failed:', e));
  }

  const liveAfter = data.status === 'active' && data.is_paid === true;
  const wasLive = existing.status === 'active' && existing.is_paid === true;
  if (liveAfter && !wasLive && !batchGrew) {
    try { distributeUnassignedLeads(); } catch { /* non-blocking */ }
  }

  reconcileBatchMetaCampaigns(supabase, id, 'admin', {
    forcePauseCampaignIds: removedMetaCampaignIds,
  }).catch(e => console.error('[admin/batches PUT] meta reconcile:', e));

  if (save_branch_meta_default !== undefined && isMetaCampaignSyncBatchKind(batchKindAfterUpdate)) {
    try {
      const defaultsBranch = metaDefaultsBranchForBatch({
        branch: String(data.branch),
        batch_kind: batchKindAfterUpdate,
        lead_branch_slug: (data as { lead_branch_slug?: string | null }).lead_branch_slug,
      });

      if (save_branch_meta_default === true) {
        const idsForDefault =
          safeUpdates.meta_campaign_ids !== undefined
            ? normalizeCampaignIds(safeUpdates.meta_campaign_ids)
            : normalizeCampaignIds(existing.meta_campaign_ids);
        const pausedForDefault =
          safeUpdates.meta_campaign_paused_ids !== undefined
            ? sanitizePausedMetaCampaignIds(idsForDefault, safeUpdates.meta_campaign_paused_ids)
            : sanitizePausedMetaCampaignIds(idsForDefault, existing.meta_campaign_paused_ids);
        const syncForDefault =
          safeUpdates.meta_campaign_sync_enabled !== undefined
            ? safeUpdates.meta_campaign_sync_enabled === true
            : existing.meta_campaign_sync_enabled !== false;
        await upsertCustomerBranchMetaDefaults(supabase, {
          customerId: existing.customer_id,
          branch: defaultsBranch,
          meta_campaign_ids: idsForDefault,
          meta_campaign_paused_ids: pausedForDefault,
          meta_campaign_sync_enabled: syncForDefault,
          updatedBy: admin.id,
        });
      } else if (save_branch_meta_default === false) {
        // Standaard expliciet uitgezet → verwijder de bestaande default zodat
        // nieuwe batches niet meer automatisch deze meta-koppeling erven.
        await supabase
          .from('customer_branch_meta_defaults')
          .delete()
          .eq('customer_id', existing.customer_id)
          .eq('branch', defaultsBranch);
      }
    } catch (e) {
      console.error('[admin/batches PUT] branch meta defaults:', e);
    }
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
      const { data: myCust } = await supabase.from('customers').select('id').or(amCustomerAccessOrFilter(admin.id)).eq('id', batch.customer_id).single();
      if (!myCust) return NextResponse.json({ error: 'Geen toegang tot deze batch' }, { status: 403 });
    }
  }

  const { error } = await supabase.from('customer_batches').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
