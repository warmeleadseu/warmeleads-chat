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

/** Superadmin: batch uitsluiten van AM-leaderboard voor een maand. */
export async function POST(request: NextRequest) {
  const { admin, error } = await requireSuperAdmin(request);
  if (error) return error;

  let body: { year_month?: string; customer_batch_id?: string; reason?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ongeldige JSON' }, { status: 400 });
  }

  const year_month = String(body.year_month || '').trim();
  const customer_batch_id = String(body.customer_batch_id || '').trim();
  const reason = body.reason != null ? String(body.reason).slice(0, 2000) : null;

  if (!validYearMonth(year_month)) {
    return NextResponse.json({ error: 'year_month ongeldig (YYYY-MM)' }, { status: 400 });
  }
  if (!customer_batch_id) {
    return NextResponse.json({ error: 'customer_batch_id verplicht' }, { status: 400 });
  }

  const supabase = createServerClient();
  const monthStart = leaderboardMonthStartIsoFromYearMonth(year_month);

  const { data: batch, error: bErr } = await supabase
    .from('customer_batches')
    .select('id, is_paid, created_at')
    .eq('id', customer_batch_id)
    .maybeSingle();

  if (bErr || !batch) {
    return NextResponse.json({ error: 'Batch niet gevonden' }, { status: 404 });
  }
  if (!batch.is_paid) {
    return NextResponse.json({ error: 'Alleen betaalde batches kunnen worden uitgesloten' }, { status: 400 });
  }
  if (!batch.created_at || batch.created_at < monthStart) {
    return NextResponse.json({ error: 'Batch valt niet in de gekozen kalendermaand' }, { status: 400 });
  }

  const { data: row, error: insErr } = await supabase
    .from('am_leaderboard_batch_exclusions')
    .insert({
      year_month,
      customer_batch_id,
      reason,
      created_by: admin.id,
    })
    .select('id')
    .single();

  if (insErr) {
    if (insErr.code === '23505') {
      return NextResponse.json({ error: 'Deze batch is al uitgesloten voor deze maand' }, { status: 409 });
    }
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
    action: 'am_leaderboard_exclude_batch',
    entityType: 'am_leaderboard_batch_exclusion',
    entityId: row?.id ?? null,
    details: { year_month, customer_batch_id, reason },
  });

  return NextResponse.json({ ok: true, id: row?.id });
}

/** Superadmin: uitsluiting verwijderen. */
export async function DELETE(request: NextRequest) {
  const { admin, error } = await requireSuperAdmin(request);
  if (error) return error;

  const id = request.nextUrl.searchParams.get('id')?.trim();
  if (!id) {
    return NextResponse.json({ error: 'Query id verplicht' }, { status: 400 });
  }

  const supabase = createServerClient();
  const { error: delErr } = await supabase.from('am_leaderboard_batch_exclusions').delete().eq('id', id);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  void logAudit({
    adminId: admin.id,
    adminName: admin.name,
    action: 'am_leaderboard_unexclude_batch',
    entityType: 'am_leaderboard_batch_exclusion',
    entityId: id,
    details: {},
  });

  return NextResponse.json({ ok: true });
}
