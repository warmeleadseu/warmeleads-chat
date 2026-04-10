import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { logAudit } from '@/lib/audit';
import * as XLSX from 'xlsx';

const COLUMN_HEADERS = [
  'Branche', 'Naam', 'E-mail', 'Telefoon', 'Postcode', 'Huisnr.',
  'Plaats', 'Provincie', 'Datum', 'Status', 'Notities', 'Bron',
  'CPL', 'Kwaliteit', 'Klant', 'Bulk exports',
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
    String(lead.bulk_export_count ?? 0),
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
    branch, customer_id, status, province, source,
    phone_valid, date_from, date_to, search, bulk_status,
    target_customer_id, add_to_portal, format,
    max_leads, prioritize_least_exported,
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
    if (vals.length === 1) query = query.eq('customer_id', vals[0]);
    else if (vals.length > 1) query = query.in('customer_id', vals);
  }
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
    query = query.in('customer_id', ids);
  }

  const shouldPrioritize = prioritize_least_exported !== false;
  if (shouldPrioritize) {
    query = query.order('bulk_export_count', { ascending: true }).order('wervingsdatum', { ascending: false });
  } else {
    query = query.order('wervingsdatum', { ascending: false });
  }

  if (max_leads && Number(max_leads) > 0) {
    query = query.limit(Number(max_leads));
  }

  const { data: leads, error } = await query;

  if (error) {
    console.error('Export fetch error:', error);
    return NextResponse.json({ error: 'Leads ophalen mislukt' }, { status: 500 });
  }

  const exportedLeads = (leads || []) as Record<string, unknown>[];
  if (exportedLeads.length === 0) {
    return NextResponse.json({ error: 'Geen leads gevonden voor deze filters' }, { status: 404 });
  }

  const leadIds = exportedLeads.map(l => l.id as string);

  if (add_to_portal && target_customer_id) {
    const custId = String(target_customer_id);
    const { data: activeBatch } = await supabase
      .from('customer_batches')
      .select('id')
      .eq('customer_id', custId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    const assignments = leadIds.map(leadId => ({
      lead_id: leadId,
      customer_id: custId,
      ...(activeBatch ? { batch_id: activeBatch.id } : {}),
    }));

    const CHUNK = 500;
    for (let i = 0; i < assignments.length; i += CHUNK) {
      const chunk = assignments.slice(i, i + CHUNK);
      await supabase
        .from('lead_assignments')
        .upsert(chunk, { onConflict: 'lead_id,customer_id' });
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
  if (status) filterSnapshot.status = status;
  if (province) filterSnapshot.province = province;
  if (source) filterSnapshot.source = source;
  if (phone_valid !== undefined) filterSnapshot.phone_valid = phone_valid;
  if (date_from) filterSnapshot.date_from = date_from;
  if (date_to) filterSnapshot.date_to = date_to;
  if (search) filterSnapshot.search = search;
  if (bulk_status) filterSnapshot.bulk_status = bulk_status;
  if (max_leads) filterSnapshot.max_leads = max_leads;

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
