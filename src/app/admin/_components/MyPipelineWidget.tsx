'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BriefcaseIcon,
  ArrowRightIcon,
  CheckBadgeIcon,
  ClockIcon,
  ListBulletIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';
import { PROSPECT_STATUSES, PROSPECT_STATUS_COLORS, PROSPECT_STATUS_LABELS, type ProspectStatus } from '@/lib/prospects';

interface PipelineStats {
  status_counts: Record<string, number>;
  open_prospects: number;
  total_prospects: number;
  conversions_this_month: number;
  tasks: { total_open: number; overdue: number; today: number; this_week: number };
  recent_activities: { id: string; prospect_id: string; type: string; title: string; created_at: string; prospect: { company_name: string } }[];
}

export function MyPipelineWidget() {
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await adminFetch('/api/admin/prospects/stats');
        const data = await res.json();
        if (!cancel && res.ok) setStats(data);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  if (loading) {
    return <div className="mb-6 h-40 animate-pulse rounded-xl border border-slate-200 bg-white" />;
  }
  if (!stats) return null;

  const statusEntries = PROSPECT_STATUSES.filter(s => s !== 'verloren' && s !== 'niet_relevant').map(s => ({
    status: s,
    count: stats.status_counts[s] || 0,
  }));
  const maxStatus = Math.max(1, ...statusEntries.map(s => s.count));

  return (
    <div className="mb-6 rounded-xl border border-brand-purple/20 bg-gradient-to-br from-brand-purple/5 via-white to-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-purple/10">
            <BriefcaseIcon className="h-4 w-4 text-brand-purple" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Mijn pipeline</h2>
            <p className="text-[11px] text-slate-500">Prospects waar jij aan werkt</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/prospects/taken"
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-purple hover:underline"
          >
            Alle taken
            <ArrowRightIcon className="h-3 w-3" />
          </Link>
          <Link
            href="/admin/prospects"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-brand-purple hover:underline"
          >
            Naar prospects
            <ArrowRightIcon className="h-3 w-3" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile
          label="Open prospects"
          value={stats.open_prospects}
          accent="bg-brand-purple/10 text-brand-purple"
          Icon={BriefcaseIcon}
        />
        <KpiTile
          label="Conversies (maand)"
          value={stats.conversions_this_month}
          accent="bg-emerald-100 text-emerald-700"
          Icon={CheckBadgeIcon}
        />
        <KpiTile
          label="Taken vandaag"
          value={stats.tasks.today}
          accent="bg-orange-100 text-orange-700"
          Icon={ClockIcon}
          highlight={stats.tasks.today > 0}
        />
        <KpiTile
          label="Verlopen taken"
          value={stats.tasks.overdue}
          accent="bg-rose-100 text-rose-700"
          Icon={ClockIcon}
          highlight={stats.tasks.overdue > 0}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Funnel</h3>
          <div className="space-y-1.5">
            {statusEntries.map(({ status, count }) => {
              const c = PROSPECT_STATUS_COLORS[status as ProspectStatus];
              const pct = maxStatus > 0 ? (count / maxStatus) * 100 : 0;
              return (
                <div key={status} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                  <span className={`min-w-0 truncate rounded-md px-2 py-0.5 text-[11px] font-medium sm:min-w-[120px] ${c.bg} ${c.text}`}>
                    {PROSPECT_STATUS_LABELS[status as ProspectStatus]}
                  </span>
                  <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${c.dot}`}
                      style={{ width: `${pct}%` }}
                      aria-hidden
                    />
                  </div>
                  <span className="w-8 text-right text-xs font-semibold tabular-nums text-slate-700">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-2">
          <h3 className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <ListBulletIcon className="h-3 w-3" />
            Laatste activiteit
          </h3>
          {stats.recent_activities.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
              Nog geen activiteiten.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {stats.recent_activities.slice(0, 5).map(a => (
                <li key={a.id} className="rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs">
                  <p className="truncate font-medium text-slate-700">{a.prospect?.company_name}</p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500">{a.title}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiTile({
  label,
  value,
  accent,
  Icon,
  highlight,
}: {
  label: string;
  value: number;
  accent: string;
  Icon: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border bg-white p-3 shadow-sm ${highlight ? 'border-rose-200' : 'border-slate-200'}`}>
      <div className={`mb-2 inline-flex h-7 w-7 items-center justify-center rounded-md ${accent}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-lg font-bold text-slate-900">{value.toLocaleString('nl-NL')}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}
