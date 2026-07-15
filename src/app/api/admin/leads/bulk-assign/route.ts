import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { logAudit } from '@/lib/audit';
import { normalizeBatchKind } from '@/lib/batchKind';
import { applyAccountManagerScope, applyLeadFilters, type LeadFilterParams } from '@/lib/leadFilters';
import { assignLeadToBatch } from '@/lib/assignLeadToBatch';
import { preflightManualAssignments } from '@/lib/manualAssignmentGuardrails';
import { logLeadActivity } from '@/lib/leadActivities';
import { validateExportBranchFilter } from '@/lib/exportBranchValidation';

/**
 * POST /api/admin/leads/bulk-assign
 *
 * Wijst meerdere leads in één keer toe aan een klant zonder export. Kent
 * twee scopes:
 *   • `selected` — admin levert expliciete `lead_ids` aan (bv. via de
 *     bulk-checkboxen in de leads-CRM).
 *   • `all_filtered` — admin gebruikt de huidige filters; we resolven dat
 *     server-side via dezelfde helper als list/count/export, met optionele
 *     `max_leads`-cap.
 *
 * Gedrag is verder consistent met `bulk_export` (zie
 * `src/app/api/admin/leads/export/route.ts`):
 *   • 30-dagen dedup op bestaande `lead_assignments` voor deze klant
 *   • Automatische koppeling aan een actieve betaalde `leads`-pipeline-batch
 *   • `onLeadAssignedToCustomer` voor Teamleader/Google Sheets sync
 *   • `syncBatchDelivered` zodat de batch-progress meteen klopt
 *   • Audit-log
 */
export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Ongeldige JSON' }, { status: 400 });
  }

  const customerId = typeof body.customer_id === 'string' ? body.customer_id.trim() : '';
  const scope = body.scope === 'selected' || body.scope === 'all_filtered' ? body.scope : null;
  const maxLeadsRaw = body.max_leads;

  if (!customerId) {
    return NextResponse.json({ error: 'customer_id is verplicht' }, { status: 400 });
  }
  if (!scope) {
    return NextResponse.json({ error: 'scope moet "selected" of "all_filtered" zijn' }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data: customer, error: custError } = await supabase
    .from('customers')
    .select('id, name, account_manager_id, branches')
    .eq('id', customerId)
    .maybeSingle();
  if (custError || !customer) {
    return NextResponse.json({ error: 'Klant niet gevonden' }, { status: 404 });
  }
  if (admin.role === 'accountmanager' && customer.account_manager_id !== admin.id) {
    return NextResponse.json({ error: 'Geen toegang tot deze klant' }, { status: 403 });
  }

  // Resolveer doelgroep aan lead-IDs.
  const HARD_LIMIT = 50_000;
  let leadIds: string[] = [];

  if (scope === 'selected') {
    const rawIds = Array.isArray(body.lead_ids) ? body.lead_ids : [];
    leadIds = rawIds
      .filter((v): v is string => typeof v === 'string' && v.length > 0)
      .slice(0, HARD_LIMIT);
    if (leadIds.length === 0) {
      return NextResponse.json({ error: 'lead_ids is leeg' }, { status: 400 });
    }
  } else {
    const branchCheck = validateExportBranchFilter(body.branch);
    if (!branchCheck.ok) {
      return NextResponse.json({ error: branchCheck.error }, { status: 400 });
    }

    const filters: LeadFilterParams = {
      branch: typeof body.branch === 'string' ? body.branch : null,
      customer_id: typeof body.filter_customer_id === 'string' ? body.filter_customer_id : null,
      exclude_customer_id: typeof body.exclude_customer_id === 'string' ? body.exclude_customer_id : null,
      assignment: typeof body.assignment === 'string' ? body.assignment : null,
      status: typeof body.status === 'string' ? body.status : null,
      province: typeof body.province === 'string' ? body.province : null,
      source: typeof body.source === 'string' ? body.source : null,
      phone_valid: typeof body.phone_valid === 'string' || typeof body.phone_valid === 'boolean' ? body.phone_valid as string | boolean : null,
      date_from: typeof body.date_from === 'string' ? body.date_from : null,
      date_to: typeof body.date_to === 'string' ? body.date_to : null,
      include_unknown_date: typeof body.include_unknown_date === 'string' || typeof body.include_unknown_date === 'boolean'
        ? (body.include_unknown_date as string | boolean) : null,
      search: typeof body.search === 'string' ? body.search : null,
      bulk_status: typeof body.bulk_status === 'string' ? body.bulk_status : null,
    };

    const cap = maxLeadsRaw && Number(maxLeadsRaw) > 0
      ? Math.min(Number(maxLeadsRaw), HARD_LIMIT)
      : HARD_LIMIT;

    let query = supabase
      .from('leads')
      .select('id')
      .order('bulk_export_count', { ascending: true })
      .order('wervingsdatum', { ascending: false });
    query = applyLeadFilters(query, filters, { excludePartnerBranchesWhenNoBranchFilter: true });

    if (admin.role === 'accountmanager') {
      const scoped = await applyAccountManagerScope(supabase, query, admin.id);
      if (!scoped.allowed) {
        return NextResponse.json({ assigned: 0, skipped_already: 0, total: 0 });
      }
      query = scoped.query;
    }

    const PAGE_SIZE = 1000;
    let offset = 0;
    while (leadIds.length < cap) {
      const batchSize = Math.min(PAGE_SIZE, cap - leadIds.length);
      const { data: batch, error: fetchErr } = await query.range(offset, offset + batchSize - 1);
      if (fetchErr) {
        console.error('[admin/leads/bulk-assign] fetch error', fetchErr);
        return NextResponse.json({ error: 'Leads ophalen mislukt' }, { status: 500 });
      }
      if (!batch || batch.length === 0) break;
      leadIds.push(...batch.map((r: { id: string }) => r.id));
      if (batch.length < batchSize) break;
      offset += batch.length;
    }
  }

  if (leadIds.length === 0) {
    return NextResponse.json({ assigned: 0, skipped_already: 0, total: 0 });
  }

  const overrideGuardrails = body.override_guardrails === true;

  const { data: leadRows } = await supabase
    .from('leads')
    .select('id, branch, lat, lng, provincie, land, postcode, naam_klant, plaatsnaam')
    .in('id', leadIds.slice(0, HARD_LIMIT));

  let eligibleIds = leadIds;
  let blockedCount = 0;

  if (!overrideGuardrails && leadRows?.length) {
    const preflight = await preflightManualAssignments(
      supabase,
      { id: customer.id, branches: customer.branches as string[] | null },
      leadRows,
    );
    eligibleIds = preflight.allowed;
    blockedCount = preflight.blocked.length;
  }

  if (eligibleIds.length === 0) {
    return NextResponse.json({
      assigned: 0,
      skipped_already: 0,
      blocked_guardrails: blockedCount,
      total: leadIds.length,
    });
  }

  // Detecteer een actieve betaalde leads-pipeline-batch om assignments
  // automatisch te koppelen — analoog aan de bulk-export-flow zonder
  // expliciete `bulk_batch_id`.
  let pipelineBatchId: string | null = null;
  const { data: pipelineBatch } = await supabase
    .from('customer_batches')
    .select('id, batch_kind')
    .eq('customer_id', customerId)
    .eq('status', 'active')
    .eq('batch_kind', 'leads')
    .neq('is_paid', false)
    .limit(1)
    .maybeSingle();
  if (pipelineBatch && normalizeBatchKind(pipelineBatch.batch_kind) === 'leads') {
    pipelineBatchId = pipelineBatch.id;
  }

  // 30-dagen dedup: leads die al recent aan deze klant zijn toegewezen,
  // worden overgeslagen. Identiek aan de export-flow.
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const alreadyAssigned = new Set<string>();
  const CHECK_CHUNK = 500;
  for (let i = 0; i < eligibleIds.length; i += CHECK_CHUNK) {
    const chunk = eligibleIds.slice(i, i + CHECK_CHUNK);
    const { data: existing } = await supabase
      .from('lead_assignments')
      .select('lead_id')
      .eq('customer_id', customerId)
      .in('lead_id', chunk)
      .gte('assigned_at', thirtyDaysAgo);
    (existing || []).forEach((a: { lead_id: string }) => alreadyAssigned.add(a.lead_id));
  }
  const newLeadIds = eligibleIds.filter(id => !alreadyAssigned.has(id));
  const skippedAlready = eligibleIds.length - newLeadIds.length;

  if (newLeadIds.length === 0) {
    return NextResponse.json({
      assigned: 0,
      skipped_already: skippedAlready,
      total: leadIds.length,
      pipeline_batch_id: pipelineBatchId,
    });
  }

  if (newLeadIds.length === 0) {
    return NextResponse.json({
      assigned: 0,
      skipped_already: skippedAlready,
      blocked_guardrails: blockedCount,
      total: leadIds.length,
      pipeline_batch_id: pipelineBatchId,
    });
  }

  const leadById = new Map((leadRows || []).map(l => [l.id, l]));
  let insertedCount = 0;
  const blockedOnAssign: string[] = [];

  for (const leadId of newLeadIds) {
    const leadRow = leadById.get(leadId);
    if (!leadRow) continue;
    const result = await assignLeadToBatch({
      supabase,
      lead: leadRow,
      customer: { id: customer.id, branches: customer.branches as string[] | null },
      batchId: pipelineBatchId,
      source: 'bulk_assign',
      skipGuardrails: overrideGuardrails,
    });
    if (result.ok) {
      insertedCount++;
      await logLeadActivity(supabase, {
        leadId,
        customerId: customer.id,
        actorType: 'admin',
        actorId: admin.id,
        actorName: admin.name,
        action: 'bulk_assign',
        details: { assignment_id: result.assignmentId, batch_id: pipelineBatchId },
      });
    } else {
      blockedOnAssign.push(leadId);
    }
  }

  logAudit({
    adminId: admin.id,
    adminName: admin.name,
    action: 'bulk_assign_leads',
    entityType: 'lead',
    details: {
      customer_id: customerId,
      customer_name: customer.name,
      scope,
      assigned: insertedCount,
      skipped_already: skippedAlready,
      blocked_guardrails: blockedCount + blockedOnAssign.length,
      total: leadIds.length,
      pipeline_batch_id: pipelineBatchId,
      max_leads: maxLeadsRaw && Number(maxLeadsRaw) > 0 ? Number(maxLeadsRaw) : undefined,
    },
  });

  return NextResponse.json({
    assigned: insertedCount,
    skipped_already: skippedAlready,
    blocked_guardrails: blockedCount + blockedOnAssign.length,
    total: leadIds.length,
    pipeline_batch_id: pipelineBatchId,
    customer_name: customer.name,
  });
}
