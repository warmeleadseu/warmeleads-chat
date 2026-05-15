import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { calculateAmTargetProgress, calendarMonthDateBounds } from '@/lib/amTargetsProgress';
import { leaderboardYearMonthFromDate, leaderboardMonthStartIsoFromYearMonth } from '@/lib/amLeaderboardRules';
import {
  computeLeaderboardMapsFromDbRows,
  fetchMonthlyPaidBatchesForLeaderboard,
  loadLeaderboardExcludedBatchIds,
  loadLeaderboardManualLines,
  resolveBatchAmId,
} from '@/lib/amLeaderboardServer';

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
    const [batches, excludedIds, exclusionsRows, manualRows, allAms, bulkCustomers] = await Promise.all([
      fetchMonthlyPaidBatchesForLeaderboard(supabase, yearMonth),
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
      supabase.from('customers').select('id, name, bulk_price_per_lead, account_manager_id').not('bulk_price_per_lead', 'is', null),
    ]);

    if (exclusionsRows.error) throw new Error(exclusionsRows.error.message);
    if (manualRows.error) throw new Error(manualRows.error.message);

    const { amRevenue, amBatchCount } = computeLeaderboardMapsFromDbRows(batches, excludedIds, manualRows.data || []);

    const BULK_PAGE = 1000;
    const BULK_MAX_PAGES = 80;
    const bulkMap = new Map<string, { price: number; amId: string | null; name: string }>();
    for (const c of bulkCustomers.data || []) {
      bulkMap.set(c.id, {
        price: Number(c.bulk_price_per_lead),
        amId: c.account_manager_id,
        name: (c as { name?: string }).name || '',
      });
    }
    const bulkCustIds = [...bulkMap.keys()];
    let bulkAssignments: { customer_id: string }[] = [];
    let bulkTruncated = false;
    let offset = 0;
    for (let p = 0; p < BULK_MAX_PAGES; p++) {
      const { data } = await supabase
        .from('lead_assignments')
        .select('customer_id')
        .is('batch_id', null)
        .in('customer_id', bulkCustIds)
        .gte('assigned_at', monthStart)
        .range(offset, offset + BULK_PAGE - 1);
      if (!data?.length) break;
      bulkAssignments = bulkAssignments.concat(data);
      if (data.length < BULK_PAGE) break;
      offset += data.length;
      if (p === BULK_MAX_PAGES - 1) bulkTruncated = true;
    }
    const amBulkRevenue = new Map<string, number>();
    for (const a of bulkAssignments) {
      const info = bulkMap.get(a.customer_id);
      if (!info?.amId) continue;
      amBulkRevenue.set(info.amId, (amBulkRevenue.get(info.amId) || 0) + info.price);
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
      batch_id: string;
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

    for (const b of batches) {
      const amId = resolveBatchAmId(b);
      if (!amId) continue;
      const cust = b.customers as { name?: string } | null | undefined;
      const line: BatchLine = {
        batch_id: b.id,
        customer_name: cust?.name || '-',
        branch: b.branch || '-',
        batch_kind: b.batch_kind ?? null,
        total_price: Number(b.total_price) || 0,
        created_at: b.created_at || '',
        excluded: excludedIds.has(b.id),
        exclusion: exclusionMetaByBatch.get(b.id),
      };
      const bucket = ensureAm(amId);
      if (line.excluded) bucket.excluded_batches.push(line);
      else bucket.included_batches.push(line);
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

    const { first: rangeFirst, last: rangeLast } = calendarMonthDateBounds(yearMonth);
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
      bulk_assignments_truncated: bulkTruncated,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Onbekende fout';
    if (msg.includes('relation') && msg.includes('does not exist')) {
      return NextResponse.json(
        { error: 'Database-migratie 107 (am leaderboard) ontbreekt. Voer migraties uit.' },
        { status: 503 },
      );
    }
    console.error('[am-leaderboard-rules]', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
