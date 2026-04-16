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
const IN_CHUNK = 500;

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

interface ExportAssignmentMeta {
  assigned_at: string;
  status: string | null;
  notities: string | null;
}

async function getCustomerLeadData(
  supabase: ReturnType<typeof createServerClient>,
  customerId: string,
  leadSource: 'all' | 'fresh' | 'bulk' = 'all',
  demoMode = false,
): Promise<{ ids: string[]; metaMap: Record<string, ExportAssignmentMeta> }> {
  const ids = new Set<string>();
  const metaMap: Record<string, ExportAssignmentMeta> = {};
  const selectFields = 'lead_id, assigned_at, status, notities';

  if (demoMode) {
    const demoLeads = await paginateQuery<{ lead_id: string; assigned_at: string; status: string | null; notities: string | null }>(
      supabase.from('lead_assignments').select(selectFields).eq('customer_id', customerId).eq('source', 'demo').order('assigned_at', { ascending: false }),
    );
    demoLeads.forEach(a => {
      ids.add(a.lead_id);
      if (!metaMap[a.lead_id]) {
        metaMap[a.lead_id] = { assigned_at: a.assigned_at, status: a.status, notities: a.notities };
      }
    });
    return { ids: Array.from(ids), metaMap };
  }

  if (leadSource !== 'bulk') {
    const directLeads = await paginateQuery<{ id: string }>(
      supabase.from('leads').select('id').eq('customer_id', customerId),
    );
    directLeads.forEach(l => ids.add(l.id));
  }

  if (leadSource === 'bulk') {
    const bulkLeads = await paginateQuery<{ lead_id: string; assigned_at: string; status: string | null; notities: string | null }>(
      supabase.from('lead_assignments').select(selectFields).eq('customer_id', customerId).eq('source', 'bulk_export').order('assigned_at', { ascending: false }),
    );
    bulkLeads.forEach(a => {
      ids.add(a.lead_id);
      if (!metaMap[a.lead_id]) {
        metaMap[a.lead_id] = { assigned_at: a.assigned_at, status: a.status, notities: a.notities };
      }
    });
  } else {
    let assignQuery = supabase
      .from('lead_assignments')
      .select(selectFields)
      .eq('customer_id', customerId)
      .neq('source', 'demo')
      .order('assigned_at', { ascending: false });
    if (leadSource === 'fresh') assignQuery = assignQuery.neq('source', 'bulk_export');
    const assignedLeads = await paginateQuery<{ lead_id: string; assigned_at: string; status: string | null; notities: string | null }>(assignQuery);
    assignedLeads.forEach(a => {
      ids.add(a.lead_id);
      if (!metaMap[a.lead_id]) {
        metaMap[a.lead_id] = { assigned_at: a.assigned_at, status: a.status, notities: a.notities };
      }
    });
  }

  return { ids: Array.from(ids), metaMap };
}

function formatDate(value: string | null): string {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('nl-NL');
  } catch {
    return value;
  }
}

function leadsToRows(leads: Record<string, unknown>[]) {
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
    formatDate((l._received_at as string | null) || (l.wervingsdatum as string | null)),
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
  const search = url.searchParams.get('search')?.trim().toLowerCase() || '';

  const { data: custData } = await supabase
    .from('customers')
    .select('demo_mode')
    .eq('id', customer.id)
    .single();
  const demoMode = custData?.demo_mode ?? false;

  const { ids: leadIds, metaMap } = await getCustomerLeadData(supabase, customer.id, leadSource, demoMode);
  if (leadIds.length === 0) {
    return format === 'xlsx' ? buildXlsx([]) : buildCsv([]);
  }

  const rawLeads: Record<string, unknown>[] = [];
  for (let i = 0; i < leadIds.length; i += IN_CHUNK) {
    const chunk = leadIds.slice(i, i + IN_CHUNK);
    let q = supabase.from('leads').select('*').in('id', chunk);
    if (branch && branch !== 'all') q = q.eq('branch', branch);
    if (from) q = q.gte('wervingsdatum', from);
    if (to) q = q.lte('wervingsdatum', to);
    const batch = await paginateQuery<Record<string, unknown>>(q);
    rawLeads.push(...batch);
  }

  const leads: Record<string, unknown>[] = rawLeads.map(l => {
    const meta = metaMap[l.id as string];
    return {
      ...l,
      status: meta?.status ?? l.status ?? 'nieuw',
      notities: meta?.notities ?? l.notities ?? '',
      _received_at: meta?.assigned_at || null,
    };
  });

  let filtered = status && status !== 'all'
    ? leads.filter(l => l.status === status)
    : leads;

  if (search) {
    filtered = filtered.filter(l => {
      const hay = [l.naam_klant, l.email, l.telefoonnummer, l.postcode, l.plaatsnaam]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(search);
    });
  }

  filtered.sort((a, b) => {
    const da = (a.wervingsdatum as string) ?? '';
    const db = (b.wervingsdatum as string) ?? '';
    return db < da ? -1 : db > da ? 1 : 0;
  });

  return format === 'xlsx' ? buildXlsx(filtered) : buildCsv(filtered);
}

function buildCsv(leads: Record<string, unknown>[]): NextResponse {
  const BOM = '\uFEFF';
  const rows = leadsToRows(leads);
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

function buildXlsx(leads: Record<string, unknown>[]): NextResponse {
  const rows = leadsToRows(leads);
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
