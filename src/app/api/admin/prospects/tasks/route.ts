import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { isAccountManagerScope, isValidStatus, type ProspectStatus } from '@/lib/prospects';

type TaskBucket = 'overdue' | 'today' | 'this_week' | 'later' | 'no_date';

function computeBucket(dueAt: string | null, completedAt: string | null): TaskBucket {
  if (completedAt) return 'no_date'; // completed: bucket niet gebruikt voor KPI-chips
  if (!dueAt) return 'no_date';
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const endOfWeek = new Date(startOfToday);
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  const due = new Date(dueAt).getTime();
  if (due < startOfToday.getTime()) return 'overdue';
  if (due < endOfToday.getTime()) return 'today';
  if (due < endOfWeek.getTime()) return 'this_week';
  return 'later';
}

/**
 * GET prospect_tasks met buckets (overdue / today / this_week / later / no_date).
 *
 * Standaard (zonder extra flags): open taken toegewezen aan ingelogde admin (bestaand gedrag).
 *
 * Query:
 * - all=1 — alleen admin/superadmin: open taken van iedereen (portfolio-overzicht team).
 * - portfolio=1 — alleen accountmanager: open taken op eigen prospects (prospect.account_manager_id).
 * - assigned_only=1 — combineert met portfolio=1: alleen taken toegewezen aan jou.
 * - task_status=open|done|all — open (default), afgerond, of beide (limiet hoger bij all).
 * - prospect_status=<ProspectStatus> — filter op pipeline-status van de prospect.
 * - search= — filter op titel of bedrijfsnaam (case-insensitive).
 * - limit= — max 500.
 * - from / to — ISO range filter op due_at (gebruikt door agenda-weergave).
 * - count_only=1 — alleen buckets, geen tasks-array (voor badge in nav).
 */
export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const url = request.nextUrl;
  const allOrg = url.searchParams.get('all') === '1' && !isAccountManagerScope(admin);
  const portfolio = url.searchParams.get('portfolio') === '1' && isAccountManagerScope(admin);
  const assignedOnly = url.searchParams.get('assigned_only') === '1';
  const taskStatus = url.searchParams.get('task_status') || 'open';
  const prospectStatusParam = url.searchParams.get('prospect_status')?.trim() || '';
  const searchRaw = url.searchParams.get('search')?.trim().toLowerCase() || '';
  const bucketFilter = url.searchParams.get('bucket') as TaskBucket | 'all' | null;

  const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get('limit') || '200', 10)));
  const countOnly = url.searchParams.get('count_only') === '1';
  const fromParam = url.searchParams.get('from');
  const toParam = url.searchParams.get('to');

  const supabase = createServerClient();

  let portfolioProspectIds: string[] | null = null;
  if (portfolio) {
    const { data: rows } = await supabase.from('prospects').select('id').eq('account_manager_id', admin.id);
    portfolioProspectIds = (rows || []).map(r => r.id);
    if (portfolioProspectIds.length === 0) {
      return emptyResponse();
    }
  }

  let query = supabase
    .from('prospect_tasks')
    .select(
      'id, prospect_id, type, title, description, due_at, completed_at, assigned_to_admin_id, created_at, prospect:prospects!inner(id, company_name, account_manager_id, status)',
    );

  if (taskStatus === 'open') {
    query = query.is('completed_at', null);
  } else if (taskStatus === 'done') {
    query = query.not('completed_at', 'is', null);
  }
  // task_status === 'all': geen filter op completed_at

  if (prospectStatusParam && isValidStatus(prospectStatusParam)) {
    query = query.eq('prospect.status', prospectStatusParam as ProspectStatus);
  }

  if (fromParam) {
    query = query.gte('due_at', fromParam);
  }
  if (toParam) {
    query = query.lt('due_at', toParam);
  }

  if (allOrg) {
    // alle open/all taken van iedereen
  } else if (portfolio && portfolioProspectIds) {
    query = query.in('prospect_id', portfolioProspectIds);
    if (assignedOnly) {
      query = query.eq('assigned_to_admin_id', admin.id);
    }
  } else {
    query = query.eq('assigned_to_admin_id', admin.id);
  }

  if (taskStatus === 'done') {
    query = query.order('completed_at', { ascending: false });
  } else if (taskStatus === 'all') {
    query = query
      .order('completed_at', { ascending: true, nullsFirst: true })
      .order('due_at', { ascending: true, nullsFirst: false });
  } else {
    query = query.order('due_at', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false });
  }

  query = query.limit(limit);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: 'Taken ophalen mislukt' }, { status: 500 });
  }

  let tasks = data || [];

  if (searchRaw) {
    tasks = tasks.filter(t => {
      const title = (t.title as string).toLowerCase();
      const company = (t.prospect as { company_name?: string } | null)?.company_name?.toLowerCase() || '';
      return title.includes(searchRaw) || company.includes(searchRaw);
    });
  }

  const assigneeIds = [...new Set(tasks.map(t => t.assigned_to_admin_id).filter(Boolean))] as string[];
  let assigneeMap = new Map<string, string>();
  if (assigneeIds.length > 0) {
    const { data: admins } = await supabase.from('admin_users').select('id, name').in('id', assigneeIds);
    assigneeMap = new Map((admins || []).map(a => [a.id, a.name]));
  }

  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const endOfWeek = new Date(startOfToday);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const buckets = { overdue: 0, today: 0, this_week: 0, later: 0, no_date: 0 };
  const withMeta = tasks.map(t => {
    const completedAt = t.completed_at as string | null;
    const dueAt = t.due_at as string | null;
    const bucket = computeBucket(dueAt, completedAt);
    if (!completedAt) {
      if (dueAt) {
        const due = new Date(dueAt).getTime();
        if (due < startOfToday.getTime()) buckets.overdue += 1;
        else if (due < endOfToday.getTime()) buckets.today += 1;
        else if (due < endOfWeek.getTime()) buckets.this_week += 1;
        else buckets.later += 1;
      } else {
        buckets.no_date += 1;
      }
    }
    const aid = t.assigned_to_admin_id as string | null;
    return {
      ...t,
      bucket,
      assignee_name: aid ? assigneeMap.get(aid) || null : null,
    };
  });

  let filtered = withMeta;
  if (bucketFilter && bucketFilter !== 'all' && taskStatus !== 'done') {
    filtered = withMeta.filter(t => t.bucket === bucketFilter);
  }

  if (countOnly) {
    return NextResponse.json({
      buckets,
      fetched_at: new Date(now).toISOString(),
    });
  }

  return NextResponse.json({
    tasks: filtered,
    buckets,
    fetched_at: new Date(now).toISOString(),
    meta: {
      portfolio: !!portfolio,
      assigned_only: !!assignedOnly,
      all_org: !!allOrg,
      task_status: taskStatus,
    },
  });
}

function emptyResponse() {
  const buckets = { overdue: 0, today: 0, this_week: 0, later: 0, no_date: 0 };
  return NextResponse.json({
    tasks: [],
    buckets,
    fetched_at: new Date().toISOString(),
    meta: { portfolio: true, assigned_only: false, all_org: false, task_status: 'open' },
  });
}
