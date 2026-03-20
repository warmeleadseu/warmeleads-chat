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

async function getCustomerLeadIds(
  supabase: ReturnType<typeof createServerClient>,
  customerId: string,
): Promise<string[]> {
  const { data: directLeads } = await supabase
    .from('leads')
    .select('id')
    .eq('customer_id', customerId);

  const { data: assignedLeads } = await supabase
    .from('lead_assignments')
    .select('lead_id')
    .eq('customer_id', customerId);

  const ids = new Set<string>();
  (directLeads || []).forEach(l => ids.add(l.id));
  (assignedLeads || []).forEach(a => ids.add(a.lead_id));
  return Array.from(ids);
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
    formatDate(l.wervingsdatum as string | null),
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

  const leadIds = await getCustomerLeadIds(supabase, customer.id);
  if (leadIds.length === 0) {
    return format === 'xlsx'
      ? buildXlsx([])
      : buildCsv([]);
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

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: 'Leads ophalen mislukt' }, { status: 500 });
  }

  const leads = (data || []) as Record<string, unknown>[];

  return format === 'xlsx' ? buildXlsx(leads) : buildCsv(leads);
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
