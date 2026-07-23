import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { hasPermission, forbidden, PERMISSIONS } from '@/lib/portalPermissions';
import { getHasPaidCustomerBatch, shouldUseDemoPortalExperience } from '@/lib/demoPortalEligibility';
import {
  matchesPostcodeArea,
  parseMaxDistanceKm,
  parsePostcodeArea,
  parseProvinceList,
} from '@/lib/portalLeadGeoFilters';
import {
  applyCustomDistanceOrigin,
  resolveDistanceOrigin,
} from '@/lib/portalDistanceOrigin';
import * as XLSX from 'xlsx';

/* ─── column registry ─── */

interface ExportColumn {
  key: string;
  label: string;
  group: 'basis' | 'adres' | 'lead' | 'branche' | 'meta';
}

const CORE_COLUMNS: ExportColumn[] = [
  { key: 'naam_klant', label: 'Naam', group: 'basis' },
  { key: 'email', label: 'E-mail', group: 'basis' },
  { key: 'telefoonnummer', label: 'Telefoon', group: 'basis' },

  { key: 'postcode', label: 'Postcode', group: 'adres' },
  { key: 'huisnummer', label: 'Huisnummer', group: 'adres' },
  { key: 'plaatsnaam', label: 'Plaats', group: 'adres' },
  { key: 'provincie', label: 'Provincie', group: 'adres' },
  { key: 'land', label: 'Land', group: 'adres' },

  { key: 'branch', label: 'Branche', group: 'lead' },
  { key: 'bron', label: 'Bron', group: 'lead' },
  { key: 'status', label: 'Status', group: 'lead' },
  { key: 'wervingsdatum', label: 'Wervingsdatum', group: 'lead' },
  { key: 'received_at', label: 'Ontvangstdatum', group: 'lead' },
  { key: 'quality_score', label: 'Kwaliteitsscore', group: 'lead' },
  { key: 'phone_valid', label: 'Telefoon geldig', group: 'lead' },

  { key: 'notities', label: 'Notities', group: 'meta' },
  { key: 'distance_km', label: 'Afstand (km)', group: 'meta' },
  { key: 'batch_name', label: 'Batch', group: 'meta' },
];

const DEFAULT_COLUMNS = [
  'naam_klant', 'email', 'telefoonnummer', 'postcode', 'huisnummer',
  'plaatsnaam', 'provincie', 'status', 'branch', 'wervingsdatum', 'notities',
];

/* ─── helpers ─── */

const PAGE_SIZE = 1000;
const IN_CHUNK = 500;
/** Max rows collected for export; exceeding returns 413 to avoid accidental heavy exports. */
const EXPORT_PAGINATE_MAX_ROWS = 15_000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function paginateQuery<T>(query: any, maxRows = EXPORT_PAGINATE_MAX_ROWS): Promise<{ rows: T[]; truncated: boolean }> {
  const all: T[] = [];
  let offset = 0;
  let truncated = false;
  while (all.length < maxRows) {
    const room = maxRows - all.length;
    const take = Math.min(PAGE_SIZE, room);
    const { data } = await query.range(offset, offset + take - 1);
    if (!data?.length) break;
    all.push(...(data as T[]));
    if (data.length < take) break;
    offset += data.length;
    if (all.length >= maxRows) {
      truncated = true;
      break;
    }
  }
  return { rows: all, truncated };
}

interface AssignmentMeta {
  assigned_at: string;
  status: string | null;
  notities: string | null;
  batch_id: string | null;
  distance_km: number | null;
  portal_user_id: string | null;
}

async function getCustomerLeadData(
  supabase: ReturnType<typeof createServerClient>,
  customerId: string,
  leadSource: 'all' | 'fresh' | 'bulk' = 'all',
  demoMode = false,
  agentFilter: { portalUserId: string; viewAll: boolean } | null = null,
): Promise<{ ids: string[]; metaMap: Record<string, AssignmentMeta>; partial: boolean; maxExportRows: number }> {
  const ids = new Set<string>();
  const metaMap: Record<string, AssignmentMeta> = {};
  let partial = false;
  const selectFields = 'lead_id, assigned_at, status, notities, batch_id, distance_km, portal_user_id';

  // Agent-scope: net als bij portal/leads mag een agent (zonder LEADS_VIEW_ALL)
  // alleen leads zien die aan hemzelf of aan niemand zijn toegewezen.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const applyAgentScope = (q: any) => {
    if (agentFilter && !agentFilter.viewAll) {
      return q.or(`portal_user_id.eq.${agentFilter.portalUserId},portal_user_id.is.null`);
    }
    return q;
  };

  type AssignRow = {
    lead_id: string;
    assigned_at: string;
    status: string | null;
    notities: string | null;
    batch_id: string | null;
    distance_km: number | null;
    portal_user_id: string | null;
  };

  const storeMeta = (a: AssignRow) => {
    ids.add(a.lead_id);
    if (!metaMap[a.lead_id]) {
      metaMap[a.lead_id] = {
        assigned_at: a.assigned_at,
        status: a.status,
        notities: a.notities,
        batch_id: a.batch_id,
        distance_km: a.distance_km,
        portal_user_id: a.portal_user_id ?? null,
      };
    }
  };

  if (demoMode) {
    const demoRes = await paginateQuery<AssignRow>(
      applyAgentScope(supabase.from('lead_assignments').select(selectFields).eq('customer_id', customerId).eq('source', 'demo').order('assigned_at', { ascending: false })),
    );
    partial ||= demoRes.truncated;
    demoRes.rows.forEach(storeMeta);
    return { ids: Array.from(ids), metaMap, partial, maxExportRows: EXPORT_PAGINATE_MAX_ROWS };
  }

  // Directe leads (leads.customer_id) worden alleen meegenomen voor owners/managers;
  // een agent krijgt ze via zijn assignment-scope.
  if (leadSource !== 'bulk' && (!agentFilter || agentFilter.viewAll)) {
    const directRes = await paginateQuery<{ id: string }>(
      supabase.from('leads').select('id').eq('customer_id', customerId),
    );
    partial ||= directRes.truncated;
    directRes.rows.forEach(l => ids.add(l.id));
  }

  if (leadSource === 'bulk') {
    const bulkRes = await paginateQuery<AssignRow>(
      applyAgentScope(supabase.from('lead_assignments').select(selectFields).eq('customer_id', customerId).eq('source', 'bulk_export').order('assigned_at', { ascending: false })),
    );
    partial ||= bulkRes.truncated;
    bulkRes.rows.forEach(storeMeta);
  } else {
    let assignQuery = supabase
      .from('lead_assignments')
      .select(selectFields)
      .eq('customer_id', customerId)
      .neq('source', 'demo')
      .order('assigned_at', { ascending: false });
    if (leadSource === 'fresh') assignQuery = assignQuery.neq('source', 'bulk_export');
    assignQuery = applyAgentScope(assignQuery);
    const assignedRes = await paginateQuery<AssignRow>(assignQuery);
    partial ||= assignedRes.truncated;
    assignedRes.rows.forEach(storeMeta);
  }

  return { ids: Array.from(ids), metaMap, partial, maxExportRows: EXPORT_PAGINATE_MAX_ROWS };
}

function fmtDate(value: string | null, dateFormat: string): string {
  if (!value) return '';
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return dateFormat === 'iso' ? `${yyyy}-${mm}-${dd}` : `${dd}-${mm}-${yyyy}`;
  } catch {
    return value;
  }
}

function getCellValue(
  lead: Record<string, unknown>,
  col: string,
  dateFormat: string,
  batchMap: Record<string, string>,
): string {
  if (col === 'wervingsdatum' || col === 'received_at') {
    return fmtDate((lead[col] as string | null) ?? null, dateFormat);
  }
  if (col === 'distance_km') {
    const km = lead.distance_km as number | null;
    return km != null && km > 0 ? km.toFixed(1) : '';
  }
  if (col === 'phone_valid') {
    const v = lead.phone_valid;
    return v === true ? 'Ja' : v === false ? 'Nee' : '';
  }
  if (col === 'quality_score') {
    const s = lead.quality_score as number | null;
    return s != null ? String(s) : '';
  }
  if (col === 'batch_name') {
    const bid = lead._batch_id as string | null;
    return bid ? (batchMap[bid] || '') : '';
  }
  if (col.startsWith('cf_')) {
    const cfKey = col.slice(3);
    const cf = lead.custom_fields as Record<string, string> | null;
    return cf?.[cfKey] ?? '';
  }
  return String(lead[col] ?? '');
}

/* ─── route ─── */

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.LEADS_EXPORT)) return forbidden();

  const { customer } = session;
  const supabase = createServerClient();
  const t0 = Date.now();
  const url = request.nextUrl;

  const format = url.searchParams.get('format') || 'csv';
  const status = url.searchParams.get('status');
  const branch = url.searchParams.get('branch');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const leadSource = (url.searchParams.get('lead_source') || 'all') as 'all' | 'fresh' | 'bulk';
  const searchParam = url.searchParams.get('search')?.trim().toLowerCase() || '';
  const assignedToParam = url.searchParams.get('assigned_to');
  const provinces = parseProvinceList(url.searchParams.get('provincie'));
  const plaatsFilter = url.searchParams.get('plaats')?.trim().toLowerCase() || '';
  const postcodeArea = parsePostcodeArea(url.searchParams.get('postcode_area'));
  const maxDistanceKm = parseMaxDistanceKm(url.searchParams.get('max_distance_km'));
  const distanceOriginPlace = url.searchParams.get('distance_origin_place')?.trim() || '';
  const distanceOriginProvinces = parseProvinceList(url.searchParams.get('distance_origin_province'));
  const separator = url.searchParams.get('separator') || ';';
  const dateFormat = url.searchParams.get('date_format') || 'nl';
  const includeHeaders = url.searchParams.get('include_headers') !== 'false';
  const feedbackFilter = url.searchParams.get('feedback_filter');
  const leadIdsParam = url.searchParams.get('lead_ids');
  const requestedLeadIds = leadIdsParam
    ? leadIdsParam.split(',').map((id) => id.trim()).filter(Boolean)
    : null;

  const columnsParam = url.searchParams.get('columns');
  const selectedColumns = columnsParam
    ? columnsParam.split(',').map(c => c.trim()).filter(Boolean)
    : DEFAULT_COLUMNS;

  const { data: custData } = await supabase
    .from('customers')
    .select('demo_mode, signup_source')
    .eq('id', customer.id)
    .single();
  const hasPaidCustomerBatch = await getHasPaidCustomerBatch(supabase, customer.id);
  const demoMode = shouldUseDemoPortalExperience({
    signup_source: custData?.signup_source,
    demo_mode: custData?.demo_mode,
    hasPaidCustomerBatch,
  });

  // Agent-scope net als bij het lead-overzicht: agents zonder LEADS_VIEW_ALL
  // exporteren alleen hun eigen/niet-toegewezen leads.
  const agentFilter = session.portalUser && !hasPermission(session, PERMISSIONS.LEADS_VIEW_ALL)
    ? { portalUserId: session.portalUser.id, viewAll: false }
    : null;

  const { ids: poolLeadIds, metaMap, partial: exportPartial, maxExportRows } = await getCustomerLeadData(supabase, customer.id, leadSource, demoMode, agentFilter);

  const canFilterAssignee =
    hasPermission(session, PERMISSIONS.LEADS_VIEW_ALL)
    || hasPermission(session, PERMISSIONS.LEADS_ASSIGN);
  let scopedPoolIds = poolLeadIds;
  if (
    !requestedLeadIds
    && assignedToParam
    && assignedToParam !== 'all'
    && canFilterAssignee
  ) {
    if (assignedToParam === 'unassigned') {
      scopedPoolIds = poolLeadIds.filter((id) => !metaMap[id]?.portal_user_id);
    } else {
      scopedPoolIds = poolLeadIds.filter((id) => metaMap[id]?.portal_user_id === assignedToParam);
    }
  }

  const leadIds = requestedLeadIds
    ? requestedLeadIds.filter((id) => poolLeadIds.includes(id))
    : scopedPoolIds;

  if (requestedLeadIds && requestedLeadIds.length > 0 && leadIds.length === 0) {
    return NextResponse.json({ error: 'Geen geldige leads geselecteerd voor export' }, { status: 400 });
  }

  if (requestedLeadIds && requestedLeadIds.length > EXPORT_PAGINATE_MAX_ROWS) {
    return NextResponse.json(
      { error: `Maximaal ${EXPORT_PAGINATE_MAX_ROWS} leads per export` },
      { status: 400 },
    );
  }

  if (!requestedLeadIds && exportPartial) {
    console.info('[portal/export]', { computeMs: Date.now() - t0, rejected: true, reason: 'paginate_cap' });
    return NextResponse.json(
      {
        error: 'Te veel leads voor deze export. Gebruik filters (datum, branche, status) of neem contact op voor een grotere export.',
        partial: true,
        maxExportRows,
      },
      { status: 413 },
    );
  }

  if (leadIds.length === 0) {
    console.info('[portal/export]', { computeMs: Date.now() - t0, rowCount: 0, format });
    if (format === 'vcf') return buildVcf([]);
    if (format === 'xlsx') return buildXlsx([], [], includeHeaders);
    return buildCsv([], [], separator, includeHeaders);
  }

  const batchIds = new Set<string>();
  Object.values(metaMap).forEach(m => { if (m.batch_id) batchIds.add(m.batch_id); });
  const batchMap: Record<string, string> = {};
  if (batchIds.size > 0 && selectedColumns.includes('batch_name')) {
    const bids = Array.from(batchIds);
    for (let i = 0; i < bids.length; i += IN_CHUNK) {
      const chunk = bids.slice(i, i + IN_CHUNK);
      const { data: batchData } = await supabase.from('customer_batches').select('id, batch_name').in('id', chunk);
      (batchData || []).forEach((b: { id: string; batch_name: string }) => { batchMap[b.id] = b.batch_name || `Batch`; });
    }
  }

  const rawLeads: Record<string, unknown>[] = [];
  for (let i = 0; i < leadIds.length; i += IN_CHUNK) {
    const chunk = leadIds.slice(i, i + IN_CHUNK);
    let q = supabase.from('leads').select('*').in('id', chunk);
    if (!requestedLeadIds) {
      if (branch && branch !== 'all') q = q.eq('branch', branch);
      if (from) q = q.gte('wervingsdatum', from);
      if (to) q = q.lte('wervingsdatum', to);
    }
    const batchRes = await paginateQuery<Record<string, unknown>>(q);
    rawLeads.push(...batchRes.rows);
  }

  const leads: Record<string, unknown>[] = rawLeads.map(l => {
    const meta = metaMap[l.id as string];
    return {
      ...l,
      status: meta?.status ?? l.status ?? 'nieuw',
      notities: meta?.notities ?? l.notities ?? '',
      received_at: meta?.assigned_at || null,
      distance_km: meta?.distance_km ?? l.distance_km ?? null,
      _batch_id: meta?.batch_id || null,
    };
  });

  const customDistanceOrigin = await resolveDistanceOrigin({
    place: distanceOriginPlace,
    provinces: distanceOriginProvinces,
  });
  if ((distanceOriginPlace || distanceOriginProvinces.length > 0) && !customDistanceOrigin) {
    return NextResponse.json({
      error: distanceOriginPlace
        ? `Plaats “${distanceOriginPlace}” niet gevonden. Probeer een andere spelling.`
        : 'Geen geldige provincie voor afstandreferentie',
    }, { status: 400 });
  }
  if (customDistanceOrigin) {
    applyCustomDistanceOrigin(leads, customDistanceOrigin);
  }

  let filtered = requestedLeadIds
    ? leads
    : status && status !== 'all'
      ? leads.filter(l => l.status === status)
      : leads;

  if (!requestedLeadIds && searchParam) {
    filtered = filtered.filter(l => {
      const hay = [l.naam_klant, l.email, l.telefoonnummer, l.postcode, l.plaatsnaam]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(searchParam);
    });
  }

  if (!requestedLeadIds && provinces.length > 0) {
    const set = new Set(provinces);
    filtered = filtered.filter((l) => typeof l.provincie === 'string' && set.has(l.provincie));
  }
  if (!requestedLeadIds && plaatsFilter) {
    filtered = filtered.filter((l) =>
      typeof l.plaatsnaam === 'string' && l.plaatsnaam.toLowerCase().includes(plaatsFilter),
    );
  }
  if (!requestedLeadIds && postcodeArea) {
    filtered = filtered.filter((l) => matchesPostcodeArea(l.postcode, postcodeArea));
  }
  if (!requestedLeadIds && maxDistanceKm != null) {
    filtered = filtered.filter((l) => {
      const d = l.distance_km;
      return typeof d === 'number' && d >= 0 && d <= maxDistanceKm;
    });
  }

  if (feedbackFilter === 'unrated') {
    const filteredIds = filtered.map(l => l.id as string);
    const ratedLeadIds = new Set<string>();
    for (let i = 0; i < filteredIds.length; i += IN_CHUNK) {
      const chunk = filteredIds.slice(i, i + IN_CHUNK);
      const { data: reclamations } = await supabase
        .from('lead_reclamations')
        .select('lead_id')
        .eq('customer_id', customer.id)
        .in('lead_id', chunk);
      (reclamations || []).forEach(r => ratedLeadIds.add(r.lead_id));
    }
    filtered = filtered.filter(l => !ratedLeadIds.has(l.id as string));
  }

  filtered.sort((a, b) => {
    const da = (a.wervingsdatum as string) ?? '';
    const db = (b.wervingsdatum as string) ?? '';
    return db < da ? -1 : db > da ? 1 : 0;
  });

  const columnLabels = selectedColumns.map(col => {
    const core = CORE_COLUMNS.find(c => c.key === col);
    if (core) return core.label;
    if (col.startsWith('cf_')) return col.slice(3).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return col;
  });

  const rows = filtered.map(l =>
    selectedColumns.map(col => getCellValue(l, col, dateFormat, batchMap)),
  );

  console.info('[portal/export]', {
    computeMs: Date.now() - t0,
    format,
    rowCount: filtered.length,
    candidateLeads: leadIds.length,
  });

  if (format === 'vcf') return buildVcf(filtered);
  if (format === 'xlsx') return buildXlsx(columnLabels, rows, includeHeaders);
  return buildCsv(columnLabels, rows, separator, includeHeaders);
}

/* ─── output builders ─── */

function buildCsv(
  headers: string[],
  rows: string[][],
  separator: string,
  includeHeaders: boolean,
): NextResponse {
  const BOM = '\uFEFF';
  const sep = separator === ',' ? ',' : ';';
  const needsQuote = (s: string) => s.includes(sep) || s.includes('"') || s.includes('\n');

  const escapeCell = (cell: string) => {
    const str = String(cell);
    return needsQuote(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const lines: string[] = [];
  if (includeHeaders && headers.length > 0) {
    lines.push(headers.map(escapeCell).join(sep));
  }
  rows.forEach(row => lines.push(row.map(escapeCell).join(sep)));

  const csv = BOM + lines.join('\r\n');

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="leads-export.csv"',
    },
  });
}

function buildXlsx(
  headers: string[],
  rows: string[][],
  includeHeaders: boolean,
): NextResponse {
  const sheetData = includeHeaders ? [headers, ...rows] : rows;

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  if (includeHeaders && headers.length > 0) {
    ws['!cols'] = headers.map((h, i) => {
      const maxLen = Math.max(h.length, ...rows.map(r => String(r[i] || '').length));
      return { wch: Math.min(maxLen + 2, 40) };
    });
  }

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

function vcfEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function buildVcf(leads: Record<string, unknown>[]): NextResponse {
  const cards = leads.map(l => {
    const naam = vcfEscape(String(l.naam_klant || ''));
    const parts = String(l.naam_klant || '').split(/\s+/);
    const fn = vcfEscape(parts[0] || '');
    const ln = vcfEscape(parts.slice(1).join(' '));
    const lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${naam}`,
      `N:${ln};${fn};;;`,
    ];
    if (l.telefoonnummer) lines.push(`TEL;TYPE=CELL:${String(l.telefoonnummer).replace(/[^\d+\-() ]/g, '')}`);
    if (l.email) lines.push(`EMAIL:${vcfEscape(String(l.email))}`);
    const hasAddr = l.postcode || l.plaatsnaam || l.provincie || l.huisnummer;
    if (hasAddr) {
      lines.push(`ADR;TYPE=HOME:;;${vcfEscape(String(l.huisnummer || ''))};${vcfEscape(String(l.plaatsnaam || ''))};${vcfEscape(String(l.provincie || ''))};${vcfEscape(String(l.postcode || ''))};${vcfEscape(String(l.land || 'NL'))}`);
    }
    const noteParts = [
      l.branch ? `Branche: ${l.branch}` : '',
      l.status && l.status !== 'nieuw' ? `Status: ${l.status}` : '',
      l.notities ? String(l.notities) : '',
    ].filter(Boolean);
    if (noteParts.length > 0) lines.push(`NOTE:${vcfEscape(noteParts.join(' | '))}`);
    lines.push('END:VCARD');
    return lines.join('\r\n');
  });

  const vcf = cards.join('\r\n');

  return new NextResponse(vcf, {
    status: 200,
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': 'attachment; filename="leads-export.vcf"',
    },
  });
}
