import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { isAccountManagerScope } from '@/lib/prospects';

/**
 * Returns the open tasks for the logged-in user (or all tasks for admin/super
 * if explicitly requested with ?all=1).
 *
 * Buckets the result by overdue / today / this_week / later for the AM dashboard.
 */
export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const url = request.nextUrl;
  const all = url.searchParams.get('all') === '1' && !isAccountManagerScope(admin);
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '100')));

  const supabase = createServerClient();
  let query = supabase
    .from('prospect_tasks')
    .select('id, prospect_id, type, title, description, due_at, completed_at, assigned_to_admin_id, created_at, prospect:prospects(id, company_name, account_manager_id, status)')
    .is('completed_at', null);

  if (!all) {
    query = query.eq('assigned_to_admin_id', admin.id);
  }

  query = query.order('due_at', { ascending: true, nullsFirst: false }).limit(limit);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: 'Taken ophalen mislukt' }, { status: 500 });
  }

  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const endOfWeek = new Date(startOfToday);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const buckets = { overdue: 0, today: 0, this_week: 0, later: 0, no_date: 0 };
  const tasks = (data || []).map(t => {
    let bucket: keyof typeof buckets = 'no_date';
    if (t.due_at) {
      const due = new Date(t.due_at).getTime();
      if (due < startOfToday.getTime()) bucket = 'overdue';
      else if (due < endOfToday.getTime()) bucket = 'today';
      else if (due < endOfWeek.getTime()) bucket = 'this_week';
      else bucket = 'later';
    }
    buckets[bucket] += 1;
    return { ...t, bucket };
  });

  return NextResponse.json({ tasks, buckets, fetched_at: new Date(now).toISOString() });
}
