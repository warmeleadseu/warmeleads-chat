import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized, forbidden } from '@/lib/adminAuth';
import { adminCanAccessCustomer } from '@/lib/permissions';
import { syncBatchDelivered } from '@/lib/batchSync';
import { assignLeadToBatch } from '@/lib/assignLeadToBatch';
import { normalizeBatchKind } from '@/lib/batchKind';
import { logLeadActivity } from '@/lib/leadActivities';
import { logAudit } from '@/lib/audit';

type AssignmentRow = {
  id: string;
  lead_id: string;
  batch_id: string | null;
  status: string | null;
  assigned_at: string | null;
  notities: string | null;
};

type LeadRow = {
  id: string;
  branch: string | null;
  lat: number | null;
  lng: number | null;
  provincie: string | null;
  land: string | null;
  postcode: string | null;
  naam_klant: string | null;
  plaatsnaam: string | null;
};

/**
 * POST /api/admin/assignments/reassign
 *
 * Haalt leads uit het portaal van klant A en koppelt ze aan één of meer
 * andere klanten (B, C, …). Standaard worden ze bij A verwijderd (move).
 * Met `keep_on_source: true` blijven ze ook bij A staan (copy).
 */
export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ongeldige JSON' }, { status: 400 });
  }

  const fromCustomerId = typeof body.from_customer_id === 'string' ? body.from_customer_id.trim() : '';
  const toRaw = Array.isArray(body.to_customer_ids) ? body.to_customer_ids : [];
  const toCustomerIds = [...new Set(
    toRaw.filter((v): v is string => typeof v === 'string' && v.trim().length > 0).map(v => v.trim()),
  )];
  const keepOnSource = body.keep_on_source === true;
  const overrideGuardrails = body.override_guardrails === true;
  const allFiltered = body.all_filtered === true;
  const filters = (body.filters && typeof body.filters === 'object'
    ? body.filters as Record<string, string>
    : {}) as Record<string, string>;

  if (!fromCustomerId) {
    return NextResponse.json({ error: 'from_customer_id is verplicht' }, { status: 400 });
  }
  if (toCustomerIds.length === 0) {
    return NextResponse.json({ error: 'Selecteer minimaal één doelklant' }, { status: 400 });
  }
  if (toCustomerIds.includes(fromCustomerId)) {
    return NextResponse.json({ error: 'Doelklant mag niet gelijk zijn aan de bronklant' }, { status: 400 });
  }

  if (!(await adminCanAccessCustomer(admin, fromCustomerId))) return forbidden();
  for (const id of toCustomerIds) {
    if (!(await adminCanAccessCustomer(admin, id))) return forbidden();
  }

  const supabase = createServerClient();

  const { data: fromCustomer } = await supabase
    .from('customers')
    .select('id, name')
    .eq('id', fromCustomerId)
    .maybeSingle();
  if (!fromCustomer) {
    return NextResponse.json({ error: 'Bronklant niet gevonden' }, { status: 404 });
  }

  const { data: toCustomers, error: toErr } = await supabase
    .from('customers')
    .select('id, name, branches')
    .in('id', toCustomerIds);
  if (toErr || !toCustomers || toCustomers.length !== toCustomerIds.length) {
    return NextResponse.json({ error: 'Eén of meer doelklanten niet gevonden' }, { status: 404 });
  }

  // Resolve source assignments
  let sourceAssignments: AssignmentRow[] = [];
  if (allFiltered) {
    let query = supabase
      .from('lead_assignments')
      .select('id, lead_id, batch_id, status, assigned_at, notities, leads!inner(naam_klant, email, branch, postcode, plaatsnaam)')
      .eq('customer_id', fromCustomerId);

    if (filters.branch) query = query.eq('leads.branch', filters.branch);
    if (filters.batch_id) query = query.eq('batch_id', filters.batch_id);
    if (filters.status) {
      const statuses = filters.status.split(',').map(s => s.trim()).filter(Boolean);
      if (statuses.length === 1) query = query.eq('status', statuses[0]);
      else if (statuses.length > 1) query = query.in('status', statuses);
    }
    if (filters.search) {
      query = query.or(
        `leads.naam_klant.ilike.%${filters.search}%,leads.email.ilike.%${filters.search}%,leads.postcode.ilike.%${filters.search}%,leads.plaatsnaam.ilike.%${filters.search}%`,
        { foreignTable: 'leads' },
      );
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    sourceAssignments = (data || []).map(a => ({
      id: a.id,
      lead_id: a.lead_id,
      batch_id: a.batch_id,
      status: a.status,
      assigned_at: a.assigned_at ?? null,
      notities: a.notities ?? null,
    }));
  } else {
    const leadIds = Array.isArray(body.lead_ids)
      ? body.lead_ids.filter((v): v is string => typeof v === 'string' && v.length > 0)
      : [];
    if (leadIds.length === 0) {
      return NextResponse.json({ error: 'lead_ids of all_filtered is verplicht' }, { status: 400 });
    }
    const { data, error } = await supabase
      .from('lead_assignments')
      .select('id, lead_id, batch_id, status, assigned_at, notities')
      .eq('customer_id', fromCustomerId)
      .in('lead_id', leadIds);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    sourceAssignments = (data || []).map(a => ({
      id: a.id,
      lead_id: a.lead_id,
      batch_id: a.batch_id,
      status: a.status,
      assigned_at: a.assigned_at ?? null,
      notities: a.notities ?? null,
    }));
  }

  // Per lead: oudste bron-assigned_at + status/notities behouden bij verplaatsen
  const sourceMetaByLead = new Map<string, {
    assigned_at: string | null;
    status: string | null;
    notities: string | null;
  }>();
  for (const a of sourceAssignments) {
    const prev = sourceMetaByLead.get(a.lead_id);
    if (!prev) {
      sourceMetaByLead.set(a.lead_id, {
        assigned_at: a.assigned_at,
        status: a.status,
        notities: a.notities,
      });
      continue;
    }
    if (
      a.assigned_at
      && (!prev.assigned_at || a.assigned_at < prev.assigned_at)
    ) {
      sourceMetaByLead.set(a.lead_id, {
        assigned_at: a.assigned_at,
        status: a.status ?? prev.status,
        notities: a.notities ?? prev.notities,
      });
    }
  }

  if (sourceAssignments.length === 0) {
    return NextResponse.json({ error: 'Geen leads gevonden om te verplaatsen' }, { status: 400 });
  }

  const HARD_LIMIT = 5_000;
  if (sourceAssignments.length > HARD_LIMIT) {
    return NextResponse.json({
      error: `Maximaal ${HARD_LIMIT} leads per keer. Verfijn je selectie.`,
    }, { status: 400 });
  }

  const leadIds = [...new Set(sourceAssignments.map(a => a.lead_id))];
  const { data: leadRows } = await supabase
    .from('leads')
    .select('id, branch, lat, lng, provincie, land, postcode, naam_klant, plaatsnaam')
    .in('id', leadIds);
  const leadById = new Map(((leadRows || []) as LeadRow[]).map(l => [l.id, l]));

  // Active paid pipeline batches per target customer → branch
  const batchByCustomerBranch = new Map<string, string>();
  const { data: pipelineBatches } = await supabase
    .from('customer_batches')
    .select('id, customer_id, branch, batch_kind')
    .in('customer_id', toCustomerIds)
    .eq('status', 'active')
    .eq('batch_kind', 'leads')
    .neq('is_paid', false);
  for (const b of pipelineBatches || []) {
    if (normalizeBatchKind(b.batch_kind) !== 'leads') continue;
    const branch = typeof b.branch === 'string' ? b.branch : '';
    if (!branch) continue;
    const key = `${b.customer_id}::${branch}`;
    if (!batchByCustomerBranch.has(key)) batchByCustomerBranch.set(key, b.id);
  }

  let assigned = 0;
  let skippedAlready = 0;
  let blocked = 0;
  const blockedReasons: string[] = [];
  const usedBatchIds = new Set<string>();
  const successfullyMovedLeadIds = new Set<string>();

  for (const leadId of leadIds) {
    const lead = leadById.get(leadId);
    if (!lead) {
      blocked++;
      continue;
    }

    let assignedToAny = false;
    for (const cust of toCustomers) {
      const branch = lead.branch || '';
      const batchId = batchByCustomerBranch.get(`${cust.id}::${branch}`) || null;
      if (batchId) usedBatchIds.add(batchId);

      const sourceMeta = sourceMetaByLead.get(leadId);
      const result = await assignLeadToBatch({
        supabase,
        lead,
        customer: { id: cust.id, branches: cust.branches as string[] | null },
        batchId,
        source: 'bulk_assign',
        skipGuardrails: overrideGuardrails,
        // Behoud portaal-"Datum" (received_at ← assigned_at), niet de verplaatsdag
        assignedAt: sourceMeta?.assigned_at ?? null,
        status: sourceMeta?.status ?? null,
        notities: sourceMeta?.notities ?? null,
      });

      if (result.ok) {
        assigned++;
        assignedToAny = true;
        await logLeadActivity(supabase, {
          leadId,
          customerId: cust.id,
          actorType: 'admin',
          actorId: admin.id,
          actorName: admin.name,
          action: 'reassign',
          details: {
            from_customer_id: fromCustomerId,
            assignment_id: result.assignmentId,
            batch_id: batchId,
            preserved_assigned_at: sourceMeta?.assigned_at ?? null,
          },
        });
      } else if (
        result.code === 'recent_assignment'
        || /30 dagen/i.test(result.reason)
        || /duplicate|unique|already exists/i.test(result.reason)
      ) {
        skippedAlready++;
        assignedToAny = true; // already on target — treat as ok for move
      } else {
        blocked++;
        if (blockedReasons.length < 5) {
          blockedReasons.push(
            `${lead.naam_klant || leadId.slice(0, 8)} → ${cust.name}: ${result.reason}`,
          );
        }
      }
    }

    if (assignedToAny) successfullyMovedLeadIds.add(leadId);
  }

  // Remove from source for successfully moved leads
  let removedFromSource = 0;
  const sourceBatchesToSync = new Set<string>();
  if (!keepOnSource && successfullyMovedLeadIds.size > 0) {
    const toRemove = sourceAssignments.filter(a => successfullyMovedLeadIds.has(a.lead_id));
    const assignmentIds = toRemove.map(a => a.id);
    for (const a of toRemove) {
      if (a.batch_id) sourceBatchesToSync.add(a.batch_id);
    }

    const CHUNK = 100;
    for (let i = 0; i < assignmentIds.length; i += CHUNK) {
      const chunk = assignmentIds.slice(i, i + CHUNK);
      const { error } = await supabase.from('lead_assignments').delete().in('id', chunk);
      if (error) {
        return NextResponse.json({
          error: `Toewijzen gelukt, maar loskoppelen van bron mislukte: ${error.message}`,
          assigned,
          removed_from_source: removedFromSource,
        }, { status: 500 });
      }
      removedFromSource += chunk.length;
    }

    const movedLeadIdList = [...successfullyMovedLeadIds];
    for (let i = 0; i < movedLeadIdList.length; i += CHUNK) {
      const chunk = movedLeadIdList.slice(i, i + CHUNK);
      await supabase
        .from('leads')
        .update({ customer_id: null })
        .eq('customer_id', fromCustomerId)
        .in('id', chunk);
    }

    for (const batchId of sourceBatchesToSync) {
      try {
        await syncBatchDelivered(supabase, batchId);
      } catch (e) {
        console.error('[assignments/reassign] syncBatchDelivered source failed', batchId, e);
      }
    }
  }

  for (const batchId of usedBatchIds) {
    try {
      await syncBatchDelivered(supabase, batchId);
    } catch (e) {
      console.error('[assignments/reassign] syncBatchDelivered target failed', batchId, e);
    }
  }

  logAudit({
    adminId: admin.id,
    adminName: admin.name,
    action: 'reassign_leads',
    entityType: 'lead',
    details: {
      from_customer_id: fromCustomerId,
      from_customer_name: fromCustomer.name,
      to_customer_ids: toCustomerIds,
      to_customer_names: toCustomers.map(c => c.name),
      lead_count: leadIds.length,
      assigned,
      skipped_already: skippedAlready,
      blocked,
      removed_from_source: removedFromSource,
      keep_on_source: keepOnSource,
      override_guardrails: overrideGuardrails,
    },
  });

  return NextResponse.json({
    assigned,
    skipped_already: skippedAlready,
    blocked,
    blocked_reasons: blockedReasons,
    removed_from_source: removedFromSource,
    total_leads: leadIds.length,
    to_customers: toCustomers.map(c => ({ id: c.id, name: c.name })),
    from_customer_name: fromCustomer.name,
  });
}
