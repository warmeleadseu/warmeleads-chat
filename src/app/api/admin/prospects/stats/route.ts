import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { applyAmScope, PROSPECT_STATUSES } from '@/lib/prospects';

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();

  // Status counts
  let statusBase = supabase.from('prospects').select('status, account_manager_id, converted_at, created_at, next_action_at');
  statusBase = applyAmScope(statusBase, admin);

  const { data: rows } = await statusBase;
  const all = rows || [];

  const statusCounts: Record<string, number> = {};
  for (const s of PROSPECT_STATUSES) statusCounts[s] = 0;
  for (const r of all) {
    if (r.status in statusCounts) statusCounts[r.status] += 1;
  }

  // Conversies deze maand
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const conversionsThisMonth = all.filter(
    r => r.converted_at && new Date(r.converted_at) >= startOfMonth,
  ).length;

  // Mijn open prospects (alle die niet gewonnen/verloren/niet_relevant zijn)
  const openProspects = all.filter(
    r => r.status !== 'gewonnen' && r.status !== 'verloren' && r.status !== 'niet_relevant',
  ).length;

  // Tasks van logged-in user
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const endOfWeek = new Date(startOfToday);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const { data: myTasks } = await supabase
    .from('prospect_tasks')
    .select('id, due_at, completed_at')
    .eq('assigned_to_admin_id', admin.id)
    .is('completed_at', null);

  const tasks = myTasks || [];
  const tasksOverdue = tasks.filter(t => t.due_at && new Date(t.due_at) < startOfToday).length;
  const tasksToday = tasks.filter(
    t => t.due_at && new Date(t.due_at) >= startOfToday && new Date(t.due_at) < endOfToday,
  ).length;
  const tasksThisWeek = tasks.filter(
    t => t.due_at && new Date(t.due_at) >= endOfToday && new Date(t.due_at) < endOfWeek,
  ).length;

  // Recente activiteiten (laatste 5) op de prospects waar deze admin toegang toe heeft
  let activityQuery = supabase
    .from('prospect_activities')
    .select('id, prospect_id, type, title, created_at, prospect:prospects!inner(id, company_name, account_manager_id)')
    .order('created_at', { ascending: false })
    .limit(8);

  if (admin.role === 'accountmanager') {
    activityQuery = activityQuery.eq('prospect.account_manager_id', admin.id);
  }

  const { data: activities } = await activityQuery;

  return NextResponse.json({
    status_counts: statusCounts,
    open_prospects: openProspects,
    total_prospects: all.length,
    conversions_this_month: conversionsThisMonth,
    tasks: {
      total_open: tasks.length,
      overdue: tasksOverdue,
      today: tasksToday,
      this_week: tasksThisWeek,
    },
    recent_activities: activities || [],
  });
}
