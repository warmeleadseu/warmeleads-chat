import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized, forbidden } from '@/lib/adminAuth';
import { adminCanAccessCustomer } from '@/lib/permissions';
import { buildLeadExportTable } from '@/lib/leadExportTable';
import { logAudit } from '@/lib/audit';

/**
 * POST /api/admin/assignments/export
 *
 * Exporteert leads die aan een specifieke klant zijn gekoppeld (geselecteerd
 * of gefilterd) als Excel/CSV — zonder de toewijzing te wijzigen.
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

  const customerId = typeof body.customer_id === 'string' ? body.customer_id.trim() : '';
  const format = body.format === 'csv' ? 'csv' : 'xlsx';
  const allFiltered = body.all_filtered === true;
  const filters = (body.filters && typeof body.filters === 'object'
    ? body.filters as Record<string, string>
    : {}) as Record<string, string>;

  if (!customerId) {
    return NextResponse.json({ error: 'customer_id is verplicht' }, { status: 400 });
  }
  if (!(await adminCanAccessCustomer(admin, customerId))) return forbidden();

  const supabase = createServerClient();

  const { data: customer } = await supabase
    .from('customers')
    .select('id, name')
    .eq('id', customerId)
    .maybeSingle();
  if (!customer) {
    return NextResponse.json({ error: 'Klant niet gevonden' }, { status: 404 });
  }

  let assignmentLeadIds: string[] = [];
  let statusByLead = new Map<string, string>();
  let notesByLead = new Map<string, string>();
  let assignedAtByLead = new Map<string, string>();

  if (allFiltered) {
    let query = supabase
      .from('lead_assignments')
      .select('lead_id, status, notities, assigned_at, leads!inner(naam_klant, email, branch, postcode, plaatsnaam)')
      .eq('customer_id', customerId);

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
    for (const a of data || []) {
      assignmentLeadIds.push(a.lead_id);
      if (a.status) statusByLead.set(a.lead_id, a.status);
      if (a.notities) notesByLead.set(a.lead_id, a.notities);
      if (a.assigned_at) assignedAtByLead.set(a.lead_id, a.assigned_at);
    }
  } else {
    const leadIds = Array.isArray(body.lead_ids)
      ? body.lead_ids.filter((v): v is string => typeof v === 'string' && v.length > 0)
      : [];
    if (leadIds.length === 0) {
      return NextResponse.json({ error: 'lead_ids of all_filtered is verplicht' }, { status: 400 });
    }
    const { data, error } = await supabase
      .from('lead_assignments')
      .select('lead_id, status, notities, assigned_at')
      .eq('customer_id', customerId)
      .in('lead_id', leadIds);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    for (const a of data || []) {
      assignmentLeadIds.push(a.lead_id);
      if (a.status) statusByLead.set(a.lead_id, a.status);
      if (a.notities) notesByLead.set(a.lead_id, a.notities);
      if (a.assigned_at) assignedAtByLead.set(a.lead_id, a.assigned_at);
    }
  }

  assignmentLeadIds = [...new Set(assignmentLeadIds)];
  if (assignmentLeadIds.length === 0) {
    return NextResponse.json({ error: 'Geen leads om te exporteren' }, { status: 400 });
  }
  if (assignmentLeadIds.length > 20_000) {
    return NextResponse.json({ error: 'Maximaal 20.000 leads per export' }, { status: 400 });
  }

  const leadRows: Record<string, unknown>[] = [];
  const CHUNK = 500;
  for (let i = 0; i < assignmentLeadIds.length; i += CHUNK) {
    const chunk = assignmentLeadIds.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .in('id', chunk);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    for (const row of data || []) {
      leadRows.push({
        ...row,
        status: statusByLead.get(row.id) || row.status || 'nieuw',
        notities: notesByLead.get(row.id) ?? row.notities ?? '',
        customers: { name: customer.name },
        assigned_at: assignedAtByLead.get(row.id) || null,
      });
    }
  }

  // Preserve selection order roughly by assigned_at desc
  leadRows.sort((a, b) => {
    const aa = String(a.assigned_at || '');
    const bb = String(b.assigned_at || '');
    return bb.localeCompare(aa);
  });

  logAudit({
    adminId: admin.id,
    adminName: admin.name,
    action: 'export_customer_leads',
    entityType: 'customer',
    entityId: customerId,
    details: {
      customer_name: customer.name,
      count: leadRows.length,
      format,
      all_filtered: allFiltered,
    },
  });

  const { headers, rows } = buildLeadExportTable(leadRows);
  const stamp = new Date().toISOString().split('T')[0];
  const safeName = customer.name.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40) || 'klant';

  if (format === 'csv') {
    const BOM = '\uFEFF';
    const escape = (cell: string) => {
      const str = String(cell);
      return str.includes(';') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    };
    const lines = [headers.map(escape).join(';'), ...rows.map(row => row.map(escape).join(';'))];
    return new NextResponse(BOM + lines.join('\r\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="leads-${safeName}-${stamp}.csv"`,
      },
    });
  }

  const sheetData = [headers, ...rows];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  ws['!cols'] = headers.map((h, i) => {
    const maxLen = Math.max(h.length, ...rows.map(r => String(r[i] ?? '').length));
    return { wch: Math.min(maxLen + 2, 40) };
  });
  XLSX.utils.book_append_sheet(wb, ws, 'Leads');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="leads-${safeName}-${stamp}.xlsx"`,
    },
  });
}
