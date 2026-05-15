import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { logAudit } from '@/lib/audit';
import { leaderboardMonthStartIsoFromYearMonth } from '@/lib/amLeaderboardRules';
import { isAmLeaderboardMigrationMissingError } from '@/lib/amLeaderboardServer';

const YM_RE = /^\d{4}-\d{2}$/;

function validYearMonth(ym: string): boolean {
  if (!YM_RE.test(ym)) return false;
  try {
    leaderboardMonthStartIsoFromYearMonth(ym);
    return true;
  } catch {
    return false;
  }
}

/** Superadmin: handmatige leaderboardregel toevoegen. */
export async function POST(request: NextRequest) {
  const { admin, error } = await requireSuperAdmin(request);
  if (error) return error;

  let body: {
    year_month?: string;
    admin_user_id?: string;
    label?: string;
    amount_euro?: number | string;
    counts_as_batch?: number | boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ongeldige JSON' }, { status: 400 });
  }

  const year_month = String(body.year_month || '').trim();
  const admin_user_id = String(body.admin_user_id || '').trim();
  const label = String(body.label || '').trim().slice(0, 500);
  const amount_euro = Number(body.amount_euro);
  const counts_as_batch = body.counts_as_batch === true || Number(body.counts_as_batch) === 1 ? 1 : 0;

  if (!validYearMonth(year_month)) {
    return NextResponse.json({ error: 'year_month ongeldig (YYYY-MM)' }, { status: 400 });
  }
  if (!admin_user_id) {
    return NextResponse.json({ error: 'admin_user_id verplicht' }, { status: 400 });
  }
  if (!label) {
    return NextResponse.json({ error: 'label verplicht' }, { status: 400 });
  }
  if (!Number.isFinite(amount_euro)) {
    return NextResponse.json({ error: 'amount_euro ongeldig' }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data: am, error: amErr } = await supabase
    .from('admin_users')
    .select('id, is_active, is_account_manager')
    .eq('id', admin_user_id)
    .maybeSingle();

  if (amErr || !am?.is_active || !am.is_account_manager) {
    return NextResponse.json({ error: 'Alleen actieve accountmanagers zijn toegestaan' }, { status: 400 });
  }

  const { data: row, error: insErr } = await supabase
    .from('am_leaderboard_manual_lines')
    .insert({
      year_month,
      admin_user_id,
      label,
      amount_euro,
      counts_as_batch,
      created_by: admin.id,
    })
    .select('id')
    .single();

  if (insErr) {
    if (isAmLeaderboardMigrationMissingError(insErr.message || '')) {
      return NextResponse.json(
        {
          error: 'Migratie 107 ontbreekt: voer `supabase db push` uit of run het SQL-bestand in het Supabase-dashboard.',
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  void logAudit({
    adminId: admin.id,
    adminName: admin.name,
    action: 'am_leaderboard_manual_line_create',
    entityType: 'am_leaderboard_manual_line',
    entityId: row?.id ?? null,
    details: { year_month, admin_user_id, label, amount_euro, counts_as_batch },
  });

  return NextResponse.json({ ok: true, id: row?.id });
}

/** Superadmin: handmatige regel bijwerken. */
export async function PATCH(request: NextRequest) {
  const { admin, error } = await requireSuperAdmin(request);
  if (error) return error;

  const id = request.nextUrl.searchParams.get('id')?.trim();
  if (!id) {
    return NextResponse.json({ error: 'Query id verplicht' }, { status: 400 });
  }

  let body: { label?: string; amount_euro?: number | string; counts_as_batch?: number | boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ongeldige JSON' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (body.label !== undefined) updates.label = String(body.label).trim().slice(0, 500);
  if (body.amount_euro !== undefined) {
    const n = Number(body.amount_euro);
    if (!Number.isFinite(n)) {
      return NextResponse.json({ error: 'amount_euro ongeldig' }, { status: 400 });
    }
    updates.amount_euro = n;
  }
  if (body.counts_as_batch !== undefined) {
    updates.counts_as_batch = body.counts_as_batch === true || Number(body.counts_as_batch) === 1 ? 1 : 0;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Geen velden om bij te werken' }, { status: 400 });
  }

  const supabase = createServerClient();
  const { error: upErr } = await supabase.from('am_leaderboard_manual_lines').update(updates).eq('id', id);

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  void logAudit({
    adminId: admin.id,
    adminName: admin.name,
    action: 'am_leaderboard_manual_line_update',
    entityType: 'am_leaderboard_manual_line',
    entityId: id,
    details: updates,
  });

  return NextResponse.json({ ok: true });
}

/** Superadmin: handmatige regel verwijderen. */
export async function DELETE(request: NextRequest) {
  const { admin, error } = await requireSuperAdmin(request);
  if (error) return error;

  const id = request.nextUrl.searchParams.get('id')?.trim();
  if (!id) {
    return NextResponse.json({ error: 'Query id verplicht' }, { status: 400 });
  }

  const supabase = createServerClient();
  const { error: delErr } = await supabase.from('am_leaderboard_manual_lines').delete().eq('id', id);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  void logAudit({
    adminId: admin.id,
    adminName: admin.name,
    action: 'am_leaderboard_manual_line_delete',
    entityType: 'am_leaderboard_manual_line',
    entityId: id,
    details: {},
  });

  return NextResponse.json({ ok: true });
}
