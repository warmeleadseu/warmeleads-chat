import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import * as XLSX from 'xlsx';

const COLUMN_HEADERS = [
  'Naam',
  'E-mail',
  'Telefoon',
  'Postcode',
  'Huisnummer',
  'Plaats',
  'Provincie',
  'Status',
  'Branche',
  'Datum',
  'Notities',
];

const PAGE_SIZE = 1000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function paginateQuery<T>(query: any): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  while (true) {
    const { data } = await query.range(offset, offset + PAGE_SIZE - 1);
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < PAGE_SIZE) break;
    offset += data.length;
  }
  return all;
}

async function getCustomerLeadData(
  supabase: ReturnType<typeof createServerClient>,
  customerId: string,
  leadSource: 'all' | 'fresh' | 'bulk' = 'all',
): Promise<{ ids: string[]; assignedAtMap: Record<string, string> }> {
  const ids = new Set<string>();
  const assignedAtMap: Record<string, string> = {};

  if (leadSource !== 'bulk') {
    const directLeads = await paginateQuery<{ id: string }>(
      supabase.from('leads').select('id').eq('customer_id', customerId),
    );
    directLeads.forEach(l => ids.add(l.id));
  }

  if (leadSource === 'bulk') {
    const bulkLeads = await paginateQuery<{ lead_id: string; assigned_at: string }>(
      supabase.from('lead_assignments').select('lead_id, assigned_at').eq('customer_id', customerId).eq('source', 'bulk_export'),
    );
    bulkLeads.forEach(a => {
      ids.add(a.lead_id);
      assignedAtMap[a.lead_id] = a.assigned_at;
    });
  } else {
    let assignQuery = supabase
      .from('lead_assignments')
      .select('lead_id, assigned_at')
      .eq('customer_id', customerId);
    if (leadSource === 'fresh') assignQuery = assignQuery.neq('source', 'bulk_export');
    const assignedLeads = await paginateQuery<{ lead_id: string; assigned_at: string }>(assignQuery);
    assignedLeads.forEach(a => {
      ids.add(a.lead_id);
      assignedAtMap[a.lead_id] = a.assigned_at;
    });
  }

  return { ids: Array.from(ids), assignedAtMap };
}

function formatDate(value: string | null): string {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('nl-NL');
  } catch {
    return value;
  }
}

function leadsToRows(leads: Record<string, unknown>[], assignedAtMap: Record<string, string>) {
  return leads.map(l => [
    l.naam_klant || '',
    l.email || '',
    l.telefoonnummer || '',
    l.postcode || '',
    l.huisnummer || '',
    l.plaatsnaam || '',
    l.provincie || '',
    l.status || '',
    l.branch || '',
    formatDate(assignedAtMap[l.id as string] || l.wervingsdatum as string | null),
    l.notities || '',
  ]);
}

export async function GET(request: NextRequest) {
  const customer = await verifyCustomer(request);
  if (!customer) return portalUnauthorized();

  const supabase = createServerClient();
  const url = request.nextUrl;

  const format = url.searchParams.get('format') || 'csv';
  const status = url.searchParams.get('status');
  const branch = url.searchParams.get('branch');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const leadSource = (url.searchParams.get('lead_source') || 'all') as 'all' | 'fresh' | 'bulk';

  const { ids: leadIds, assignedAtMap } = await getCustomerLeadData(supabase, customer.id, leadSource);
  if (leadIds.length === 0) {
    return format === 'xlsx'
      ? buildXlsx([], {})
      : buildCsv([], {});
  }

  let query = supabase
    .from('leads')
    .select('*')
    .in('id', leadIds)
    .order('wervingsdatum', { ascending: false });

  if (status && status !== 'all') query = query.eq('status', status);
  if (branch && branch !== 'all') query = query.eq('branch', branch);
  if (from) query = query.gte('wervingsdatum', from);
  if (to) query = query.lte('wervingsdatum', to);

  const leads = await paginateQuery<Record<string, unknown>>(query);

  return format === 'xlsx' ? buildXlsx(leads, assignedAtMap) : buildCsv(leads, assignedAtMap);
}

function buildCsv(leads: Record<string, unknown>[], assignedAtMap: Record<string, string>): NextResponse {
  const BOM = '\uFEFF';
  const rows = leadsToRows(leads, assignedAtMap);
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

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="leads-export.csv"',
    },
  });
}

function buildXlsx(leads: Record<string, unknown>[], assignedAtMap: Record<string, string>): NextResponse {
  const rows = leadsToRows(leads, assignedAtMap);
  const sheetData = [COLUMN_HEADERS, ...rows];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  const colWidths = COLUMN_HEADERS.map((h, i) => {
    const maxLen = Math.max(h.length, ...rows.map(r => String(r[i]).length));
    return { wch: Math.min(maxLen + 2, 40) };
  });
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, 'Leads');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="leads-export.xlsx"',
    },
  });
}
