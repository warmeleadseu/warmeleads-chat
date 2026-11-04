import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { calculateAmTargetProgress, calendarMonthDateBounds, omzetBronVoorTargets } from '@/lib/amTargetsProgress';
import { leaderboardYearMonthFromDate, leaderboardMonthStartIsoFromYearMonth } from '@/lib/amLeaderboardRules';
import { isAmLeaderboardMigrationMissingError, loadLeaderboardExcludedBatchIds } from '@/lib/amLeaderboardServer';
import { omzetPerAm, omzetRegelsVanAm } from '@/lib/omzetPerAm';
import { amsterdamYmd } from '@/lib/appointmentSlots';

const YM_RE = /^\d{4}-\d{2}$/;

function parseYearMonth(request: NextRequest): string | null {
  const raw = request.nextUrl.searchParams.get('year_month')?.trim();
  if (!raw) return leaderboardYearMonthFromDate();
  if (!YM_RE.test(raw)) return null;
  try {
    leaderboardMonthStartIsoFromYearMonth(raw);
    return raw;
  } catch {
    return null;
  }
}

/** Superadmin: volledige leaderboard-bron per AM voor een maand (YYYY-MM). */
export async function GET(request: NextRequest) {
  const { error } = await requireSuperAdmin(request);
  if (error) return error;

  const yearMonth = parseYearMonth(request);
  if (!yearMonth) {
    return NextResponse.json({ error: 'Ongeldige year_month (verwacht YYYY-MM)' }, { status: 400 });
  }

  const supabase = createServerClient();
  const monthStart = leaderboardMonthStartIsoFromYearMonth(yearMonth);

  try {
    const omzetBron = omzetBronVoorTargets(supabase);
    const [{ posten, bronnen }, excludedIds, exclusionsRows, manualRows, allAms] = await Promise.all([
      omzetBron(),
      loadLeaderboardExcludedBatchIds(supabase, yearMonth),
      supabase
        .from('am_leaderboard_batch_exclusions')
        .select('id, customer_batch_id, reason, created_at, created_by')
        .eq('year_month', yearMonth),
      supabase
        .from('am_leaderboard_manual_lines')
        .select('id, admin_user_id, label, amount_euro, counts_as_batch, created_at, created_by')
        .eq('year_month', yearMonth)
        .order('created_at', { ascending: false }),
      supabase
        .from('admin_users')
        .select('id, name')
        .eq('is_account_manager', true)
        .eq('is_active', true)
        .order('name', { ascending: true }),
    ]);

    if (exclusionsRows.error) {
      if (isAmLeaderboardMigrationMissingError(exclusionsRows.error.message)) {
        throw new Error('AM_LEADERBOARD_MIGRATION_107_MISSING');
      }
      throw new Error(exclusionsRows.error.message);
    }
    if (manualRows.error) {
      if (isAmLeaderboardMigrationMissingError(manualRows.error.message)) {
        throw new Error('AM_LEADERBOARD_MIGRATION_107_MISSING');
      }
      throw new Error(manualRows.error.message);
    }

    /* Dezelfde betaalde omzet als het live-dashboard (src/lib/omzetPerAm.ts):
       op de dag van betalen, in Nederlandse tijd. De lopende maand tot vandaag. */
    const { first: maandEerste, last: maandLaatste } = calendarMonthDateBounds(yearMonth);
    const vandaag = amsterdamYmd(new Date());
    const periode = { vanDag: maandEerste, totDag: maandLaatste < vandaag ? maandLaatste : vandaag };
    const perAm = omzetPerAm(posten, periode, bronnen, excludedIds);
    const amRevenue = new Map<string, number>();
    const amBulkRevenue = new Map<string, number>();
    const amBatchCount = new Map<string, number>();
    for (const [amId, r] of perAm) {
      if (!amId) continue;
      amRevenue.set(amId, Math.round((r.totaal - r.bulk) * 100) / 100);
      amBulkRevenue.set(amId, r.bulk);
      amBatchCount.set(amId, r.batches);
    }
    for (const m of manualRows.data || []) {
      const amId = m.admin_user_id as string;
      amRevenue.set(amId, Math.round(((amRevenue.get(amId) || 0) + (Number(m.amount_euro) || 0)) * 100) / 100);
      if (Number(m.counts_as_batch) === 1) amBatchCount.set(amId, (amBatchCount.get(amId) || 0) + 1);
    }

    /* Klant- en batchgegevens voor de regels per accountmanager. */
    const regelsPerAm = new Map((allAms.data || []).map(am => [am.id as string, omzetRegelsVanAm(posten, periode, bronnen, am.id as string)]));
    const batchIds = [...new Set([...regelsPerAm.values()].flat().map(r => r.batch_id).filter((x): x is string => Boolean(x)))];
    const klantIds = [...new Set([...regelsPerAm.values()].flat().map(r => r.customer_id).filter((x): x is string => Boolean(x)))];
    const batchInfo = new Map<string, { branch: string | null; batch_kind: string | null; created_at: string }>();
    for (let i = 0; i < batchIds.length; i += 200) {
      const { data } = await supabase.from('customer_batches').select('id, branch, batch_kind, created_at').in('id', batchIds.slice(i, i + 200));
      for (const b of data || []) batchInfo.set(b.id as string, { branch: b.branch as string | null, batch_kind: b.batch_kind as string | null, created_at: b.created_at as string });
    }
    const klantNaam = new Map<string, string>();
    for (let i = 0; i < klantIds.length; i += 200) {
      const { data } = await supabase.from('customers').select('id, name').in('id', klantIds.slice(i, i + 200));
      for (const k of data || []) klantNaam.set(k.id as string, (k.name as string) || '-');
    }

    const exclusionMetaByBatch = new Map<string, { id: string; reason: string | null; created_at: string }>();
    for (const row of exclusionsRows.data || []) {
      exclusionMetaByBatch.set(row.customer_batch_id as string, {
        id: row.id as string,
        reason: (row.reason as string) || null,
        created_at: row.created_at as string,
      });
    }

    type BatchLine = {
      /** Uniek per regel; batch_id is leeg bij een losse of externe factuur. */
      regel_id: string;
      batch_id: string | null;
      soort: string;
      dag: string;
      customer_name: string;
      branch: string;
      batch_kind: string | null;
      total_price: number;
      created_at: string;
      excluded: boolean;
      exclusion?: { id: string; reason: string | null; created_at: string };
    };

    const byAm: Record<
      string,
      {
        included_batches: BatchLine[];
        excluded_batches: BatchLine[];
        manual_lines: {
          id: string;
          label: string;
          amount_euro: number;
          counts_as_batch: number;
          created_at: string;
        }[];
      }
    > = {};

    function ensureAm(amId: string) {
      if (!byAm[amId]) {
        byAm[amId] = { included_batches: [], excluded_batches: [], manual_lines: [] };
      }
      return byAm[amId];
    }

    const regel = (amId: string, r: { sleutel: string; batch_id: string | null; customer_id: string | null; soort: string; dag: string; bedrag: number }, excluded: boolean) => {
      const info = r.batch_id ? batchInfo.get(r.batch_id) : undefined;
      const line: BatchLine = {
        regel_id: r.sleutel,
        batch_id: r.batch_id,
        soort: r.soort,
        dag: r.dag,
        customer_name: (r.customer_id && klantNaam.get(r.customer_id)) || '-',
        branch: info?.branch || (r.batch_id ? '-' : r.soort === 'credit' ? 'creditnota' : 'factuur'),
        batch_kind: info?.batch_kind ?? null,
        total_price: r.bedrag,
        created_at: info?.created_at || r.dag,
        excluded,
        exclusion: r.batch_id ? exclusionMetaByBatch.get(r.batch_id) : undefined,
      };
      const bucket = ensureAm(amId);
      if (excluded) bucket.excluded_batches.push(line);
      else bucket.included_batches.push(line);
    };
    for (const [amId, regels] of regelsPerAm) {
      for (const r of regels) regel(amId, r, Boolean(r.batch_id && excludedIds.has(r.batch_id)));
    }

    for (const m of manualRows.data || []) {
      const amId = m.admin_user_id as string;
      ensureAm(amId).manual_lines.push({
        id: m.id as string,
        label: m.label as string,
        amount_euro: Number(m.amount_euro) || 0,
        counts_as_batch: Number(m.counts_as_batch) || 0,
        created_at: m.created_at as string,
      });
    }

    const rangeFirst = maandEerste;
    const rangeLast = maandLaatste;
    const { data: rawTargets, error: tgtErr } = await supabase
      .from('am_targets')
      .select(
        'id, admin_user_id, label, target_type, target_value, bonus_amount, period_start, period_end, notes, status',
      )
      .lte('period_start', rangeLast)
      .gte('period_end', rangeFirst);

    if (tgtErr) throw new Error(tgtErr.message);

    const TARGET_TYPE_LABELS: Record<string, string> = {
      revenue: 'Omzet',
      batches: 'Batches',
      new_customers: 'Nieuwe klanten',
      leads_delivered: 'Leads geleverd',
    };

    type EnrichedTarget = {
      id: string;
      admin_user_id: string;
      label: string;
      target_type: string;
      target_type_label: string;
      target_value: number;
      bonus_amount: number;
      period_start: string;
      period_end: string;
      notes: string | null;
      status: string;
      current_value: number;
      progress_pct: number;
    };

    const enrichedTargets: EnrichedTarget[] = await Promise.all(
      (rawTargets || []).map(
        async (t: {
          id: string;
          admin_user_id: string;
          label: string;
          target_type: string;
          target_value: unknown;
          bonus_amount: unknown;
          period_start: string;
          period_end: string;
          notes: string | null;
          status: string;
        }) => {
          const current = await calculateAmTargetProgress(
            supabase,
            t.admin_user_id,
            t.target_type,
            t.period_start,
            t.period_end,
            omzetBron,
          );
          const tv = Number(t.target_value) || 0;
          const pct = tv > 0 ? Math.round((current / tv) * 100) : 0;
          return {
            id: t.id,
            admin_user_id: t.admin_user_id,
            label: t.label,
            target_type: t.target_type,
            target_type_label: TARGET_TYPE_LABELS[t.target_type] || t.target_type,
            target_value: tv,
            bonus_amount: Number(t.bonus_amount) || 0,
            period_start: t.period_start,
            period_end: t.period_end,
            notes: t.notes,
            status: t.status,
            current_value: current,
            progress_pct: Math.min(pct, 999),
          };
        },
      ),
    );

    const targetsByAm = new Map<string, EnrichedTarget[]>();
    for (const t of enrichedTargets) {
      const arr = targetsByAm.get(t.admin_user_id) || [];
      arr.push(t);
      targetsByAm.set(t.admin_user_id, arr);
    }

    const accountManagers = (allAms.data || []).map(am => {
      const pack = byAm[am.id] || { included_batches: [], excluded_batches: [], manual_lines: [] };
      const rev = amRevenue.get(am.id) || 0;
      const bulk = Math.round((amBulkRevenue.get(am.id) || 0) * 100) / 100;
      const batchesN = amBatchCount.get(am.id) || 0;
      return {
        id: am.id,
        name: am.name,
        revenue_from_batches: rev,
        bulk_revenue: bulk,
        leaderboard_total: Math.round((rev + bulk) * 100) / 100,
        leaderboard_batches: batchesN,
        targets: targetsByAm.get(am.id) || [],
        ...pack,
      };
    });

    return NextResponse.json({
      year_month: yearMonth,
      month_start_iso: monthStart,
      account_managers: accountManagers,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Onbekende fout';
    if (
      msg === 'AM_LEADERBOARD_MIGRATION_107_MISSING' ||
      isAmLeaderboardMigrationMissingError(msg) ||
      (msg.includes('relation') && msg.includes('does not exist'))
    ) {
      return NextResponse.json(
        {
          error:
            'De leaderboard-tabellen ontbreken nog. Voer database-migratie 107 uit (één keer per omgeving).',
          hint:
            'Lokaal met CLI: `supabase link` + `supabase db push`. Of in Supabase Dashboard → SQL → plak de inhoud van `supabase/migrations/107_am_leaderboard_overrides.sql` en run.',
        },
        { status: 503 },
      );
    }
    console.error('[am-leaderboard-rules]', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
