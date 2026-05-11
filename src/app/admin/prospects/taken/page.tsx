'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  BriefcaseIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  ListBulletIcon,
  MagnifyingGlassIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';
import { useAdmin } from '@/app/admin/adminContext';
import {
  PROSPECT_STATUS_LABELS,
  PROSPECT_STATUSES,
  type ProspectStatus,
} from '@/lib/prospects';
import { StatusBadge } from '../_components/StatusBadge';

type Tab = 'tasks' | 'agenda' | 'activities';
type TaskBucket = 'overdue' | 'today' | 'this_week' | 'later' | 'no_date';

interface ProspectRef {
  id: string;
  company_name: string;
  account_manager_id: string | null;
  status: ProspectStatus;
}

interface TaskRow {
  id: string;
  prospect_id: string;
  type: string;
  title: string;
  description: string | null;
  due_at: string | null;
  completed_at: string | null;
  assigned_to_admin_id: string | null;
  created_at: string;
  prospect: ProspectRef;
  bucket: TaskBucket;
  assignee_name: string | null;
}

interface ActivityRow {
  id: string;
  prospect_id: string;
  type: string;
  title: string;
  body: string | null;
  created_at: string;
  admin_user_id: string | null;
  prospect: { id: string; company_name: string; status: ProspectStatus } | null;
  actor_name: string | null;
}

const BUCKET_LABELS: Record<TaskBucket, string> = {
  overdue: 'Verlopen',
  today: 'Vandaag',
  this_week: 'Deze week',
  later: 'Later',
  no_date: 'Zonder datum',
};

const BUCKET_STYLE: Record<TaskBucket, string> = {
  overdue: 'border-rose-200 bg-rose-50 text-rose-700',
  today: 'border-orange-200 bg-orange-50 text-orange-700',
  this_week: 'border-amber-200 bg-amber-50 text-amber-700',
  later: 'border-slate-200 bg-slate-50 text-slate-600',
  no_date: 'border-slate-200 bg-white text-slate-500',
};

const TYPE_LABELS: Record<string, string> = {
  todo: 'To-do',
  call: 'Bellen',
  email: 'E-mail',
  meeting: 'Afspraak',
  followup: 'Opvolgen',
};

const TYPE_STYLE: Record<string, string> = {
  todo: 'bg-slate-100 text-slate-700',
  call: 'bg-sky-100 text-sky-700',
  email: 'bg-indigo-100 text-indigo-700',
  meeting: 'bg-emerald-100 text-emerald-700',
  followup: 'bg-amber-100 text-amber-700',
};

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // ma=0
  d.setDate(d.getDate() - dow);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default function ProspectTasksOverviewPage() {
  const { user } = useAdmin();
  const router = useRouter();
  const searchParams = useSearchParams();

  const isAm = user.role === 'accountmanager';
  const canTeamView = user.role === 'admin' || user.role === 'superadmin';

  const initialTab = ((): Tab => {
    const t = searchParams.get('tab');
    if (t === 'activities' || t === 'agenda') return t;
    return 'tasks';
  })();

  const [tab, setTab] = useState<Tab>(initialTab);

  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [buckets, setBuckets] = useState<Record<TaskBucket, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [portfolio, setPortfolio] = useState(isAm);
  const [assignedOnly, setAssignedOnly] = useState(false);
  const [teamAll, setTeamAll] = useState(false);
  const [taskStatus, setTaskStatus] = useState<'open' | 'done' | 'all'>('open');
  const [prospectStatus, setProspectStatus] = useState<string>('all');
  const [bucket, setBucket] = useState<TaskBucket | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);

  const [agendaWeekStart, setAgendaWeekStart] = useState(() => startOfWeek(new Date()));
  const [agendaTasks, setAgendaTasks] = useState<TaskRow[]>([]);
  const [agendaLoading, setAgendaLoading] = useState(false);

  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [actLoading, setActLoading] = useState(false);

  const buildTaskQuery = useCallback(
    (extra?: Record<string, string>) => {
      const p = new URLSearchParams();
      p.set('limit', '300');
      if (deferredSearch.trim()) p.set('search', deferredSearch.trim());
      if (prospectStatus !== 'all') p.set('prospect_status', prospectStatus);
      p.set('task_status', taskStatus);
      if (bucket !== 'all') p.set('bucket', bucket);

      if (canTeamView && teamAll) {
        p.set('all', '1');
      } else if (isAm && portfolio) {
        p.set('portfolio', '1');
        if (assignedOnly) p.set('assigned_only', '1');
      }

      if (extra) for (const [k, v] of Object.entries(extra)) p.set(k, v);
      return p.toString();
    },
    [
      assignedOnly,
      bucket,
      canTeamView,
      isAm,
      portfolio,
      prospectStatus,
      deferredSearch,
      taskStatus,
      teamAll,
    ],
  );

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch(`/api/admin/prospects/tasks?${buildTaskQuery()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Taken laden mislukt');
        setTasks([]);
        setBuckets(null);
        return;
      }
      let list: TaskRow[] = data.tasks || [];
      if (typeFilter !== 'all') list = list.filter(t => t.type === typeFilter);
      setTasks(list);
      setBuckets(data.buckets || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Taken laden mislukt');
    } finally {
      setLoading(false);
    }
  }, [buildTaskQuery, typeFilter]);

  const fetchAgenda = useCallback(async () => {
    setAgendaLoading(true);
    try {
      const from = agendaWeekStart.toISOString();
      const to = addDays(agendaWeekStart, 7).toISOString();
      const query = buildTaskQuery({ from, to, task_status: 'all' });
      const res = await adminFetch(`/api/admin/prospects/tasks?${query}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        let list: TaskRow[] = data.tasks || [];
        if (typeFilter !== 'all') list = list.filter(t => t.type === typeFilter);
        setAgendaTasks(list);
      } else {
        setAgendaTasks([]);
      }
    } finally {
      setAgendaLoading(false);
    }
  }, [agendaWeekStart, buildTaskQuery, typeFilter]);

  useEffect(() => {
    if (tab === 'tasks') fetchTasks();
  }, [tab, fetchTasks]);

  useEffect(() => {
    if (tab === 'agenda') fetchAgenda();
  }, [tab, fetchAgenda]);

  const fetchActivities = useCallback(async () => {
    setActLoading(true);
    try {
      const res = await adminFetch('/api/admin/prospects/activities-feed?limit=100');
      const data = await res.json().catch(() => ({}));
      if (res.ok) setActivities(data.activities || []);
      else setActivities([]);
    } finally {
      setActLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'activities') fetchActivities();
  }, [tab, fetchActivities]);

  const setTabAndUrl = (next: Tab) => {
    setTab(next);
    const p = new URLSearchParams(searchParams.toString());
    if (next === 'tasks') p.delete('tab');
    else p.set('tab', next);
    router.replace(`/admin/prospects/taken${p.toString() ? `?${p}` : ''}`, { scroll: false });
  };

  const patchTask = async (id: string, body: Record<string, unknown>) => {
    const res = await adminFetch(`/api/admin/prospects/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || 'Bijwerken mislukt');
      return false;
    }
    return true;
  };

  const completeTask = async (t: TaskRow) => {
    if (t.completed_at) return;
    const completedAt = new Date().toISOString();
    setTasks(cur => cur.map(x => (x.id === t.id ? { ...x, completed_at: completedAt } : x)));
    setAgendaTasks(cur => cur.map(x => (x.id === t.id ? { ...x, completed_at: completedAt } : x)));
    const ok = await patchTask(t.id, { completed: true });
    if (!ok) {
      setTasks(cur => cur.map(x => (x.id === t.id ? { ...x, completed_at: null } : x)));
      setAgendaTasks(cur => cur.map(x => (x.id === t.id ? { ...x, completed_at: null } : x)));
    } else if (tab === 'tasks') fetchTasks();
    else if (tab === 'agenda') fetchAgenda();
  };

  const snoozeTask = async (t: TaskRow, hours: number) => {
    const base = t.due_at ? new Date(t.due_at) : new Date();
    if (!t.due_at) base.setHours(9, 0, 0, 0);
    const next = new Date(base.getTime() + hours * 60 * 60 * 1000);
    const iso = next.toISOString();
    setTasks(cur => cur.map(x => (x.id === t.id ? { ...x, due_at: iso } : x)));
    setAgendaTasks(cur => cur.map(x => (x.id === t.id ? { ...x, due_at: iso } : x)));
    const ok = await patchTask(t.id, { due_at: iso });
    if (ok && tab === 'tasks') fetchTasks();
    else if (ok && tab === 'agenda') fetchAgenda();
  };

  const bucketChips = useMemo(() => {
    if (!buckets || taskStatus !== 'open') return [];
    const order: TaskBucket[] = ['overdue', 'today', 'this_week', 'later', 'no_date'];
    return order.map(k => ({ key: k, label: BUCKET_LABELS[k], count: buckets[k] }));
  }, [buckets, taskStatus]);

  const agendaByDay = useMemo(() => {
    const map = new Map<string, TaskRow[]>();
    for (let i = 0; i < 7; i++) {
      map.set(isoDay(addDays(agendaWeekStart, i)), []);
    }
    for (const t of agendaTasks) {
      if (!t.due_at) continue;
      const key = isoDay(new Date(t.due_at));
      const list = map.get(key);
      if (list) list.push(t);
    }
    return map;
  }, [agendaTasks, agendaWeekStart]);

  const weekLabel = useMemo(() => {
    const end = addDays(agendaWeekStart, 6);
    const f = (d: Date) =>
      d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
    return `${f(agendaWeekStart)} – ${f(end)}`;
  }, [agendaWeekStart]);

  const icsHref = `/api/admin/prospects/tasks/ics${isAm && portfolio ? '?portfolio=1' : ''}`;
  const allowedTypes = ['todo', 'call', 'email', 'meeting', 'followup'];

  return (
    <div className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 sm:text-2xl">
            <ListBulletIcon className="h-6 w-6 text-brand-purple sm:h-7 sm:w-7" />
            Mijn taken &amp; activiteit
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Cross-prospect overzicht — niet alleen per kaartje in het drawer. Wissel naar agenda voor weekplanning.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={icsHref}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            title="Download .ics om in Outlook / Apple / Google Calendar te importeren"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            Exporteer .ics
          </a>
          <Link
            href="/admin/prospects"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <BriefcaseIcon className="h-4 w-4" />
            Naar prospects
          </Link>
          <button
            type="button"
            onClick={() => {
              if (tab === 'tasks') fetchTasks();
              else if (tab === 'agenda') fetchAgenda();
              else fetchActivities();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading || actLoading || agendaLoading ? 'animate-spin' : ''}`} />
            Vernieuwen
          </button>
        </div>
      </header>

      <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50/80 p-1 sm:inline-flex">
        <TabButton active={tab === 'tasks'} onClick={() => setTabAndUrl('tasks')} icon={ListBulletIcon}>
          Lijst
        </TabButton>
        <TabButton active={tab === 'agenda'} onClick={() => setTabAndUrl('agenda')} icon={CalendarDaysIcon}>
          Agenda
        </TabButton>
        <TabButton active={tab === 'activities'} onClick={() => setTabAndUrl('activities')} icon={ClipboardDocumentListIcon}>
          Activiteit
        </TabButton>
      </div>

      {(tab === 'tasks' || tab === 'agenda') && (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:flex-wrap lg:items-end">
          {isAm && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={portfolio}
                onChange={e => {
                  setPortfolio(e.target.checked);
                  if (!e.target.checked) setAssignedOnly(false);
                }}
                className="rounded border-slate-300 text-brand-purple focus:ring-brand-purple"
              />
              Mijn prospect-portfolio
            </label>
          )}
          {isAm && portfolio && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={assignedOnly}
                onChange={e => setAssignedOnly(e.target.checked)}
                className="rounded border-slate-300 text-brand-purple focus:ring-brand-purple"
              />
              Alleen aan mij toegewezen
            </label>
          )}
          {canTeamView && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={teamAll}
                onChange={e => setTeamAll(e.target.checked)}
                className="rounded border-slate-300 text-brand-purple focus:ring-brand-purple"
              />
              Teamweergave (alle AM&apos;s)
            </label>
          )}
          <div className="flex flex-wrap gap-2 lg:ml-auto">
            {tab === 'tasks' && (
              <select
                value={taskStatus}
                onChange={e => {
                  setTaskStatus(e.target.value as typeof taskStatus);
                  setBucket('all');
                }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="open">Open taken</option>
                <option value="done">Afgerond</option>
                <option value="all">Alles (open + afgerond)</option>
              </select>
            )}
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="all">Alle types</option>
              {allowedTypes.map(t => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <select
              value={prospectStatus}
              onChange={e => setProspectStatus(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="all">Alle pipeline-statussen</option>
              {PROSPECT_STATUSES.map(s => (
                <option key={s} value={s}>
                  {PROSPECT_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="relative w-full lg:w-72">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Zoek op titel of bedrijf…"
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-purple/40"
            />
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      )}

      {tab === 'tasks' && (
        <>
          {taskStatus === 'open' && bucketChips.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setBucket('all')}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  bucket === 'all' ? 'bg-brand-purple text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Alle buckets
              </button>
              {bucketChips.map(b => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => setBucket(prev => (prev === b.key ? 'all' : b.key))}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    bucket === b.key ? 'bg-brand-purple text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {b.label} ({b.count})
                </button>
              ))}
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {loading ? (
              <div className="h-48 animate-pulse bg-slate-50" />
            ) : tasks.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-slate-500">Geen taken gevonden met deze filters.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Deadline</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Taak</th>
                      <th className="px-4 py-3">Prospect</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Toegewezen</th>
                      <th className="px-4 py-3 text-right">Actie</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tasks.map(t => {
                      const open = !t.completed_at;
                      const dueLabel = t.due_at
                        ? new Date(t.due_at).toLocaleString('nl-NL', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—';
                      return (
                        <tr key={t.id} className={open ? 'bg-white' : 'bg-slate-50/80'}>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                            <span
                              className={`mb-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${BUCKET_STYLE[t.bucket]}`}
                            >
                              {BUCKET_LABELS[t.bucket]}
                            </span>
                            <div>{dueLabel}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                TYPE_STYLE[t.type] || 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {TYPE_LABELS[t.type] || t.type}
                            </span>
                          </td>
                          <td className="max-w-xs px-4 py-3">
                            <p className={`font-medium text-slate-900 ${!open ? 'line-through opacity-70' : ''}`}>{t.title}</p>
                            {t.description && (
                              <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{t.description}</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              href={`/admin/prospects?id=${t.prospect_id}`}
                              className="font-medium text-brand-purple hover:underline"
                            >
                              {t.prospect?.company_name || 'Prospect'}
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            {t.prospect?.status ? <StatusBadge status={t.prospect.status} /> : '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{t.assignee_name || '—'}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            {open ? (
                              <div className="flex justify-end gap-1.5">
                                <SnoozeMenu onSnooze={hours => snoozeTask(t, hours)} />
                                <button
                                  type="button"
                                  onClick={() => completeTask(t)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                                >
                                  <CheckCircleIcon className="h-3.5 w-3.5" />
                                  Afronden
                                </button>
                                <Link
                                  href={`/admin/prospects?id=${t.prospect_id}`}
                                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  Open
                                </Link>
                              </div>
                            ) : (
                              <Link
                                href={`/admin/prospects?id=${t.prospect_id}`}
                                className="text-xs font-semibold text-brand-purple hover:underline"
                              >
                                Bekijk prospect
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'agenda' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAgendaWeekStart(prev => addDays(prev, -7))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                aria-label="Vorige week"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setAgendaWeekStart(startOfWeek(new Date()))}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Vandaag
              </button>
              <button
                type="button"
                onClick={() => setAgendaWeekStart(prev => addDays(prev, 7))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                aria-label="Volgende week"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm font-semibold text-slate-700">{weekLabel}</p>
            <p className="text-xs text-slate-500">
              {agendaTasks.filter(t => !t.completed_at).length} open · {agendaTasks.filter(t => t.completed_at).length} afgerond
            </p>
          </div>

          {agendaLoading ? (
            <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
              {Array.from({ length: 7 }).map((_, i) => {
                const day = addDays(agendaWeekStart, i);
                const key = isoDay(day);
                const items = agendaByDay.get(key) || [];
                const today = isoDay(new Date()) === key;
                return (
                  <div
                    key={key}
                    className={`flex flex-col rounded-xl border bg-white shadow-sm ${
                      today ? 'border-brand-purple/60 ring-1 ring-brand-purple/30' : 'border-slate-200'
                    }`}
                  >
                    <header className={`flex items-baseline justify-between rounded-t-xl px-3 py-2 ${today ? 'bg-brand-purple/10' : 'bg-slate-50/60'}`}>
                      <div>
                        <p className={`text-[11px] font-semibold uppercase tracking-wider ${today ? 'text-brand-purple' : 'text-slate-500'}`}>
                          {day.toLocaleDateString('nl-NL', { weekday: 'short' })}
                        </p>
                        <p className="text-sm font-bold text-slate-900">
                          {day.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                      {items.length > 0 && (
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                          {items.length}
                        </span>
                      )}
                    </header>
                    <div className="flex-1 space-y-1.5 p-2">
                      {items.length === 0 ? (
                        <p className="py-4 text-center text-[11px] text-slate-400">—</p>
                      ) : (
                        items
                          .sort((a, b) => (a.due_at || '').localeCompare(b.due_at || ''))
                          .map(t => {
                            const time = t.due_at
                              ? new Date(t.due_at).toLocaleTimeString('nl-NL', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '';
                            const done = !!t.completed_at;
                            return (
                              <Link
                                key={t.id}
                                href={`/admin/prospects?id=${t.prospect_id}`}
                                className={`block rounded-lg border px-2 py-1.5 text-xs transition hover:border-brand-purple/40 hover:shadow-sm ${
                                  done
                                    ? 'border-slate-200 bg-slate-50 text-slate-400 line-through'
                                    : 'border-slate-200 bg-white text-slate-700'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-mono text-[10px] text-slate-500">{time}</span>
                                  <span
                                    className={`rounded-full px-1.5 py-px text-[9px] font-semibold ${
                                      TYPE_STYLE[t.type] || 'bg-slate-100 text-slate-700'
                                    }`}
                                  >
                                    {TYPE_LABELS[t.type] || t.type}
                                  </span>
                                </div>
                                <p className="mt-0.5 line-clamp-2 text-[12px] font-medium text-slate-900">{t.title}</p>
                                <p className="line-clamp-1 text-[10px] text-slate-500">{t.prospect?.company_name}</p>
                              </Link>
                            );
                          })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="flex items-center gap-1 text-xs text-slate-500">
            <ClockIcon className="h-3.5 w-3.5" />
            Taken zonder einddatum verschijnen niet in de agenda — open de lijstweergave om ze in te plannen.
          </p>
        </div>
      )}

      {tab === 'activities' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {actLoading ? (
            <div className="h-40 animate-pulse bg-slate-50" />
          ) : activities.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-slate-500">Nog geen activiteiten in jouw bereik.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {activities.map(a => (
                <li key={a.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{a.title}</p>
                    <p className="text-xs text-slate-500">
                      {a.prospect?.company_name ? (
                        <Link href={`/admin/prospects?id=${a.prospect_id}`} className="text-brand-purple hover:underline">
                          {a.prospect.company_name}
                        </Link>
                      ) : (
                        'Prospect'
                      )}
                      {' · '}
                      <span className="uppercase">{a.type}</span>
                      {a.actor_name && ` · ${a.actor_name}`}
                    </p>
                    {a.body && <p className="mt-1 line-clamp-2 text-xs text-slate-600">{a.body}</p>}
                  </div>
                  <time className="shrink-0 text-xs text-slate-400" dateTime={a.created_at}>
                    {new Date(a.created_at).toLocaleString('nl-NL', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold sm:flex-initial ${
        active ? 'bg-white text-brand-purple shadow-sm' : 'text-slate-600 hover:text-slate-900'
      }`}
    >
      <span className="inline-flex items-center justify-center gap-2">
        <Icon className="h-4 w-4" />
        {children}
      </span>
    </button>
  );
}

function SnoozeMenu({ onSnooze }: { onSnooze: (hours: number) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        aria-label="Uitstellen"
      >
        <ClockIcon className="h-3.5 w-3.5" />
        Snooze
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-40 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          <SnoozeItem onClick={() => onSnooze(3)}>+3 uur</SnoozeItem>
          <SnoozeItem onClick={() => onSnooze(24)}>Morgen</SnoozeItem>
          <SnoozeItem onClick={() => onSnooze(24 * 3)}>+3 dagen</SnoozeItem>
          <SnoozeItem onClick={() => onSnooze(24 * 7)}>Volgende week</SnoozeItem>
        </div>
      )}
    </div>
  );
}

function SnoozeItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={e => e.preventDefault()}
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
    >
      <PlusIcon className="h-3 w-3 text-slate-400" />
      {children}
    </button>
  );
}
