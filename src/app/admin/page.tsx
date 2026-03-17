'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ChartBarSquareIcon,
  UserGroupIcon,
  ArrowTrendingUpIcon,
  ClockIcon,
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

const STATUS_COLORS: Record<string, string> = {
  nieuw: 'bg-blue-500',
  gecontacteerd: 'bg-amber-500',
  offerte: 'bg-purple-500',
  verkocht: 'bg-emerald-500',
  afgewezen: 'bg-red-400',
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch('/api/admin/stats')
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-brand-purple" />
      </div>
    );
  }

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
            <p className="text-2xl font-bold text-slate-900">{kpi.value.toLocaleString()}</p>
            <p className="text-xs text-slate-500">{kpi.label}</p>
          </div>
        ))}
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
                  <div className={`h-full rounded-full ${STATUS_COLORS[status] || 'bg-slate-400'}`} style={{ width: `${(count / maxStatus) * 100}%` }} />
                </div>
              </div>
            ))}
            {Object.keys(stats.byStatus).length === 0 && <p className="text-sm text-slate-400">Nog geen data</p>}
          </div>
        </div>

        {/* Branch breakdown */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Leads per branche</h2>
          <div className="space-y-4">
            {Object.entries(stats.byBranch).map(([branch, count]) => (
              <div key={branch} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`inline-block h-3 w-3 rounded-full ${branch === 'thuisbatterij' ? 'bg-emerald-500' : 'bg-sky-500'}`} />
                  <span className="text-sm capitalize text-slate-600">{branch}</span>
                </div>
                <span className="text-sm font-semibold text-slate-900">{count}</span>
              </div>
            ))}
            {Object.keys(stats.byBranch).length === 0 && <p className="text-sm text-slate-400">Nog geen data</p>}
          </div>

          <h2 className="mb-3 mt-6 border-t border-slate-100 pt-5 text-sm font-semibold text-slate-900">Leads per klant</h2>
          <div className="space-y-2">
            {Object.entries(stats.byCustomer).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => (
              <div key={name} className="flex items-center justify-between">
                <span className="truncate text-sm text-slate-600">{name}</span>
                <span className="text-sm font-medium text-slate-900">{count}</span>
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
          <Link href="/admin/leads" className="text-xs font-medium text-brand-purple hover:underline">Alles bekijken</Link>
        </div>
        <div className="overflow-x-auto">
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
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${lead.branch === 'thuisbatterij' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'}`}>
                      {lead.branch === 'thuisbatterij' ? 'Batterij' : 'Airco'}
                    </span>
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
      </div>
    </div>
  );
}
