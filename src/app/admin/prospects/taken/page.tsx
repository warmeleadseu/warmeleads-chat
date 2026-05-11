'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowPathIcon,
  BriefcaseIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  ListBulletIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';
import { useAdmin } from '@/app/admin/adminContext';
import {
  PROSPECT_STATUS_LABELS,
  PROSPECT_STATUSES,
  type ProspectStatus,
} from '@/lib/prospects';
import { StatusBadge } from '../_components/StatusBadge';

type Tab = 'tasks' | 'activities';

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

const TYPE_LABELS: Record<string, string> = {
  todo: 'To-do',
  call: 'Bellen',
  email: 'E-mail',
  meeting: 'Afspraak',
  followup: 'Opvolgen',
};

export default function ProspectTasksOverviewPage() {
  const { user } = useAdmin();
  const router = useRouter();
  const searchParams = useSearchParams();

  const isAm = user.role === 'accountmanager';
  const canTeamView = user.role === 'admin' || user.role === 'superadmin';

  const [tab, setTab] = useState<Tab>((searchParams.get('tab') as Tab) === 'activities' ? 'activities' : 'tasks');

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
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);

  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [actLoading, setActLoading] = useState(false);

  const buildTaskQuery = useCallback(() => {
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
    return p.toString();
  }, [
    assignedOnly,
    bucket,
    canTeamView,
    isAm,
    portfolio,
    prospectStatus,
    deferredSearch,
    taskStatus,
    teamAll,
  ]);

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
      setTasks(data.tasks || []);
      setBuckets(data.buckets || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Taken laden mislukt');
    } finally {
      setLoading(false);
    }
  }, [buildTaskQuery]);

  useEffect(() => {
    if (tab === 'tasks') fetchTasks();
  }, [tab, fetchTasks]);

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
    if (next === 'activities') p.set('tab', 'activities');
    else p.delete('tab');
    router.replace(`/admin/prospects/taken${p.toString() ? `?${p}` : ''}`, { scroll: false });
  };

  const completeTask = async (t: TaskRow) => {
    if (t.completed_at) return;
    const prev = tasks;
    setTasks(cur => cur.map(x => (x.id === t.id ? { ...x, completed_at: new Date().toISOString() } : x)));
    const res = await adminFetch(`/api/admin/prospects/tasks/${t.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed: true }),
    });
    if (!res.ok) {
      setTasks(prev);
      const d = await res.json().catch(() => ({}));
      setError(d.error || 'Afronden mislukt');
    } else {
      fetchTasks();
    }
  };

  const bucketChips = useMemo(() => {
    if (!buckets || taskStatus !== 'open') return [];
    const order: TaskBucket[] = ['overdue', 'today', 'this_week', 'later', 'no_date'];
    return order.map(k => ({ key: k, label: BUCKET_LABELS[k], count: buckets[k] }));
  }, [buckets, taskStatus]);

  return (
    <div className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 sm:text-2xl">
            <ListBulletIcon className="h-6 w-6 text-brand-purple sm:h-7 sm:w-7" />
            Prospect taken &amp; activiteit
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Openstaande taken en recente activiteiten over al je prospects heen — niet alleen per kaartje in het drawer.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/prospects"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <BriefcaseIcon className="h-4 w-4" />
            Naar prospects
          </Link>
          <button
            type="button"
            onClick={() => (tab === 'tasks' ? fetchTasks() : fetchActivities())}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading || actLoading ? 'animate-spin' : ''}`} />
            Vernieuwen
          </button>
        </div>
      </header>

      <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50/80 p-1 sm:inline-flex">
        <button
          type="button"
          onClick={() => setTabAndUrl('tasks')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold sm:flex-initial ${
            tab === 'tasks' ? 'bg-white text-brand-purple shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="inline-flex items-center justify-center gap-2">
            <CalendarDaysIcon className="h-4 w-4" />
            Taken
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTabAndUrl('activities')}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold sm:flex-initial ${
            tab === 'activities' ? 'bg-white text-brand-purple shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="inline-flex items-center justify-center gap-2">
            <ClipboardDocumentListIcon className="h-4 w-4" />
            Activiteitenfeed
          </span>
        </button>
      </div>

      {tab === 'tasks' && (
        <>
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
                Mijn prospect-portfolio (alle open taken op mijn prospects)
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
                Teamweergave (alle accountmanagers)
              </label>
            )}
            <div className="flex flex-wrap gap-2 lg:ml-auto">
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

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
          )}

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
                            <span className="block text-xs font-medium text-slate-500">{BUCKET_LABELS[t.bucket]}</span>
                            {dueLabel}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{TYPE_LABELS[t.type] || t.type}</td>
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
                              <div className="flex justify-end gap-2">
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
