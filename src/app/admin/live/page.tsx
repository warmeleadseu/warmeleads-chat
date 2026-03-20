'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { adminFetch } from '@/lib/adminAuth';

const REFRESH_INTERVAL = 30_000;

const PERIOD_LABELS: Record<string, string> = {
  day: '24 uur',
  '3days': '3 dagen',
  week: 'Week',
  month: 'Maand',
  quarter: 'Kwartaal',
  year: 'Jaar',
};

const BRANCH_COLORS: Record<string, { bar: string; glow: string; badge: string }> = {
  thuisbatterij: { bar: 'from-emerald-400 to-emerald-500', glow: 'shadow-emerald-500/30', badge: 'bg-emerald-500/20 text-emerald-300' },
  airco: { bar: 'from-sky-400 to-sky-500', glow: 'shadow-sky-500/30', badge: 'bg-sky-500/20 text-sky-300' },
};
const DEFAULT_BRANCH = { bar: 'from-purple-400 to-purple-500', glow: 'shadow-purple-500/30', badge: 'bg-purple-500/20 text-purple-300' };

interface PeriodStat { leads: number; prevLeads: number; assigned: number; prevAssigned: number; }
interface BatchInfo { id: string; customer: string; branch: string; batchSize: number; delivered: number; pricePerLead: number | null; leadsPerWeek: number | null; notes: string | null; }
interface RecentLead { id: string; name: string; branch: string; city: string; province: string; createdAt: string; }
interface LiveData {
  totalLeads: number;
  activeCustomers: number;
  totalCustomers: number;
  activeBatches: BatchInfo[];
  completedBatchCount: number;
  totalRevenue: number;
  completedRevenue: number;
  recentLeads: RecentLead[];
  periodStats: Record<string, PeriodStat>;
  timestamp: string;
}

function AnimatedNumber({ value, prefix = '', suffix = '', className = '' }: { value: number; prefix?: string; suffix?: string; className?: string }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = value;
    if (prev === value) return;

    const diff = value - prev;
    const steps = Math.min(40, Math.abs(diff));
    if (steps === 0) { setDisplay(value); return; }

    let step = 0;
    const interval = setInterval(() => {
      step++;
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(prev + diff * eased));
      if (step >= steps) { clearInterval(interval); setDisplay(value); }
    }, 20);
    return () => clearInterval(interval);
  }, [value]);

  return <span className={className}>{prefix}{display.toLocaleString('nl-NL')}{suffix}</span>;
}

function TrendArrow({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return <span className="text-xs font-bold text-emerald-400">nieuw</span>;
  const pct = Math.round(((current - previous) / previous) * 100);
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-bold ${up ? 'text-emerald-400' : 'text-red-400'}`}>
      <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
        <path d={up ? 'M6 2L10 7H2L6 2Z' : 'M6 10L2 5H10L6 10Z'} fill="currentColor" />
      </svg>
      {up ? '+' : ''}{pct}%
    </span>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}u`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function LiveDashboard() {
  const [data, setData] = useState<LiveData | null>(null);
  const [clock, setClock] = useState(new Date());
  const [refreshIn, setRefreshIn] = useState(REFRESH_INTERVAL / 1000);
  const [prevLeadIds, setPrevLeadIds] = useState<Set<string>>(new Set());
  const [newLeadIds, setNewLeadIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/live-stats');
      if (res.ok) {
        const d: LiveData = await res.json();
        setData(prev => {
          if (prev) {
            const oldIds = new Set(prev.recentLeads.map(l => l.id));
            const fresh = d.recentLeads.filter(l => !oldIds.has(l.id)).map(l => l.id);
            if (fresh.length > 0) {
              setNewLeadIds(new Set(fresh));
              setTimeout(() => setNewLeadIds(new Set()), 3000);
            }
            setPrevLeadIds(oldIds);
          }
          return d;
        });
      }
    } catch { /* silent */ }
    setRefreshIn(REFRESH_INTERVAL / 1000);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const iv = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(iv);
  }, [fetchData]);

  useEffect(() => {
    const iv = setInterval(() => {
      setClock(new Date());
      setRefreshIn(r => Math.max(0, r - 1));
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B0E1A]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-[3px] border-white/10 border-t-brand-purple" />
          <p className="text-sm text-white/30">Live dashboard laden...</p>
        </div>
      </div>
    );
  }

  const ps = data.periodStats;
  const batchDelivered = data.activeBatches.reduce((s, b) => s + b.delivered, 0);
  const batchTotal = data.activeBatches.reduce((s, b) => s + b.batchSize, 0);
  const overallPct = batchTotal > 0 ? Math.round((batchDelivered / batchTotal) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#0B0E1A] text-white">
      {/* Ambient glow effects */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-64 -top-64 h-[600px] w-[600px] rounded-full bg-brand-purple/[0.07] blur-[180px]" />
        <div className="absolute -bottom-64 -right-64 h-[600px] w-[600px] rounded-full bg-brand-pink/[0.05] blur-[180px]" />
        <div className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/[0.03] blur-[150px]" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col p-4 sm:p-6 lg:p-8">
        {/* Top bar */}
        <div className="mb-6 flex items-center justify-between">
          <Link href="/admin" className="group flex items-center gap-3">
            <Image src="/logo-wit.png" alt="WarmeLeads" width={140} height={42} className="h-8 w-auto opacity-80 transition group-hover:opacity-100" />
            <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white/30">Live</span>
          </Link>
          <div className="flex items-center gap-4">
            {/* Refresh indicator */}
            <div className="flex items-center gap-2">
              <div className="relative h-5 w-5">
                <svg className="h-5 w-5 -rotate-90" viewBox="0 0 20 20">
                  <circle cx="10" cy="10" r="8" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
                  <circle cx="10" cy="10" r="8" fill="none" stroke="rgba(139,92,246,0.5)" strokeWidth="2"
                    strokeDasharray={`${(1 - refreshIn / (REFRESH_INTERVAL / 1000)) * 50.3} 50.3`}
                    strokeLinecap="round" className="transition-all duration-1000" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                </div>
              </div>
              <span className="text-[11px] tabular-nums text-white/25">{refreshIn}s</span>
            </div>

            {/* Clock */}
            <div className="text-right">
              <p className="text-lg font-bold tabular-nums text-white/80">
                {clock.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
              <p className="text-[11px] text-white/25">
                {clock.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        </div>

        {/* Hero KPIs */}
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Leads vandaag', value: ps.day?.leads || 0, sub: `${ps.day?.assigned || 0} uitgedeeld`, color: 'from-brand-purple to-brand-pink' },
            { label: 'Leads deze week', value: ps.week?.leads || 0, sub: `${ps.week?.assigned || 0} uitgedeeld`, color: 'from-emerald-500 to-emerald-600', trend: ps.week },
            { label: 'Omzet', value: Math.round(data.totalRevenue), sub: `€${data.completedRevenue.toLocaleString('nl-NL')} afgerond`, color: 'from-amber-500 to-orange-500', prefix: '€' },
            { label: 'Totaal leads', value: data.totalLeads, sub: `${data.activeCustomers} klanten actief`, color: 'from-sky-500 to-blue-600' },
          ].map((kpi, i) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 backdrop-blur-sm"
            >
              <div className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${kpi.color}`} />
              <p className="mb-1 text-xs font-medium text-white/40">{kpi.label}</p>
              <div className="flex items-baseline gap-2">
                <AnimatedNumber value={kpi.value} prefix={kpi.prefix} className="text-3xl font-black tracking-tight text-white lg:text-4xl" />
                {kpi.trend && <TrendArrow current={kpi.trend.leads} previous={kpi.trend.prevLeads} />}
              </div>
              <p className="mt-1 text-[11px] text-white/25">{kpi.sub}</p>
            </motion.div>
          ))}
        </div>

        {/* Middle: Batches + Live Feed */}
        <div className="mb-6 grid flex-1 gap-4 lg:grid-cols-5">
          {/* Active batches - 3 cols */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 backdrop-blur-sm lg:col-span-3">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                <h2 className="text-sm font-bold text-white/70">Actieve batches</h2>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-white/25">
                <span>{data.activeBatches.length} actief</span>
                <span>{data.completedBatchCount} voltooid</span>
              </div>
            </div>

            {data.activeBatches.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-white/20">Geen actieve batches</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.activeBatches.map((b, i) => {
                  const pct = b.batchSize > 0 ? Math.min(100, Math.round((b.delivered / b.batchSize) * 100)) : 0;
                  const bc = BRANCH_COLORS[b.branch] || DEFAULT_BRANCH;
                  return (
                    <motion.div
                      key={b.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white/80">{b.customer}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${bc.badge}`}>{b.branch}</span>
                        </div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-lg font-black tabular-nums text-white/90">{b.delivered}</span>
                          <span className="text-xs text-white/25">/ {b.batchSize}</span>
                        </div>
                      </div>
                      <div className="relative h-3 overflow-hidden rounded-full bg-white/[0.06]">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 1.5, ease: 'easeOut' }}
                          className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${bc.bar} shadow-lg ${bc.glow}`}
                        />
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-[11px] text-white/25">
                        <div className="flex gap-3">
                          {b.pricePerLead && <span>€{b.pricePerLead}/lead</span>}
                          {b.leadsPerWeek && <span>{b.leadsPerWeek}/week</span>}
                        </div>
                        <span className="font-bold text-white/40">{pct}%</span>
                      </div>
                    </motion.div>
                  );
                })}

                {/* Total progress footer */}
                <div className="mt-2 rounded-xl border border-white/[0.04] bg-white/[0.02] p-3">
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="font-medium text-white/40">Totaal voortgang</span>
                    <span className="font-bold tabular-nums text-white/60">{batchDelivered} / {batchTotal} ({overallPct}%)</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${overallPct}%` }}
                      transition={{ duration: 2, ease: 'easeOut' }}
                      className="h-full rounded-full bg-gradient-to-r from-brand-purple to-brand-pink"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Live feed - 2 cols */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 backdrop-blur-sm lg:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <div className="relative">
                <div className="h-2 w-2 rounded-full bg-red-500" />
                <div className="absolute inset-0 h-2 w-2 animate-ping rounded-full bg-red-500/50" />
              </div>
              <h2 className="text-sm font-bold text-white/70">Live feed</h2>
            </div>

            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {data.recentLeads.map((lead) => {
                  const isNew = newLeadIds.has(lead.id);
                  const bc = BRANCH_COLORS[lead.branch] || DEFAULT_BRANCH;
                  return (
                    <motion.div
                      key={lead.id}
                      layout
                      initial={{ opacity: 0, y: -20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.3 }}
                      className={`rounded-lg border p-3 transition-all ${
                        isNew
                          ? 'border-emerald-500/30 bg-emerald-500/[0.08] shadow-lg shadow-emerald-500/10'
                          : 'border-white/[0.04] bg-white/[0.02]'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {isNew && (
                              <motion.span
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="shrink-0 rounded bg-emerald-500 px-1.5 py-0.5 text-[9px] font-black uppercase text-white"
                              >
                                Nieuw
                              </motion.span>
                            )}
                            <p className="truncate text-sm font-semibold text-white/80">{lead.name || '—'}</p>
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-white/30">
                            {lead.city && <span>{lead.city}</span>}
                            {lead.province && <span className="text-white/15">·</span>}
                            {lead.province && <span>{lead.province}</span>}
                          </div>
                        </div>
                        <div className="ml-2 flex shrink-0 flex-col items-end gap-1">
                          <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${bc.badge}`}>{lead.branch}</span>
                          <span className="text-[10px] tabular-nums text-white/20">{timeAgo(lead.createdAt)}</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Period comparison */}
        <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
          {Object.entries(PERIOD_LABELS).map(([key, label], i) => {
            const stat = ps[key];
            if (!stat) return null;
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.06 }}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 backdrop-blur-sm"
              >
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/25">{label}</p>
                <div className="flex items-baseline gap-1.5">
                  <AnimatedNumber value={stat.leads} className="text-xl font-black tabular-nums text-white/90" />
                  <TrendArrow current={stat.leads} previous={stat.prevLeads} />
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[10px] text-white/25">
                  <span>{stat.assigned} uitgedeeld</span>
                  {stat.leads > 0 && (
                    <span className="rounded bg-white/[0.06] px-1 py-0.5 text-[9px] font-bold text-white/30">
                      {Math.round((stat.assigned / stat.leads) * 100)}%
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
