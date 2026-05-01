import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized, forbidden } from '@/lib/adminAuth';
import { logAudit } from '@/lib/audit';
import { isAccountManagerScope } from '@/lib/prospects';

const PROSPECT_FIELDS = [
  'company_name', 'contact_person', 'email', 'phone', 'website',
  'kvk_nummer', 'vat_id', 'address', 'postcode', 'city', 'country',
  'branches', 'company_size', 'notes',
] as const;

interface ImportRow {
  // mapping resultaat: { company_name: 'Foo BV', email: '...', ... }
  [field: string]: unknown;
}

interface ImportBody {
  filename?: string;
  format?: 'csv' | 'xlsx';
  rows: ImportRow[];
  column_mapping?: Record<string, string>;
  assignment_strategy?: 'manual' | 'specific_am' | 'round_robin';
  account_manager_id?: string;
  account_manager_ids?: string[];
  /** Branches (slugs) die op alle geïmporteerde prospects worden toegepast,
   *  gemerged met een eventuele branches-kolom uit het bestand. */
  default_branches?: string[];
}

function normalizePhone(raw: unknown): string {
  if (!raw) return '';
  let p = String(raw).replace(/[\s\-().\/]/g, '');
  if (p.startsWith('+31')) p = '0' + p.slice(3);
  else if (p.startsWith('0031')) p = '0' + p.slice(4);
  else if (p.startsWith('+32')) p = '0' + p.slice(3);
  else if (p.startsWith('0032')) p = '0' + p.slice(4);
  return p;
}

function cleanKvk(raw: unknown): string {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  return digits.length === 8 ? digits : '';
}

function cleanPostcode(raw: unknown): string {
  if (!raw) return '';
  const s = String(raw).replace(/\s+/g, '').toUpperCase().trim();
  return /^\d{4}[A-Z]{2}$/.test(s) ? `${s.slice(0, 4)} ${s.slice(4)}` : String(raw).trim();
}

function parseBranches(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter(x => typeof x === 'string').map(s => s.trim()).filter(Boolean);
  if (!raw) return [];
  return String(raw)
    .split(/[,;|]/)
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

function isValidEmail(s: unknown): boolean {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  if (isAccountManagerScope(admin)) return forbidden();

  let body: ImportBody;
  try {
    body = (await request.json()) as ImportBody;
  } catch {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }

  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return NextResponse.json({ error: 'Geen rijen om te importeren' }, { status: 400 });
  }
  if (body.rows.length > 5000) {
    return NextResponse.json({ error: 'Maximaal 5000 rijen per import' }, { status: 400 });
  }

  const supabase = createServerClient();

  // Pre-fetch existing kvk + email om duplicates te detecteren tegen prospects EN customers
  const incomingKvks = new Set<string>();
  const incomingEmails = new Set<string>();
  for (const r of body.rows) {
    const k = cleanKvk(r.kvk_nummer);
    if (k) incomingKvks.add(k);
    const e = isValidEmail(r.email) ? String(r.email).toLowerCase() : '';
    if (e) incomingEmails.add(e);
  }

  const existingKvk = new Set<string>();
  const existingEmail = new Set<string>();

  if (incomingKvks.size > 0) {
    const kvks = Array.from(incomingKvks);
    const [pRes, cRes] = await Promise.all([
      supabase.from('prospects').select('kvk_nummer').in('kvk_nummer', kvks),
      supabase.from('customers').select('kvk_nummer').in('kvk_nummer', kvks),
    ]);
    for (const r of pRes.data || []) if (r.kvk_nummer) existingKvk.add(String(r.kvk_nummer));
    for (const r of cRes.data || []) if (r.kvk_nummer) existingKvk.add(String(r.kvk_nummer));
  }

  if (incomingEmails.size > 0) {
    const emails = Array.from(incomingEmails);
    const [pRes, cRes] = await Promise.all([
      supabase.from('prospects').select('email').in('email', emails),
      supabase.from('customers').select('email').in('email', emails),
    ]);
    for (const r of pRes.data || []) if (r.email) existingEmail.add(String(r.email).toLowerCase());
    for (const r of cRes.data || []) if (r.email) existingEmail.add(String(r.email).toLowerCase());
  }

  // Valideer optionele default_branches tegen de branches-tabel zodat we nooit
  // ongeldige slugs in prospects.branches krijgen, ongeacht wat de UI stuurt.
  const requestedDefaultBranches = Array.isArray(body.default_branches)
    ? Array.from(
        new Set(
          body.default_branches
            .map(s => (typeof s === 'string' ? s.trim().toLowerCase() : ''))
            .filter(Boolean),
        ),
      )
    : [];
  let validatedDefaultBranches: string[] = [];
  if (requestedDefaultBranches.length > 0) {
    const { data: branchRows } = await supabase
      .from('branches')
      .select('slug')
      .in('slug', requestedDefaultBranches);
    validatedDefaultBranches = (branchRows || []).map(b => String(b.slug));
  }

  // Bepaal toewijzings-pool
  const strategy = body.assignment_strategy ?? 'manual';
  let amPool: string[] = [];
  let assignmentAdminIds: string[] = [];

  if (strategy === 'specific_am' && body.account_manager_id) {
    const { data } = await supabase
      .from('admin_users')
      .select('id, is_active')
      .eq('id', body.account_manager_id)
      .single();
    if (data && data.is_active) {
      amPool = [data.id];
      assignmentAdminIds = [data.id];
    } else {
      return NextResponse.json({ error: 'Account manager niet gevonden of inactief' }, { status: 400 });
    }
  } else if (strategy === 'round_robin' && Array.isArray(body.account_manager_ids) && body.account_manager_ids.length > 0) {
    const { data } = await supabase
      .from('admin_users')
      .select('id, is_active')
      .in('id', body.account_manager_ids);
    amPool = (data || []).filter(a => a.is_active).map(a => a.id);
    assignmentAdminIds = amPool;
    if (amPool.length === 0) {
      return NextResponse.json({ error: 'Geen actieve AMs in pool' }, { status: 400 });
    }
  }

  // Bouw rijen op
  type Built = { ok: true; row: Record<string, unknown> } | { ok: false; reason: string; index: number };
  const built: Built[] = [];
  const seenInBatchKvk = new Set<string>();
  const seenInBatchEmail = new Set<string>();

  body.rows.forEach((r, idx) => {
    const company = typeof r.company_name === 'string' ? r.company_name.trim() : '';
    if (!company) {
      built.push({ ok: false, reason: 'lege company_name', index: idx });
      return;
    }

    const kvk = cleanKvk(r.kvk_nummer);
    if (kvk && (existingKvk.has(kvk) || seenInBatchKvk.has(kvk))) {
      built.push({ ok: false, reason: 'duplicaat KVK', index: idx });
      return;
    }
    const email = isValidEmail(r.email) ? String(r.email).toLowerCase() : '';
    if (!kvk && email && (existingEmail.has(email) || seenInBatchEmail.has(email))) {
      built.push({ ok: false, reason: 'duplicaat e-mail', index: idx });
      return;
    }
    if (kvk) seenInBatchKvk.add(kvk);
    if (email) seenInBatchEmail.add(email);

    const out: Record<string, unknown> = {
      company_name: company,
      source: body.format === 'csv' ? 'csv_import' : 'xlsx_import',
      created_by_admin_id: admin.id,
    };
    for (const f of PROSPECT_FIELDS) {
      if (f === 'company_name') continue;
      if (f === 'phone') {
        const v = normalizePhone(r.phone);
        if (v) out.phone = v;
      } else if (f === 'kvk_nummer') {
        if (kvk) out.kvk_nummer = kvk;
      } else if (f === 'postcode') {
        const v = cleanPostcode(r.postcode);
        if (v) out.postcode = v;
      } else if (f === 'branches') {
        const fromFile = parseBranches(r.branches);
        const merged = Array.from(new Set([...fromFile, ...validatedDefaultBranches]));
        if (merged.length > 0) out.branches = merged;
      } else if (f === 'email') {
        if (email) out.email = email;
      } else {
        const v = r[f];
        if (typeof v === 'string' && v.trim()) out[f] = v.trim();
      }
    }

    built.push({ ok: true, row: out });
  });

  const validRows = built.filter((b): b is { ok: true; row: Record<string, unknown> } => b.ok);
  const errors = built.filter(b => !b.ok);

  // Toewijzing assignen
  if (amPool.length > 0) {
    validRows.forEach((b, i) => {
      const amId = amPool[i % amPool.length];
      b.row.account_manager_id = amId;
      b.row.assigned_at = new Date().toISOString();
    });
  }

  // Eerst de import-record (zonder counts), dan rijen invoegen, dan counts updaten
  const { data: importRow, error: importErr } = await supabase
    .from('prospect_imports')
    .insert({
      admin_id: admin.id,
      filename: typeof body.filename === 'string' ? body.filename : null,
      format: body.format ?? 'xlsx',
      total_rows: body.rows.length,
      column_mapping: body.column_mapping ?? null,
      assignment_strategy: strategy,
      assignment_admin_ids: assignmentAdminIds.length > 0 ? assignmentAdminIds : null,
      default_branches: validatedDefaultBranches.length > 0 ? validatedDefaultBranches : null,
      errors: errors.length > 0 ? errors.slice(0, 200) : null,
    })
    .select()
    .single();

  if (importErr || !importRow) {
    return NextResponse.json({ error: 'Import-log aanmaken mislukt' }, { status: 500 });
  }

  // Voeg metadata toe aan rijen
  for (const b of validRows) {
    b.row.source_metadata = { import_id: importRow.id };
  }

  // Bulk insert in batches van 500
  let imported = 0;
  const insertedIds: string[] = [];
  const CHUNK = 500;
  for (let i = 0; i < validRows.length; i += CHUNK) {
    const chunk = validRows.slice(i, i + CHUNK).map(b => b.row);
    const { data, error } = await supabase.from('prospects').insert(chunk).select('id');
    if (error) {
      console.error('[prospects/import] insert error:', error.message);
      continue;
    }
    imported += data?.length || 0;
    for (const d of data || []) insertedIds.push(d.id);
  }

  // Activity per imported prospect
  if (insertedIds.length > 0) {
    const activityRows = insertedIds.map(pid => ({
      prospect_id: pid,
      admin_user_id: admin.id,
      type: 'import',
      title: 'Geïmporteerd uit bestand',
      metadata: { import_id: importRow.id },
    }));
    for (let i = 0; i < activityRows.length; i += CHUNK) {
      await supabase.from('prospect_activities').insert(activityRows.slice(i, i + CHUNK));
    }
  }

  // Update import-record met definitieve telling
  await supabase
    .from('prospect_imports')
    .update({
      imported_rows: imported,
      duplicate_rows: errors.filter(e => !e.ok && e.reason.startsWith('duplicaat')).length,
      error_rows: errors.filter(e => !e.ok && !e.reason.startsWith('duplicaat')).length,
      skipped_rows: validRows.length - imported,
    })
    .eq('id', importRow.id);

  logAudit({
    adminId: admin.id,
    adminName: admin.name,
    action: 'prospect.imported',
    entityType: 'prospect',
    details: {
      import_id: importRow.id,
      filename: body.filename,
      total: body.rows.length,
      imported,
      duplicates: errors.filter(e => !e.ok && e.reason.startsWith('duplicaat')).length,
      errors: errors.filter(e => !e.ok && !e.reason.startsWith('duplicaat')).length,
      strategy,
      default_branches: validatedDefaultBranches.length > 0 ? validatedDefaultBranches : undefined,
    },
  });

  return NextResponse.json({
    success: true,
    import_id: importRow.id,
    total: body.rows.length,
    imported,
    duplicates: errors.filter(e => !e.ok && e.reason.startsWith('duplicaat')).length,
    errors_count: errors.filter(e => !e.ok && !e.reason.startsWith('duplicaat')).length,
    error_samples: errors.slice(0, 20),
  });
}

/**
 * Endpoint helper voor de UI om duplicates vooraf te checken zonder te importeren.
 * Body: { kvk_nummers: string[], emails: string[] }
 */
export async function PUT(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  if (isAccountManagerScope(admin)) return forbidden();

  let body: { kvk_nummers?: string[]; emails?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }

  const supabase = createServerClient();
  const kvks = Array.from(new Set((body.kvk_nummers || []).filter(Boolean).map(s => cleanKvk(s)))).filter(Boolean);
  const emails = Array.from(new Set((body.emails || []).filter(Boolean).map(s => String(s).toLowerCase()))).filter(isValidEmail);

  const dupKvks = new Set<string>();
  const dupEmails = new Set<string>();

  if (kvks.length > 0) {
    const [p, c] = await Promise.all([
      supabase.from('prospects').select('kvk_nummer').in('kvk_nummer', kvks),
      supabase.from('customers').select('kvk_nummer').in('kvk_nummer', kvks),
    ]);
    for (const r of p.data || []) if (r.kvk_nummer) dupKvks.add(String(r.kvk_nummer));
    for (const r of c.data || []) if (r.kvk_nummer) dupKvks.add(String(r.kvk_nummer));
  }

  if (emails.length > 0) {
    const [p, c] = await Promise.all([
      supabase.from('prospects').select('email').in('email', emails),
      supabase.from('customers').select('email').in('email', emails),
    ]);
    for (const r of p.data || []) if (r.email) dupEmails.add(String(r.email).toLowerCase());
    for (const r of c.data || []) if (r.email) dupEmails.add(String(r.email).toLowerCase());
  }

  return NextResponse.json({
    duplicate_kvk_nummers: Array.from(dupKvks),
    duplicate_emails: Array.from(dupEmails),
  });
}
