import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { logAudit } from '@/lib/audit';
import { isBulkLeadsBatchKind, normalizeBatchKind } from '@/lib/batchKind';
import * as XLSX from 'xlsx';

const COLUMN_HEADERS = [
  'Branche', 'Naam', 'E-mail', 'Telefoon', 'Postcode', 'Huisnr.',
  'Plaats', 'Provincie', 'Datum', 'Status', 'Notities', 'Bron',
  'CPL', 'Kwaliteit', 'Klant',
];

function formatDate(value: string | null): string {
  if (!value) return '';
  try { return new Date(value).toLocaleDateString('nl-NL'); } catch { return value; }
}

function leadToRow(lead: Record<string, unknown>): string[] {
  return [
    String(lead.branch || ''),
    String(lead.naam_klant || ''),
    String(lead.email || ''),
    String(lead.telefoonnummer || ''),
    String(lead.postcode || ''),
    String(lead.huisnummer || ''),
    String(lead.plaatsnaam || ''),
    String(lead.provincie || ''),
    formatDate(lead.wervingsdatum as string | null),
    String(lead.status || ''),
    String(lead.notities || ''),
    String(lead.bron || ''),
    lead.lead_cost ? `€${Number(lead.lead_cost).toFixed(2)}` : '',
    lead.quality_score != null ? String(lead.quality_score) : '',
    String((lead.customers as { name?: string } | null)?.name || ''),
  ];
}

function buildCsv(leads: Record<string, unknown>[]): NextResponse {
  const BOM = '\uFEFF';
  const rows = leads.map(leadToRow);
  const lines = [
    COLUMN_HEADERS.join(';'),
    ...rows.map(row =>
      row.map(cell => {
        const str = String(cell);
        return str.includes(';') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(';'),
    ),
  ];
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
  const rows = leads.map(leadToRow);
  const sheetData = [COLUMN_HEADERS, ...rows];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  ws['!cols'] = COLUMN_HEADERS.map((h, i) => {
    const maxLen = Math.max(h.length, ...rows.map(r => String(r[i]).length));
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
    target_customer_id, add_to_portal, format,
    max_leads, prioritize_least_exported,
    bulk_batch_id,
  } = body as Record<string, string | boolean | number | undefined>;

  const supabase = createServerClient();

  let query = supabase
    .from('leads')
    .select('*, customers(id, name)');

  if (branch) {
    const vals = String(branch).split(',').filter(Boolean);
    if (vals.length === 1) query = query.eq('branch', vals[0]);
    else if (vals.length > 1) query = query.in('branch', vals);
  }
  if (customer_id) {
    const vals = String(customer_id).split(',').filter(Boolean);
    if (vals.length > 0) query = query.overlaps('assigned_customer_ids', vals);
  }
  if (exclude_customer_id) {
    const vals = String(exclude_customer_id).split(',').filter(Boolean);
    if (vals.length > 0) {
      query = query.not('assigned_customer_ids', 'ov', `{${vals.join(',')}}`);
    }
  }
  if (assignment === 'assigned') query = query.eq('is_assigned', true);
  else if (assignment === 'unassigned') query = query.eq('is_assigned', false);
  if (status) {
    const vals = String(status).split(',').filter(Boolean);
    if (vals.length === 1) query = query.eq('status', vals[0]);
    else if (vals.length > 1) query = query.in('status', vals);
  }
  if (province) {
    const vals = String(province).split(',').filter(Boolean);
    if (vals.length === 1) query = query.eq('provincie', vals[0]);
    else if (vals.length > 1) query = query.in('provincie', vals);
  }
  if (source) {
    const vals = String(source).split(',').filter(Boolean);
    if (vals.length === 1) query = query.eq('bron', vals[0]);
    else if (vals.length > 1) query = query.in('bron', vals);
  }
  if (phone_valid === 'false' || phone_valid === false) query = query.eq('phone_valid', false);
  if (phone_valid === 'true' || phone_valid === true) query = query.eq('phone_valid', true);
  if (date_from) query = query.gte('wervingsdatum', String(date_from));
  if (date_to) query = query.lte('wervingsdatum', String(date_to));
  if (search) {
    const s = String(search);
    query = query.or(`naam_klant.ilike.%${s}%,email.ilike.%${s}%,telefoonnummer.ilike.%${s}%,postcode.ilike.%${s}%`);
  }
  if (bulk_status === 'never') query = query.eq('bulk_export_count', 0);
  else if (bulk_status === 'once') query = query.eq('bulk_export_count', 1);
  else if (bulk_status === 'multiple') query = query.gte('bulk_export_count', 2);

  if (admin.role === 'accountmanager') {
    const { data: myCustomers } = await supabase.from('customers').select('id').eq('account_manager_id', admin.id);
    const ids = (myCustomers || []).map((c: { id: string }) => c.id);
    if (ids.length === 0) return buildCsv([]);
    query = query.overlaps('assigned_customer_ids', ids);
  }

  const shouldPrioritize = prioritize_least_exported !== false;
  if (shouldPrioritize) {
    query = query.order('bulk_export_count', { ascending: true }).order('wervingsdatum', { ascending: false });
  } else {
    query = query.order('wervingsdatum', { ascending: false });
  }

  const hardLimit = max_leads && Number(max_leads) > 0 ? Number(max_leads) : Infinity;
  const PAGE_SIZE = 1000;
  const exportedLeads: Record<string, unknown>[] = [];
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

    const newLeadIds = leadIds.filter(id => !alreadyAssigned.has(id));
    const assignments = newLeadIds.map(leadId => ({
      lead_id: leadId,
      customer_id: custId,
      source: 'bulk_export' as const,
      ...(portalBatchId ? { batch_id: portalBatchId } : {}),
    }));

    const CHUNK = 500;
    for (let i = 0; i < assignments.length; i += CHUNK) {
      const chunk = assignments.slice(i, i + CHUNK);
      await supabase.from('lead_assignments').insert(chunk);
    }
  }

  const UPDATE_CHUNK = 500;
  for (let i = 0; i < leadIds.length; i += UPDATE_CHUNK) {
    const chunk = leadIds.slice(i, i + UPDATE_CHUNK);
    await supabase.rpc('increment_bulk_export_count', { lead_ids: chunk });
  }

  const filterSnapshot: Record<string, unknown> = {};
  if (branch) filterSnapshot.branch = branch;
  if (customer_id) filterSnapshot.customer_id = customer_id;
  if (exclude_customer_id) filterSnapshot.exclude_customer_id = exclude_customer_id;
  if (assignment) filterSnapshot.assignment = assignment;
  if (status) filterSnapshot.status = status;
  if (province) filterSnapshot.province = province;
  if (source) filterSnapshot.source = source;
  if (phone_valid !== undefined) filterSnapshot.phone_valid = phone_valid;
  if (date_from) filterSnapshot.date_from = date_from;
  if (date_to) filterSnapshot.date_to = date_to;
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
    },
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
