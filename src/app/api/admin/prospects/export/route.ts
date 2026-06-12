import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { logAudit } from '@/lib/audit';
import { applyAmScope, type AdminContext } from '@/lib/prospects';
import { buildProspectFilterApplicator } from '@/lib/prospectsListFilters';
import {
  PROSPECT_EXPORT_COLUMNS,
  buildProspectsCsv,
  buildProspectsXlsx,
  prospectToExportRow,
  prospectsExportFilenameBase,
} from '@/lib/prospectsExport';

type ExportFormat = 'csv' | 'xlsx';

const PAGE_SIZE = 1000;
const DEFAULT_HARD_LIMIT = 50_000;

function parseFormat(value: unknown): ExportFormat {
  return value === 'xlsx' ? 'xlsx' : 'csv';
}

function parseProspectIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(v => (typeof v === 'string' ? v.trim() : ''))
    .filter(v => v.length > 0);
}

async function fetchAccountManagerNames(
  supabase: ReturnType<typeof createServerClient>,
  ids: string[],
): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const unique = Array.from(new Set(ids));
  const { data, error } = await supabase
    .from('admin_users')
    .select('id, name, email')
    .in('id', unique);
  if (error) {
    console.warn('[admin/prospects/export] admin-users lookup failed:', error.message);
    return {};
  }
  const out: Record<string, string> = {};
  for (const row of data || []) {
    const id = String((row as { id?: unknown }).id ?? '');
    if (!id) continue;
    const name = String((row as { name?: unknown }).name ?? '').trim();
    const email = String((row as { email?: unknown }).email ?? '').trim();
    out[id] = name || email || id;
  }
  return out;
}

async function fetchBranchNames(
  supabase: ReturnType<typeof createServerClient>,
): Promise<Record<string, string>> {
  const { data, error } = await supabase.from('branches').select('slug, name');
  if (error) {
    console.warn('[admin/prospects/export] branches lookup failed:', error.message);
    return {};
  }
  const out: Record<string, string> = {};
  for (const row of data || []) {
    const slug = String((row as { slug?: unknown }).slug ?? '').trim();
    const name = String((row as { name?: unknown }).name ?? '').trim();
    if (slug) out[slug] = name || slug;
  }
  return out;
}

async function fetchProspectsByIds(
  supabase: ReturnType<typeof createServerClient>,
  admin: AdminContext,
  ids: string[],
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  const CHUNK = 200;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    let query = supabase.from('prospects').select('*').in('id', chunk);
    query = applyAmScope(query, admin);
    const { data, error } = await query;
    if (error) {
      throw new Error(`Prospects ophalen mislukt: ${error.message}`);
    }
    out.push(...((data as Record<string, unknown>[] | null) ?? []));
  }
  return out;
}

async function fetchProspectsByFilters(
  supabase: ReturnType<typeof createServerClient>,
  admin: AdminContext,
  filters: Parameters<typeof buildProspectFilterApplicator>[2],
  hardLimit: number,
): Promise<{ rows: Record<string, unknown>[]; cappedByLimit: boolean }> {
  const apply = await buildProspectFilterApplicator(supabase, admin, filters);
  const out: Record<string, unknown>[] = [];
  let offset = 0;
  let cappedByLimit = false;

  while (out.length < hardLimit) {
    const batchSize = Math.min(PAGE_SIZE, hardLimit - out.length);
    let query = supabase.from('prospects').select('*');
    query = apply(query);
    query = query.order('updated_at', { ascending: false, nullsFirst: false });
    query = query.range(offset, offset + batchSize - 1);

    const { data, error } = await query;
    if (error) {
      throw new Error(`Prospects ophalen mislukt: ${error.message}`);
    }
    const rows = (data as Record<string, unknown>[] | null) ?? [];
    if (rows.length === 0) break;
    out.push(...rows);
    if (rows.length < batchSize) break;
    offset += rows.length;
    if (out.length >= hardLimit) {
      cappedByLimit = true;
      break;
    }
  }
  return { rows: out, cappedByLimit };
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ongeldige JSON' }, { status: 400 });
  }

  const supabase = createServerClient();

  const format = parseFormat(body.format);
  const explicitIds = parseProspectIds(body.prospect_ids);

  const requestedMax =
    typeof body.max_prospects === 'number' && body.max_prospects > 0
      ? Math.min(Number(body.max_prospects), DEFAULT_HARD_LIMIT)
      : DEFAULT_HARD_LIMIT;
  const hardLimit = requestedMax;

  let rows: Record<string, unknown>[];
  let cappedByLimit = false;
  let scope: 'selection' | 'filters';

  try {
    if (explicitIds.length > 0) {
      scope = 'selection';
      const truncated = explicitIds.slice(0, hardLimit);
      cappedByLimit = truncated.length < explicitIds.length;
      rows = await fetchProspectsByIds(supabase, admin, truncated);
      // Sorteer op bedrijfsnaam zodat het bestand stabiel oogt; selectievolgorde is niet betekenisvol.
      rows.sort((a, b) =>
        String(a.company_name ?? '').localeCompare(String(b.company_name ?? ''), 'nl'),
      );
    } else {
      scope = 'filters';
      const filters = {
        search: typeof body.search === 'string' ? body.search : null,
        status: typeof body.status === 'string' ? body.status : null,
        account_manager_id:
          typeof body.account_manager_id === 'string' ? body.account_manager_id : null,
        branch: typeof body.branch === 'string' ? body.branch : null,
        source: typeof body.source === 'string' ? body.source : null,
        has_open_tasks:
          typeof body.has_open_tasks === 'string' || typeof body.has_open_tasks === 'boolean'
            ? body.has_open_tasks
            : null,
      };
      const result = await fetchProspectsByFilters(supabase, admin, filters, hardLimit);
      rows = result.rows;
      cappedByLimit = result.cappedByLimit;
    }
  } catch (err) {
    console.error('[admin/prospects/export] fetch error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Prospects ophalen mislukt' },
      { status: 500 },
    );
  }

  if (rows.length === 0) {
    return NextResponse.json(
      { error: 'Geen prospects gevonden voor deze filters' },
      { status: 404 },
    );
  }

  const amIds = rows
    .map(r => r.account_manager_id)
    .filter((v): v is string => typeof v === 'string' && v.length > 0);

  const [accountManagerNames, branchNames] = await Promise.all([
    fetchAccountManagerNames(supabase, amIds),
    fetchBranchNames(supabase),
  ]);

  const exportRows = rows.map(p =>
    prospectToExportRow(p, { accountManagerNames, branchNames }),
  );

  logAudit({
    adminId: admin.id,
    adminName: admin.name,
    action: 'export_prospects',
    entityType: 'prospect',
    details: {
      count: exportRows.length,
      format,
      scope,
      capped_by_limit: cappedByLimit,
      hard_limit: hardLimit,
    },
  });

  console.info('[admin/prospects/export]', {
    count: exportRows.length,
    format,
    scope,
    cappedByLimit,
  });

  const stamp = prospectsExportFilenameBase();
  const filename = `${stamp}.${format}`;

  if (format === 'xlsx') {
    const buffer = buildProspectsXlsx(exportRows);
    const headers = new Headers({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'X-Export-Count': String(exportRows.length),
      'X-Export-Capped': cappedByLimit ? 'true' : 'false',
      'X-Export-Columns': String(PROSPECT_EXPORT_COLUMNS.length),
    });
    return new NextResponse(new Uint8Array(buffer), { status: 200, headers });
  }

  const csv = buildProspectsCsv(exportRows);
  const headers = new Headers({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'X-Export-Count': String(exportRows.length),
    'X-Export-Capped': cappedByLimit ? 'true' : 'false',
    'X-Export-Columns': String(PROSPECT_EXPORT_COLUMNS.length),
  });
  return new NextResponse(csv, { status: 200, headers });
}
