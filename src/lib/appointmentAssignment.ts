import { createServerClient } from './supabase';
import type { AssignmentRules } from './portalPermissions';

interface AppointmentContext {
  branch: string;
  postcode?: string | null;
  starts_at: string;
}

/**
 * Auto-pick a portal user to assign an appointment to, based on assignment_rules.
 * Returns null if no candidate matches (admin can leave unassigned).
 *
 * Logic:
 *  - Skip agents with mode='manual' (they won't auto-receive)
 *  - Respect branch/region constraints
 *  - Respect daily/weekly appointment caps
 *  - Weighted round-robin by (weight / current workload)
 */
export async function pickAppointmentAssignee(
  customerId: string,
  ctx: AppointmentContext,
): Promise<string | null> {
  const supabase = createServerClient();

  const { data: agents } = await supabase
    .from('portal_users')
    .select('id, assignment_rules, role')
    .eq('customer_id', customerId)
    .eq('is_active', true);

  if (!agents || agents.length === 0) return null;

  const startsAt = new Date(ctx.starts_at);
  const dayStart = new Date(startsAt); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
  const weekStart = new Date(dayStart);
  const dow = weekStart.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  weekStart.setDate(weekStart.getDate() + mondayOffset);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);

  const candidates = agents.filter(a => {
    const rules: AssignmentRules = a.assignment_rules || {};
    if (!rules.mode || rules.mode === 'manual') return false;
    if (rules.mode === 'all') return true;

    if (rules.branches && rules.branches.length > 0 && !rules.branches.includes(ctx.branch)) return false;

    if (rules.regions && rules.regions.values.length > 0 && ctx.postcode) {
      if (rules.regions.type === 'postcodes') {
        const pc4 = ctx.postcode.replace(/\s/g, '').slice(0, 4);
        if (!rules.regions.values.some(v => pc4.startsWith(v.replace(/\s/g, '').slice(0, 4)))) return false;
      }
    }
    return true;
  });

  if (candidates.length === 0) return null;

  const ids = candidates.map(c => c.id);
  const [dayRes, weekRes] = await Promise.all([
    supabase
      .from('appointments')
      .select('portal_user_id')
      .eq('customer_id', customerId)
      .in('portal_user_id', ids)
      .in('status', ['scheduled', 'completed'])
      .gte('starts_at', dayStart.toISOString())
      .lt('starts_at', dayEnd.toISOString()),
    supabase
      .from('appointments')
      .select('portal_user_id')
      .eq('customer_id', customerId)
      .in('portal_user_id', ids)
      .in('status', ['scheduled', 'completed'])
      .gte('starts_at', weekStart.toISOString())
      .lt('starts_at', weekEnd.toISOString()),
  ]);

  const dayCount: Record<string, number> = {};
  const weekCount: Record<string, number> = {};
  (dayRes.data || []).forEach((r: { portal_user_id: string }) => { dayCount[r.portal_user_id] = (dayCount[r.portal_user_id] || 0) + 1; });
  (weekRes.data || []).forEach((r: { portal_user_id: string }) => { weekCount[r.portal_user_id] = (weekCount[r.portal_user_id] || 0) + 1; });

  const eligible = candidates.filter(a => {
    const rules: AssignmentRules = a.assignment_rules || {};
    const d = dayCount[a.id] || 0;
    const w = weekCount[a.id] || 0;
    if (rules.max_appointments_per_day && d >= rules.max_appointments_per_day) return false;
    if (rules.max_appointments_per_week && w >= rules.max_appointments_per_week) return false;
    return true;
  });

  if (eligible.length === 0) return null;

  eligible.sort((a, b) => {
    const ra: AssignmentRules = a.assignment_rules || {};
    const rb: AssignmentRules = b.assignment_rules || {};
    const wa = (ra.round_robin_weight ?? 1) / Math.max(1, (weekCount[a.id] || 0) + 1);
    const wb = (rb.round_robin_weight ?? 1) / Math.max(1, (weekCount[b.id] || 0) + 1);
    if (wb !== wa) return wb - wa;
    return (weekCount[a.id] || 0) - (weekCount[b.id] || 0);
  });

  return eligible[0].id;
}
