import type { SupabaseClient } from '@supabase/supabase-js';

const AMSTERDAM_TZ = 'Europe/Amsterdam';
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Wall-clock componenten van een instant in Europe/Amsterdam (incl. weekdag).
 * Zo kunnen we dag-/weekgrenzen op de Nederlandse tijdzone bepalen i.p.v. op de
 * (UTC-)servertijd — anders "reset" een dagcap rond 01:00/02:00 lokale tijd.
 */
function amsterdamWallParts(now: Date): {
  year: number; month: number; day: number;
  hour: number; minute: number; second: number; weekday: number;
} {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: AMSTERDAM_TZ,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short',
  });
  const parts = fmt.formatToParts(now);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '0';
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  let hour = parseInt(get('hour'), 10);
  if (hour === 24) hour = 0; // sommige runtimes geven '24' voor middernacht
  return {
    year: parseInt(get('year'), 10),
    month: parseInt(get('month'), 10),
    day: parseInt(get('day'), 10),
    hour,
    minute: parseInt(get('minute'), 10),
    second: parseInt(get('second'), 10),
    weekday: weekdayMap[get('weekday')] ?? 0,
  };
}

/**
 * Dag-/weekankers voor `leads_per_day` / `leads_per_week`, berekend op
 * **Europe/Amsterdam** (maandag-week). De levering-cap telt op `assigned_at`;
 * deze ankers bepalen de vensters. Meta-pacing telt bewust op `lead.created_at`
 * (zie `fetchBatchAssignmentCapCounts`), maar gebruikt dezelfde dag-/weekgrenzen.
 */
export function getLeadLimitPeriodAnchors(now: Date = new Date()): { dayStart: Date; weekStart: Date } {
  const p = amsterdamWallParts(now);
  // Start van de Amsterdamse dag = nu minus de lokale tijd-van-de-dag.
  const timeOfDayMs = ((p.hour * 60 + p.minute) * 60 + p.second) * 1000;
  const dayStart = new Date(now.getTime() - timeOfDayMs);
  // Maandag-gebaseerde week: dagen sinds maandag = (weekday + 6) % 7.
  const daysSinceMonday = (p.weekday + 6) % 7;
  const weekStart = new Date(dayStart.getTime() - daysSinceMonday * DAY_MS);
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
