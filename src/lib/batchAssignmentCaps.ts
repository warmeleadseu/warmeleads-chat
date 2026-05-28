import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Zelfde dag-/weekankers als `distributeLead` voor `leads_per_day` / `leads_per_week`
 * (maandag-week, `setHours(0,0,0,0)` op server-locale — zie bestaande comments in distribution).
 */
export function getLeadLimitPeriodAnchors(now: Date = new Date()): { dayStart: Date; weekStart: Date } {
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + (weekStart.getDay() === 0 ? -6 : 1));
  weekStart.setHours(0, 0, 0, 0);

  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);

  return { dayStart, weekStart };
}

type CapCountRow = {
  assigned_at: string | null;
  leads: { created_at?: string | null } | { created_at?: string | null }[] | null;
};

/**
 * Telt `lead_assignments` voor één batch in het huidige week/dag-venster.
 *
 * Telling gebeurt op **`lead.created_at`** (= wanneer de lead binnenkwam),
 * met `assigned_at` als fallback wanneer de lead-join ontbreekt. Dit is
 * semantisch correct voor de Meta-campagne cap-check: "hoeveel verse leads
 * heeft Meta vandaag/deze week voor deze batch opgeleverd?". Op die manier
 * tellen door `backfillBatch` zojuist toegewezen historische leads mee tegen
 * **hun eigen** kalenderdag (zoals backfill zelf ook al doet via
 * `backfillDayKey`/`backfillWeekKey`), niet tegen de dag waarop de assignment
 * werd ingeschreven. Voor verse Meta-leads zijn `assigned_at` en
 * `lead.created_at` praktisch identiek, dus het runtime gedrag van
 * `distributeLead` blijft consistent.
 */
export async function fetchBatchAssignmentCapCounts(
  supabase: SupabaseClient,
  batchId: string,
  now: Date = new Date(),
): Promise<{ todayCount: number; weekCount: number }> {
  const { dayStart, weekStart } = getLeadLimitPeriodAnchors(now);

  const { data } = await supabase
    .from('lead_assignments')
    .select('assigned_at, leads(created_at)')
    .eq('batch_id', batchId)
    .gte('assigned_at', weekStart.toISOString());

  let weekCount = 0;
  let todayCount = 0;
  const dayMs = dayStart.getTime();
  const weekMs = weekStart.getTime();

  for (const row of (data as CapCountRow[] | null) ?? []) {
    const joined = Array.isArray(row.leads) ? row.leads[0] : row.leads;
    const createdAtIso = joined?.created_at ?? null;
    const assignedAtIso = row.assigned_at;
    const referenceIso = createdAtIso ?? assignedAtIso;
    if (!referenceIso) continue;
    const t = new Date(referenceIso).getTime();
    if (Number.isNaN(t)) continue;
    if (t >= weekMs) weekCount++;
    if (t >= dayMs) todayCount++;
  }

  return { todayCount, weekCount };
}
