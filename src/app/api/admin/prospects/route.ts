import { NextRequest, NextResponse } from 'next/server';
import { laadVoicemails, type VoicemailSamenvatting } from '@/lib/prospectVoicemail';
import { eerdereAmsMetNaam, laadAmHistorie, metNamen, type AmPeriodeMetNaam } from '@/lib/prospectAmHistorie';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { logAudit } from '@/lib/audit';
import {
  applyAmScope,
  isAccountManagerScope,
  isValidSource,
  isValidStatus,
} from '@/lib/prospects';
import {
  buildProspectFilterApplicator,
  readProspectListFiltersFromUrl,
} from '@/lib/prospectsListFilters';
import { alleProspectRijen, telPerStatus } from '@/lib/prospectTelling';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 200;

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const url = request.nextUrl;

  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMIT))));
  const sort = url.searchParams.get('sort') || 'updated_at';
  const order = url.searchParams.get('order') || 'desc';
  const includeStats = url.searchParams.get('include_stats') === '1';

  const filters = readProspectListFiltersFromUrl(url.searchParams);
  const applyFilters = await buildProspectFilterApplicator(supabase, admin, filters);

  const countQuery = applyFilters(
    supabase.from('prospects').select('id', { count: 'exact', head: true }),
  );
  let dataQuery = applyFilters(supabase.from('prospects').select('*'));

  const allowedSorts: Record<string, string> = {
    company_name: 'company_name',
    created_at: 'created_at',
    updated_at: 'updated_at',
    next_action_at: 'next_action_at',
    status_changed_at: 'status_changed_at',
  };
  const sortCol = allowedSorts[sort] || 'updated_at';
  const asc = order !== 'desc';

  dataQuery = dataQuery
    .order(sortCol, { ascending: asc, nullsFirst: false })
    /* Na een import delen veel prospects hetzelfde tijdstip; zonder vaste
       tweede volgorde kan er tussen twee pagina's een wegvallen. */
    .order('id')
    .range((page - 1) * limit, page * limit - 1);

  const [
    { count: totalCount, error: countErr },
    { data: prospects, error: dataErr },
  ] = await Promise.all([
    countQuery,
    dataQuery,
  ]);

  if (countErr || dataErr) {
    console.error('[prospects] list error:', countErr?.message || dataErr?.message);
    return NextResponse.json({ error: 'Prospects ophalen mislukt' }, { status: 500 });
  }

  const total = totalCount || 0;
  const ids = (prospects || []).map(p => p.id);

  // Enrich met counts (open tasks + activities)
  const taskCounts: Record<string, number> = {};
  const activityCounts: Record<string, number> = {};
  let voicemails = new Map<string, VoicemailSamenvatting>();
  let amHistorie = new Map<string, AmPeriodeMetNaam[]>();

  if (ids.length > 0) {
    const [tasksRes, actsRes, vm, ah] = await Promise.all([
      supabase
        .from('prospect_tasks')
        .select('prospect_id')
        .in('prospect_id', ids)
        .is('completed_at', null),
      supabase
        .from('prospect_activities')
        .select('prospect_id')
        .in('prospect_id', ids),
      laadVoicemails(supabase, ids).catch(() => new Map<string, VoicemailSamenvatting>()),
      laadAmHistorie(supabase, prospects || []).then(h => metNamen(supabase, h)).catch(() => new Map<string, AmPeriodeMetNaam[]>()),
    ]);
    voicemails = vm;
    amHistorie = ah;

    for (const r of tasksRes.data || []) {
      taskCounts[r.prospect_id] = (taskCounts[r.prospect_id] || 0) + 1;
    }
    for (const r of actsRes.data || []) {
      activityCounts[r.prospect_id] = (activityCounts[r.prospect_id] || 0) + 1;
    }
  }

  const enriched = (prospects || []).map(p => ({
    ...p,
    open_task_count: taskCounts[p.id] || 0,
    activity_count: activityCounts[p.id] || 0,
    voicemail: voicemails.get(p.id) ?? { aantal: 0, momenten: [] },
    eerdere_ams: eerdereAmsMetNaam(amHistorie.get(p.id) ?? [], p.account_manager_id),
  }));

  // Statusfacets (alleen op page=1 of expliciet)
  let stats: Record<string, number> | undefined;
  if (includeStats || page === 1) {
    try {
      const statusRows = await alleProspectRijen<{ status: string }>((van, tot) => {
        let q = supabase.from('prospects').select('status');
        q = applyAmScope(q, admin);
        return q.order('id').range(van, tot);
      });
      stats = { ...telPerStatus(statusRows), total: statusRows.length };
    } catch (err) {
      /* De lijst zelf is er wel; alleen de tellers blijven dan zoals ze waren. */
      console.error('[prospects] statustelling mislukt:', err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json({
    prospects: enriched,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    limit,
    stats,
  });
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }

  if (!body.company_name || typeof body.company_name !== 'string') {
    return NextResponse.json({ error: 'Bedrijfsnaam is verplicht' }, { status: 400 });
  }

  const allowed = [
    'company_name', 'contact_person', 'email', 'phone', 'website',
    'kvk_nummer', 'vat_id', 'address', 'postcode', 'city', 'country',
    'branches', 'company_size', 'notes', 'status', 'lost_reason',
    'source', 'source_metadata', 'account_manager_id',
  ] as const;

  // Tekstvelden waarvoor lege strings naar NULL moeten worden genormaliseerd
  // (zie ook /[id]/route.ts) — voorkomt dat de partiële unique-index op
  // kvk_nummer botst tussen meerdere prospects zonder KVK.
  const NULLABLE_TEXT_FIELDS = new Set([
    'contact_person',
    'email',
    'phone',
    'website',
    'kvk_nummer',
    'vat_id',
    'address',
    'postcode',
    'city',
    'country',
    'company_size',
    'notes',
    'lost_reason',
  ]);

  const insert: Record<string, unknown> = {};
  for (const key of allowed) {
    if (!(key in body) || body[key] === undefined) continue;
    let value: unknown = body[key];
    if (typeof value === 'string' && NULLABLE_TEXT_FIELDS.has(key)) {
      const trimmed = value.trim();
      value = trimmed === '' ? null : trimmed;
    }
    insert[key] = value;
  }

  if (insert.status && !isValidStatus(insert.status)) {
    return NextResponse.json({ error: 'Ongeldige status' }, { status: 400 });
  }
  if (insert.source && !isValidSource(insert.source)) {
    return NextResponse.json({ error: 'Ongeldige bron' }, { status: 400 });
  }

  // AM mag alleen zichzelf toewijzen
  if (isAccountManagerScope(admin)) {
    insert.account_manager_id = admin.id;
  }
  // Default: AM die het aanmaakt is account_manager, tenzij anders opgegeven
  if (!insert.account_manager_id && admin.role !== 'superadmin' && admin.role !== 'admin') {
    insert.account_manager_id = admin.id;
  }

  insert.created_by_admin_id = admin.id;
  if (insert.account_manager_id) {
    (insert as { assigned_at?: string }).assigned_at = new Date().toISOString();
  }

  const supabase = createServerClient();
  const { data, error } = await supabase.from('prospects').insert(insert).select().single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Een prospect met dit KVK-nummer bestaat al' }, { status: 409 });
    }
    console.error('[prospects] create error:', error.message);
    return NextResponse.json({ error: 'Prospect aanmaken mislukt' }, { status: 500 });
  }

  await supabase.from('prospect_activities').insert({
    prospect_id: data.id,
    admin_user_id: admin.id,
    type: 'created',
    title: 'Prospect aangemaakt',
    metadata: { source: insert.source ?? 'manual' },
  });

  logAudit({
    adminId: admin.id,
    adminName: admin.name,
    action: 'prospect.created',
    entityType: 'prospect',
    entityId: data.id,
    details: { company_name: data.company_name },
  });

  return NextResponse.json({ success: true, prospect: data });
}
