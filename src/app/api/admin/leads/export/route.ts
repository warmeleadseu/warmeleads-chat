import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { logAudit } from '@/lib/audit';
import { isBulkLeadsBatchKind, normalizeBatchKind } from '@/lib/batchKind';
import * as XLSX from 'xlsx';
import { syncBatchDelivered } from '@/lib/batchSync';
import { buildLeadExportTable } from '@/lib/leadExportTable';
import {
  validateExportBranchFilter,
  validatePortalExportBranches,
} from '@/lib/exportBranchValidation';
import { applyAccountManagerScope, applyLeadFilters } from '@/lib/leadFilters';
import { bodyToLeadFilterParams } from '@/lib/leadExportFilters';
import { assignLeadToBatch } from '@/lib/assignLeadToBatch';
import { logLeadActivity } from '@/lib/leadActivities';
import {
  filterQueryRowsByPlaatsRadius,
  resolvePlaatsRadiusOrigin,
} from '@/lib/leadPlaatsRadius';

function buildCsv(leads: Record<string, unknown>[]): NextResponse {
  const BOM = '\uFEFF';
  const { headers, rows } = buildLeadExportTable(leads);
  const escape = (cell: string) => {
    const str = String(cell);
    return str.includes(';') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };
  const lines = [headers.map(escape).join(';'), ...rows.map(row => row.map(escape).join(';'))];
  const csv = BOM + lines.join('\r\n');
  const stamp = new Date().toISOString().split('T')[0];
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="leads-bulk-export-${stamp}.csv"`,
    },
  });
}

function buildXlsx(leads: Record<string, unknown>[]): NextResponse {
  const { headers, rows } = buildLeadExportTable(leads);
  const sheetData = [headers, ...rows];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  ws['!cols'] = headers.map((h, i) => {
    const maxLen = Math.max(h.length, ...rows.map(r => String(r[i] ?? '').length));
    return { wch: Math.min(maxLen + 2, 40) };
  });
  XLSX.utils.book_append_sheet(wb, ws, 'Leads');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const stamp = new Date().toISOString().split('T')[0];
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="leads-bulk-export-${stamp}.xlsx"`,
    },
  });
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Ongeldige JSON' }, { status: 400 });
  }

  const {
    branch, customer_id, exclude_customer_id, assignment,
    status, province, source,
    phone_valid, date_from, date_to, search, bulk_status,
    include_unknown_date,
    target_customer_id, add_to_portal, format,
    max_leads, prioritize_least_exported,
    bulk_batch_id,
  } = body as Record<string, string | boolean | number | undefined>;
  // Bij datum-range exports: standaard ook leads met onbekende wervingsdatum
  // meenemen, zodat (bv. via een import zonder datum-kolom) deze leads niet
  // permanent uit datum-range exports vallen.
  const includeUnknownDate = include_unknown_date !== false && include_unknown_date !== 'false';

  const branchValidation = validateExportBranchFilter(branch);
  if (!branchValidation.ok) {
    return NextResponse.json({ error: branchValidation.error }, { status: 400 });
  }
  const branchFilter = branchValidation.branches;

  const supabase = createServerClient();

  if (add_to_portal && target_customer_id) {
    const custId = String(target_customer_id);
    const { data: targetCustomer, error: custErr } = await supabase
      .from('customers')
      .select('branches')
      .eq('id', custId)
      .single();
    if (custErr || !targetCustomer) {
      return NextResponse.json({ error: 'Doelklant niet gevonden' }, { status: 400 });
    }
    const portalBranchCheck = validatePortalExportBranches(
      branchFilter,
      (targetCustomer.branches as string[] | null) || [],
    );
    if (!portalBranchCheck.ok) {
      return NextResponse.json({ error: portalBranchCheck.error }, { status: 400 });
    }
  }

  let query = supabase
    .from('leads')
    .select('*, customers(id, name)');

  const filterParams = bodyToLeadFilterParams({ ...body, branch: branchFilter.join(',') });

  let plaatsRadius = null;
  try {
    plaatsRadius = await resolvePlaatsRadiusOrigin(filterParams);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Plaats niet gevonden' },
      { status: 400 },
    );
  }

  query = applyLeadFilters(query, filterParams, { plaatsRadius });

  if (admin.role === 'accountmanager') {
    const scoped = await applyAccountManagerScope(supabase, query, admin.id);
    if (!scoped.allowed) return format === 'xlsx' ? buildXlsx([]) : buildCsv([]);
    query = scoped.query;
  }

  const shouldPrioritize = prioritize_least_exported !== false;
  if (shouldPrioritize) {
    query = query.order('bulk_export_count', { ascending: true }).order('wervingsdatum', { ascending: false });
  } else {
    query = query.order('wervingsdatum', { ascending: false });
  }

  /** Veilige bovengrens voor exports zonder expliciete `max_leads`. Voorkomt accidentele full-table-export. */
  const DEFAULT_EXPORT_CAP = 50_000;
  const requestedLimit = max_leads && Number(max_leads) > 0 ? Math.min(Number(max_leads), DEFAULT_EXPORT_CAP) : DEFAULT_EXPORT_CAP;
  const hardLimit = requestedLimit;
  const PAGE_SIZE = 1000;
  const exportedLeads: Record<string, unknown>[] = [];
  let cappedByLimit = false;

  if (plaatsRadius) {
    const { rows, capped, error: scanError } = await filterQueryRowsByPlaatsRadius(
      async (from, to) => {
        const { data, error } = await query.range(from, to);
        return {
          data: (data || null) as Array<{ id: string; lat: number | null; lng: number | null }> | null,
          error,
        };
      },
      plaatsRadius,
      hardLimit,
    );
    if (scanError) {
      console.error('Export radius fetch error:', scanError);
      return NextResponse.json({ error: 'Leads ophalen mislukt' }, { status: 500 });
    }
    exportedLeads.push(...(rows as Record<string, unknown>[]));
    cappedByLimit = capped;
  } else {
    let offset = 0;
    while (exportedLeads.length < hardLimit) {
      const batchSize = Math.min(PAGE_SIZE, hardLimit - exportedLeads.length);
      const { data: batch, error: batchError } = await query.range(offset, offset + batchSize - 1);
      if (batchError) {
        console.error('Export fetch error:', batchError);
        return NextResponse.json({ error: 'Leads ophalen mislukt' }, { status: 500 });
      }
      if (!batch || batch.length === 0) break;
      exportedLeads.push(...(batch as Record<string, unknown>[]));
      if (batch.length < batchSize) break;
      offset += batch.length;
      if (exportedLeads.length >= hardLimit) {
        cappedByLimit = true;
        break;
      }
    }
  }

  if (exportedLeads.length === 0) {
    return NextResponse.json({ error: 'Geen leads gevonden voor deze filters' }, { status: 404 });
  }

  const leadIds = exportedLeads.map(l => l.id as string);

  if (add_to_portal && target_customer_id) {
    const custId = String(target_customer_id);
    let portalBatchId: string | null = null;

    const bulkIdRaw = bulk_batch_id != null && bulk_batch_id !== '' ? String(bulk_batch_id) : null;
    if (bulkIdRaw) {
      const { data: bulkBatch, error: bulkErr } = await supabase
        .from('customer_batches')
        .select('id, customer_id, batch_kind, status, is_paid')
        .eq('id', bulkIdRaw)
        .maybeSingle();

      if (bulkErr || !bulkBatch) {
        return NextResponse.json({ error: 'bulk_batch_id ongeldig of niet gevonden' }, { status: 400 });
      }
      if (bulkBatch.customer_id !== custId) {
        return NextResponse.json({ error: 'Bulk-batch hoort niet bij de geselecteerde klant' }, { status: 400 });
      }
      if (!isBulkLeadsBatchKind(bulkBatch.batch_kind)) {
        return NextResponse.json({ error: 'bulk_batch_id moet een bulk-leads batch zijn' }, { status: 400 });
      }
      if (bulkBatch.status !== 'active') {
        return NextResponse.json({ error: 'Bulk-batch moet actief zijn om leads te koppelen' }, { status: 400 });
      }
      if (!bulkBatch.is_paid) {
        return NextResponse.json({ error: 'Bulk-batch moet betaald zijn voordat leads aan het portaal worden gekoppeld' }, { status: 400 });
      }
      portalBatchId = bulkBatch.id;
    } else {
      const { data: pipelineBatch } = await supabase
        .from('customer_batches')
        .select('id, batch_kind')
        .eq('customer_id', custId)
        .eq('status', 'active')
        .eq('batch_kind', 'leads')
        .neq('is_paid', false)
        .limit(1)
        .maybeSingle();

      if (pipelineBatch && normalizeBatchKind(pipelineBatch.batch_kind) === 'leads') {
        portalBatchId = pipelineBatch.id;
      }
    }

    // Find leads already assigned to this customer within the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const alreadyAssigned = new Set<string>();
    const CHECK_CHUNK = 500;
    for (let i = 0; i < leadIds.length; i += CHECK_CHUNK) {
      const chunk = leadIds.slice(i, i + CHECK_CHUNK);
      const { data: existing } = await supabase
        .from('lead_assignments')
        .select('lead_id')
        .eq('customer_id', custId)
        .in('lead_id', chunk)
        .gte('assigned_at', thirtyDaysAgo);
      (existing || []).forEach(a => alreadyAssigned.add(a.lead_id));
    }

    const { data: targetCustomerFull } = await supabase
      .from('customers')
      .select('id, branches')
      .eq('id', custId)
      .single();

    const newLeadIds = leadIds.filter(id => !alreadyAssigned.has(id));
    for (const leadId of newLeadIds) {
      const leadRow = exportedLeads.find(l => l.id === leadId) as Record<string, unknown> | undefined;
      if (!leadRow || !targetCustomerFull) continue;
      const result = await assignLeadToBatch({
        supabase,
        lead: {
          id: leadId,
          branch: leadRow.branch as string | null,
          lat: leadRow.lat as number | null,
          lng: leadRow.lng as number | null,
          provincie: leadRow.provincie as string | null,
          land: leadRow.land as string | null,
          postcode: leadRow.postcode as string | null,
          naam_klant: leadRow.naam_klant as string | null,
          plaatsnaam: leadRow.plaatsnaam as string | null,
        },
        customer: { id: custId, branches: targetCustomerFull.branches as string[] | null },
        batchId: portalBatchId,
        source: 'bulk_export',
      });
      if (result.ok) {
        await logLeadActivity(supabase, {
          leadId,
          customerId: custId,
          actorType: 'admin',
          actorId: admin.id,
          actorName: admin.name,
          action: 'bulk_export_portal',
          details: { assignment_id: result.assignmentId, batch_id: portalBatchId },
        });
      }
    }

    if (portalBatchId) {
      try {
        await syncBatchDelivered(supabase, portalBatchId);
      } catch (syncErr) {
        console.error('[admin/leads/export] syncBatchDelivered failed', { portalBatchId, syncErr });
      }
    }
  }

  const UPDATE_CHUNK = 500;
  for (let i = 0; i < leadIds.length; i += UPDATE_CHUNK) {
    const chunk = leadIds.slice(i, i + UPDATE_CHUNK);
    await supabase.rpc('increment_bulk_export_count', { lead_ids: chunk });
  }

  const filterSnapshot: Record<string, unknown> = {};
  if (branchFilter.length > 0) filterSnapshot.branch = branchFilter.join(',');
  if (customer_id) filterSnapshot.customer_id = customer_id;
  if (exclude_customer_id) filterSnapshot.exclude_customer_id = exclude_customer_id;
  if (assignment) filterSnapshot.assignment = assignment;
  if (status) filterSnapshot.status = status;
  if (province) filterSnapshot.province = province;
  if (source) filterSnapshot.source = source;
  if (phone_valid !== undefined) filterSnapshot.phone_valid = phone_valid;
  if (date_from) filterSnapshot.date_from = date_from;
  if (date_to) filterSnapshot.date_to = date_to;
  if (date_from || date_to) filterSnapshot.include_unknown_date = includeUnknownDate;
  if (search) filterSnapshot.search = search;
  if (bulk_status) filterSnapshot.bulk_status = bulk_status;
  if (max_leads) filterSnapshot.max_leads = max_leads;
  if (add_to_portal && target_customer_id && bulk_batch_id) {
    filterSnapshot.bulk_batch_id = String(bulk_batch_id);
  }

  let customerName: string | null = null;
  if (target_customer_id) {
    const { data: cust } = await supabase
      .from('customers')
      .select('name')
      .eq('id', String(target_customer_id))
      .single();
    customerName = cust?.name || null;
  }

  await supabase.from('lead_exports').insert({
    admin_id: admin.id,
    admin_name: admin.name,
    customer_id: target_customer_id ? String(target_customer_id) : null,
    customer_name: customerName,
    lead_count: exportedLeads.length,
    added_to_portal: !!add_to_portal && !!target_customer_id,
    format: format === 'xlsx' ? 'xlsx' : 'csv',
    filters: filterSnapshot,
    lead_ids: leadIds,
  });

  logAudit({
    adminId: admin.id,
    adminName: admin.name,
    action: 'export_leads',
    entityType: 'lead',
    details: {
      count: exportedLeads.length,
      format: format === 'xlsx' ? 'xlsx' : 'csv',
      target_customer: customerName,
      added_to_portal: !!add_to_portal && !!target_customer_id,
      capped_by_limit: cappedByLimit,
      hard_limit: hardLimit,
    },
  });

  console.info('[admin/leads/export]', {
    count: exportedLeads.length,
    cappedByLimit,
    hardLimit,
    format: format === 'xlsx' ? 'xlsx' : 'csv',
  });

  return format === 'xlsx' ? buildXlsx(exportedLeads) : buildCsv(exportedLeads);
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('lead_exports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    return NextResponse.json({ error: 'Exports ophalen mislukt' }, { status: 500 });
  }

  return NextResponse.json({ exports: data || [] });
}

export async function DELETE(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const { searchParams } = new URL(request.url);
  const exportId = searchParams.get('id');
  if (!exportId) {
    return NextResponse.json({ error: 'Export ID is verplicht' }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data: exportRecord, error: fetchError } = await supabase
    .from('lead_exports')
    .select('*')
    .eq('id', exportId)
    .single();

  if (fetchError || !exportRecord) {
    return NextResponse.json({ error: 'Export niet gevonden' }, { status: 404 });
  }

  const leadIds: string[] = exportRecord.lead_ids || [];

  if (leadIds.length > 0) {
    const CHUNK = 500;
    for (let i = 0; i < leadIds.length; i += CHUNK) {
      const chunk = leadIds.slice(i, i + CHUNK);
      await supabase.rpc('decrement_bulk_export_count', { lead_ids: chunk });
    }
  }

  if (exportRecord.added_to_portal && exportRecord.customer_id && leadIds.length > 0) {
    const CHUNK = 500;
    for (let i = 0; i < leadIds.length; i += CHUNK) {
      const chunk = leadIds.slice(i, i + CHUNK);
      await supabase
        .from('lead_assignments')
        .delete()
        .in('lead_id', chunk)
        .eq('customer_id', exportRecord.customer_id)
        .eq('source', 'bulk_export');
    }

    // Sync `leads_delivered` na het verwijderen van assignments zodat de
    // progressbar op de bulk-batch terugloopt naar het juiste aantal.
    const undoneBulkBatchId = (exportRecord.filters as { bulk_batch_id?: unknown } | null)?.bulk_batch_id;
    if (typeof undoneBulkBatchId === 'string' && undoneBulkBatchId) {
      try {
        await syncBatchDelivered(supabase, undoneBulkBatchId);
      } catch (syncErr) {
        console.error('[admin/leads/export] syncBatchDelivered (undo) failed', { undoneBulkBatchId, syncErr });
      }
    }
  }

  await supabase.from('lead_exports').delete().eq('id', exportId);

  logAudit({
    adminId: admin.id,
    adminName: admin.name,
    action: 'undo_export',
    entityType: 'lead',
    details: {
      export_id: exportId,
      lead_count: leadIds.length,
      customer: exportRecord.customer_name,
    },
  });

  return NextResponse.json({ success: true, undone_leads: leadIds.length });
}
