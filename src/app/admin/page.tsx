'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ChartBarSquareIcon,
  UserGroupIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ClockIcon,
  ChevronRightIcon,
  MapPinIcon,
  ArrowsRightLeftIcon,
  CalendarDaysIcon,
  InboxIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';

interface PeriodStat { leads: number; prevLeads: number; assigned: number; prevAssigned: number; }

interface Stats {
  total: number;
  thisWeek: number;
  thisMonth: number;
  byStatus: Record<string, number>;
  byBranch: Record<string, number>;
  byCustomer: Record<string, number>;
  recentLeads: any[];
  periodStats: Record<string, PeriodStat>;
}

interface BranchMeta { slug: string; name: string; color: string; }

interface BatchInfo {
  id: string; customer_id: string; branch: string;
  batch_size: number; leads_delivered: number; status: string;
  customers?: { name: string };
}

const BRANCH_COLOR_MAP: Record<string, { dot: string; light: string; text: string; bar: string }> = {
  emerald: { dot: 'bg-emerald-500', light: 'bg-emerald-100', text: 'text-emerald-700', bar: 'bg-emerald-500' },
  sky: { dot: 'bg-sky-500', light: 'bg-sky-100', text: 'text-sky-700', bar: 'bg-sky-500' },
  amber: { dot: 'bg-amber-500', light: 'bg-amber-100', text: 'text-amber-700', bar: 'bg-amber-500' },
  purple: { dot: 'bg-purple-500', light: 'bg-purple-100', text: 'text-purple-700', bar: 'bg-purple-500' },
  rose: { dot: 'bg-rose-500', light: 'bg-rose-100', text: 'text-rose-700', bar: 'bg-rose-500' },
  cyan: { dot: 'bg-cyan-500', light: 'bg-cyan-100', text: 'text-cyan-700', bar: 'bg-cyan-500' },
  lime: { dot: 'bg-lime-500', light: 'bg-lime-100', text: 'text-lime-700', bar: 'bg-lime-500' },
  indigo: { dot: 'bg-indigo-500', light: 'bg-indigo-100', text: 'text-indigo-700', bar: 'bg-indigo-500' },
  teal: { dot: 'bg-teal-500', light: 'bg-teal-100', text: 'text-teal-700', bar: 'bg-teal-500' },
  slate: { dot: 'bg-slate-500', light: 'bg-slate-100', text: 'text-slate-700', bar: 'bg-slate-500' },
};

const STATUS_COLORS: Record<string, string> = {
  nieuw: 'bg-blue-500', gecontacteerd: 'bg-amber-500', offerte: 'bg-purple-500', verkocht: 'bg-emerald-500', afgewezen: 'bg-red-400',
};

const STATUS_BADGE: Record<string, string> = {
  nieuw: 'bg-blue-100 text-blue-700', gecontacteerd: 'bg-amber-100 text-amber-700', offerte: 'bg-purple-100 text-purple-700', verkocht: 'bg-emerald-100 text-emerald-700', afgewezen: 'bg-red-100 text-red-700',
};

const PERIOD_LABELS: Record<string, string> = {
  day: 'Vandaag', week: 'Week', month: 'Maand', quarter: 'Kwartaal', year: 'Jaar',
};

function TrendBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-600">nieuw</span>;
  const pct = Math.round(((current - previous) / previous) * 100);
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${up ? 'text-emerald-600' : 'text-red-500'}`}>
      {up ? <ArrowTrendingUpIcon className="h-3 w-3" /> : <ArrowTrendingDownIcon className="h-3 w-3" />}
      {up ? '+' : ''}{pct}%
    </span>
  );
}

function DashboardSkeleton() {
  return (
    <div>
      <div className="mb-6 h-7 w-32 animate-pulse rounded bg-slate-100" />
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 h-9 w-9 animate-pulse rounded-lg bg-slate-100" />
            <div className="h-7 w-16 animate-pulse rounded bg-slate-100" />
            <div className="mt-1.5 h-3 w-20 animate-pulse rounded bg-slate-50" />
          </div>
        ))}
      </div>
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 h-4 w-40 animate-pulse rounded bg-slate-100" />
        <div className="mb-3 flex gap-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-7 w-16 animate-pulse rounded-full bg-slate-100" />)}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-50" />)}
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [branchMeta, setBranchMeta] = useState<Record<string, BranchMeta>>({});
  const [batches, setBatches] = useState<BatchInfo[]>([]);
  const [assignmentCount, setAssignmentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>('week');

  useEffect(() => {
    Promise.all([
      adminFetch('/api/admin/stats').then(r => r.json()),
      adminFetch('/api/admin/branches').then(r => r.json()),
      adminFetch('/api/admin/batches').then(r => r.ok ? r.json() : []),
      adminFetch('/api/admin/assignments').then(r => r.ok ? r.json() : []),
    ]).then(([statsData, branchData, batchData, assignData]) => {
      setStats(statsData);
      const m: Record<string, BranchMeta> = {};
      (branchData.branches || []).forEach((b: BranchMeta) => { m[b.slug] = b; });
      setBranchMeta(m);
      setBatches(batchData || []);
      setAssignmentCount((assignData || []).length);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const getBranch = (slug: string) => {
    const b = branchMeta[slug];
    const c = BRANCH_COLOR_MAP[b?.color || 'slate'] || BRANCH_COLOR_MAP.slate;
    return { name: b?.name || slug, ...c };
  };

  if (loading) return <DashboardSkeleton />;
  if (!stats) return <p className="py-20 text-center text-slate-400">Kon statistieken niet laden.</p>;

  const maxStatus = Math.max(...Object.values(stats.byStatus), 1);
  const activeBatches = batches.filter((b: BatchInfo) => b.status === 'active');
  const batchDelivered = activeBatches.reduce((s, b) => s + (b.leads_delivered || 0), 0);
  const batchTotal = activeBatches.reduce((s, b) => s + (b.batch_size || 0), 0);
  const ps = stats.periodStats?.[period];

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-slate-900 sm:text-2xl">Dashboard</h1>

      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Totaal leads', value: stats.total, icon: ChartBarSquareIcon, color: 'text-brand-purple bg-brand-purple/10' },
          { label: 'Deze week', value: stats.thisWeek, icon: ArrowTrendingUpIcon, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Deze maand', value: stats.thisMonth, icon: ClockIcon, color: 'text-amber-600 bg-amber-50' },
          { label: 'Klanten', value: Object.keys(stats.byCustomer).length, icon: UserGroupIcon, color: 'text-sky-600 bg-sky-50' },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg ${kpi.color}`}>
              <kpi.icon className="h-[18px] w-[18px]" />
            </div>
            <p className="text-xl font-bold text-slate-900 sm:text-2xl">{kpi.value.toLocaleString()}</p>
            <p className="text-xs text-slate-500">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Period Overview */}
      {stats.periodStats && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
                <CalendarDaysIcon className="h-4 w-4 text-indigo-500" />
              </div>
              <h2 className="text-sm font-semibold text-slate-900">Periodeoverzicht</h2>
            </div>
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              {Object.entries(PERIOD_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setPeriod(key)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    period === key
                      ? 'bg-white text-brand-purple shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {ps && (
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-2xl font-bold text-slate-900">{ps.leads}</p>
                  <TrendBadge current={ps.leads} previous={ps.prevLeads} />
                </div>
                <p className="mt-1 text-xs text-slate-500">Leads geworven</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-2xl font-bold text-slate-900">{ps.assigned}</p>
                  <TrendBadge current={ps.assigned} previous={ps.prevAssigned} />
                </div>
                <p className="mt-1 text-xs text-slate-500">Leads uitgedeeld</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-2xl font-bold text-slate-900">
                  {ps.leads > 0 ? Math.round((ps.assigned / ps.leads) * 100) : 0}%
                </p>
                <p className="mt-1 text-xs text-slate-500">Conversieratio</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Active Batches Progress + Distribution Summary */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        {/* Active batches */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50">
                <ArrowsRightLeftIcon className="h-4 w-4 text-purple-500" />
              </div>
              <h2 className="text-sm font-semibold text-slate-900">Actieve batches</h2>
            </div>
            <Link href="/admin/verdeling" className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-purple transition hover:bg-brand-purple/5">
              Verdeling <ChevronRightIcon className="h-3 w-3" />
            </Link>
          </div>

          {activeBatches.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-center">
              <InboxIcon className="mb-2 h-8 w-8 text-slate-300" />
              <p className="text-sm text-slate-400">Geen actieve batches</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeBatches.slice(0, 6).map(b => {
                const pct = b.batch_size > 0 ? Math.min(100, Math.round((b.leads_delivered / b.batch_size) * 100)) : 0;
                const br = getBranch(b.branch);
                return (
                  <div key={b.id}>
                    <div className="mb-1 flex items-center justify-between">
                      <div className="flex items-center gap-2 truncate">
                        <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${br.dot}`} />
                        <span className="truncate text-xs font-medium text-slate-700">{b.customers?.name || '—'}</span>
                        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${br.light} ${br.text}`}>{br.name}</span>
                      </div>
                      <span className="ml-2 shrink-0 text-[11px] font-semibold text-slate-500">
                        {b.leads_delivered}/{b.batch_size} <span className="text-slate-400">({pct}%)</span>
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? 'bg-blue-500' : br.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {activeBatches.length > 6 && (
                <p className="text-center text-xs text-slate-400">+{activeBatches.length - 6} meer</p>
              )}
            </div>
          )}

          {/* Totals footer */}
          {activeBatches.length > 0 && (
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-xs text-slate-500">Totaal voortgang</span>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand-purple transition-all duration-500" style={{ width: `${batchTotal > 0 ? (batchDelivered / batchTotal) * 100 : 0}%` }} />
                </div>
                <span className="text-[11px] font-semibold text-slate-600">{batchDelivered}/{batchTotal}</span>
              </div>
            </div>
          )}
        </div>

        {/* Distribution KPI */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
              <ChartBarSquareIcon className="h-4 w-4 text-emerald-500" />
            </div>
            <h2 className="text-sm font-semibold text-slate-900">Verdeling overzicht</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-2xl font-bold text-slate-900">{assignmentCount}</p>
              <p className="mt-1 text-xs text-slate-500">Totaal toewijzingen</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-2xl font-bold text-slate-900">{activeBatches.length}</p>
              <p className="mt-1 text-xs text-slate-500">Actieve batches</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-2xl font-bold text-slate-900">
                {batchTotal > 0 ? Math.round((batchDelivered / batchTotal) * 100) : 0}%
              </p>
              <p className="mt-1 text-xs text-slate-500">Totaal geleverd</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-2xl font-bold text-slate-900">{batches.filter(b => b.status === 'completed').length}</p>
              <p className="mt-1 text-xs text-slate-500">Afgeronde batches</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Status breakdown */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Leads per status</h2>
          <div className="space-y-3">
            {Object.entries(stats.byStatus).map(([status, count]) => (
              <div key={status}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="capitalize text-slate-600">{status}</span>
                  <span className="font-medium text-slate-900">{count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full transition-all duration-500 ${STATUS_COLORS[status] || 'bg-slate-400'}`} style={{ width: `${(count / maxStatus) * 100}%` }} />
                </div>
              </div>
            ))}
            {Object.keys(stats.byStatus).length === 0 && <p className="text-sm text-slate-400">Nog geen data</p>}
          </div>
        </div>

        {/* Branch + Customer breakdown */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Leads per branche</h2>
          <div className="space-y-4">
            {Object.entries(stats.byBranch).map(([slug, count]) => {
              const b = getBranch(slug);
              return (
                <div key={slug} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`inline-block h-3 w-3 rounded-full ${b.dot}`} />
                    <span className="text-sm text-slate-600">{b.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">{count}</span>
                </div>
              );
            })}
            {Object.keys(stats.byBranch).length === 0 && <p className="text-sm text-slate-400">Nog geen data</p>}
          </div>

          <h2 className="mb-3 mt-6 border-t border-slate-100 pt-5 text-sm font-semibold text-slate-900">Leads per klant</h2>
          <div className="space-y-2">
            {Object.entries(stats.byCustomer).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => (
              <div key={name} className="flex items-center justify-between">
                <span className="truncate text-sm text-slate-600">{name}</span>
                <span className="ml-2 shrink-0 text-sm font-medium text-slate-900">{count}</span>
              </div>
            ))}
            {Object.keys(stats.byCustomer).length === 0 && <p className="text-sm text-slate-400">Nog geen data</p>}
          </div>
        </div>
      </div>

      {/* Recent leads */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Laatste leads</h2>
          <Link href="/admin/leads" className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-purple transition hover:bg-brand-purple/5">
            Alles bekijken <ChevronRightIcon className="h-3 w-3" />
          </Link>
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-50 text-xs text-slate-500">
                <th className="px-5 py-2.5">Naam</th>
                <th className="px-3 py-2.5">Branche</th>
                <th className="px-3 py-2.5">Klant</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Datum</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentLeads.map((lead: any) => (
                <tr key={lead.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-2.5 font-medium text-slate-800">{lead.naam_klant}</td>
                  <td className="px-3 py-2.5">
                    {(() => { const b = getBranch(lead.branch); return (
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${b.light} ${b.text}`}>{b.name}</span>
                    ); })()}
                  </td>
                  <td className="px-3 py-2.5 text-slate-500">{lead.customers?.name || '—'}</td>
                  <td className="px-3 py-2.5 capitalize text-slate-500">{lead.status}</td>
                  <td className="px-3 py-2.5 text-slate-400">{lead.wervingsdatum || '—'}</td>
                </tr>
              ))}
              {stats.recentLeads.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">Nog geen leads</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="divide-y divide-slate-50 md:hidden">
          {stats.recentLeads.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">Nog geen leads</p>
          ) : stats.recentLeads.map((lead: any) => (
            <div key={lead.id} className="px-4 py-3">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-800">{lead.naam_klant}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{lead.customers?.name || '—'}</p>
                </div>
                <span className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_BADGE[lead.status] || 'bg-slate-100 text-slate-600'}`}>
                  {lead.status}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-400">
                {(() => { const b = getBranch(lead.branch); return (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${b.light} ${b.text}`}>{b.name}</span>
                ); })()}
                {lead.wervingsdatum && <span>{lead.wervingsdatum}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
