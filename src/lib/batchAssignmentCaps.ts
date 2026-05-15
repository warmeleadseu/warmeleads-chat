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

/**
 * Telt `lead_assignments` voor één batch sinds `weekStart`, plus "vandaag" sinds `dayStart`
 * — identiek aan de filters in `distributeLead`.
 */
export async function fetchBatchAssignmentCapCounts(
  supabase: SupabaseClient,
  batchId: string,
  now: Date = new Date(),
): Promise<{ todayCount: number; weekCount: number }> {
  const { dayStart, weekStart } = getLeadLimitPeriodAnchors(now);

  const { data } = await supabase
    .from('lead_assignments')
    .select('assigned_at')
    .eq('batch_id', batchId)
    .gte('assigned_at', weekStart.toISOString());

  let weekCount = 0;
  let todayCount = 0;
  const dayMs = dayStart.getTime();

  for (const row of data ?? []) {
    weekCount++;
    const t = new Date(row.assigned_at as string).getTime();
    if (!Number.isNaN(t) && t >= dayMs) todayCount++;
  }

  return { todayCount, weekCount };
}
