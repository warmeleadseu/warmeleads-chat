'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ChartBarSquareIcon,
  UserGroupIcon,
  ArrowTrendingUpIcon,
  ClockIcon,
  ChevronRightIcon,
  MapPinIcon,
  ArrowsRightLeftIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';

interface Stats {
  total: number;
  thisWeek: number;
  thisMonth: number;
  byStatus: Record<string, number>;
  byBranch: Record<string, number>;
  byCustomer: Record<string, number>;
  recentLeads: any[];
}

interface BranchMeta { slug: string; name: string; color: string; }

const BRANCH_COLOR_MAP: Record<string, { dot: string; light: string; text: string }> = {
  emerald: { dot: 'bg-emerald-500', light: 'bg-emerald-100', text: 'text-emerald-700' },
  sky: { dot: 'bg-sky-500', light: 'bg-sky-100', text: 'text-sky-700' },
  amber: { dot: 'bg-amber-500', light: 'bg-amber-100', text: 'text-amber-700' },
  purple: { dot: 'bg-purple-500', light: 'bg-purple-100', text: 'text-purple-700' },
  rose: { dot: 'bg-rose-500', light: 'bg-rose-100', text: 'text-rose-700' },
  cyan: { dot: 'bg-cyan-500', light: 'bg-cyan-100', text: 'text-cyan-700' },
  lime: { dot: 'bg-lime-500', light: 'bg-lime-100', text: 'text-lime-700' },
  indigo: { dot: 'bg-indigo-500', light: 'bg-indigo-100', text: 'text-indigo-700' },
  teal: { dot: 'bg-teal-500', light: 'bg-teal-100', text: 'text-teal-700' },
  slate: { dot: 'bg-slate-500', light: 'bg-slate-100', text: 'text-slate-700' },
};

const STATUS_COLORS: Record<string, string> = {
  nieuw: 'bg-blue-500',
  gecontacteerd: 'bg-amber-500',
  offerte: 'bg-purple-500',
  verkocht: 'bg-emerald-500',
  afgewezen: 'bg-red-400',
};

const STATUS_BADGE: Record<string, string> = {
  nieuw: 'bg-blue-100 text-blue-700',
  gecontacteerd: 'bg-amber-100 text-amber-700',
  offerte: 'bg-purple-100 text-purple-700',
  verkocht: 'bg-emerald-100 text-emerald-700',
  afgewezen: 'bg-red-100 text-red-700',
};

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
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 h-4 w-28 animate-pulse rounded bg-slate-100" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="mb-3">
              <div className="mb-1 h-3 w-24 animate-pulse rounded bg-slate-50" />
              <div className="h-2 w-full animate-pulse rounded-full bg-slate-100" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 h-4 w-28 animate-pulse rounded bg-slate-100" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="mb-3 flex justify-between">
              <div className="h-3 w-20 animate-pulse rounded bg-slate-50" />
              <div className="h-3 w-8 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface BatchSummary { active: number; delivered: number; total: number; }

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [branchMeta, setBranchMeta] = useState<Record<string, BranchMeta>>({});
  const [batchSummary, setBatchSummary] = useState<BatchSummary>({ active: 0, delivered: 0, total: 0 });
  const [assignmentCount, setAssignmentCount] = useState(0);
  const [loading, setLoading] = useState(true);

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
      const activeBatches = (batchData || []).filter((b: any) => b.status === 'active');
      setBatchSummary({
        active: activeBatches.length,
        delivered: activeBatches.reduce((s: number, b: any) => s + (b.leads_delivered || 0), 0),
        total: activeBatches.reduce((s: number, b: any) => s + (b.batch_size || 0), 0),
      });
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

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-slate-900 sm:text-2xl">Dashboard</h1>

      {/* KPI Cards */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
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

      {/* Distribution summary */}
      {batchSummary.active > 0 && (
        <div className="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50">
                <ArrowsRightLeftIcon className="h-4 w-4 text-purple-500" />
              </div>
              <h2 className="text-sm font-semibold text-slate-900">Leadverdeling</h2>
            </div>
            <Link href="/admin/verdeling" className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-purple transition hover:bg-brand-purple/5">
              Bekijken <ChevronRightIcon className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xl font-bold text-slate-800">{assignmentCount}</p>
              <p className="text-xs text-slate-500">Toewijzingen</p>
            </div>
            <div>
              <p className="text-xl font-bold text-slate-800">{batchSummary.active}</p>
              <p className="text-xs text-slate-500">Actieve batches</p>
            </div>
            <div>
              <p className="text-xl font-bold text-slate-800">
                {batchSummary.total > 0 ? Math.round((batchSummary.delivered / batchSummary.total) * 100) : 0}%
              </p>
              <p className="text-xs text-slate-500">Geleverd ({batchSummary.delivered}/{batchSummary.total})</p>
            </div>
          </div>
        </div>
      )}

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
