'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowsRightLeftIcon,
  ArrowPathIcon,
  MapPinIcon,
  UserGroupIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  CurrencyEuroIcon,
  ClockIcon,
  InboxIcon,
  CalendarDaysIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  EyeIcon,
  ExclamationCircleIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';

interface Assignment {
  id: string;
  lead_id: string;
  customer_id: string;
  batch_id: string | null;
  distance_km: number | null;
  assigned_at: string;
  customers: { name: string } | null;
  leads: { naam_klant: string; email: string; branch: string; postcode: string; plaatsnaam: string } | null;
}

interface Batch {
  id: string;
  customer_id: string;
  branch: string;
  batch_size: number;
  leads_delivered: number;
  leads_per_week: number | null;
  status: string;
  price_per_lead: number | null;
  total_price: number | null;
  notes: string | null;
  created_at: string;
  completed_at: string | null;
  customers: { name: string } | null;
}

interface BranchOption { slug: string; name: string; color: string; }

interface DebugLead {
  id: string;
  naam_klant: string;
  email: string;
  branch: string;
  postcode: string;
  plaatsnaam: string;
  has_coords: boolean;
  lat: number | null;
  lng: number | null;
  land: string;
  created_at: string;
  assignment_count: number;
  assignments: { id: string; customer_name: string; customer_id: string; distance_km: number | null; assigned_at: string }[];
  potential_matches: { customer_id: string; customer_name: string; assigned: boolean; reason_not_assigned?: string; distance_km?: number; target_label?: string }[];
}

interface DebugSummary {
  total_leads: number;
  leads_with_coords: number;
  leads_without_coords: number;
  total_assignments: number;
  active_batches: number;
  completed_batches: number;
}

const COLOR_MAP: Record<string, { light: string; text: string }> = {
  emerald: { light: 'bg-emerald-50', text: 'text-emerald-600' },
  sky: { light: 'bg-sky-50', text: 'text-sky-600' },
  amber: { light: 'bg-amber-50', text: 'text-amber-600' },
  purple: { light: 'bg-purple-50', text: 'text-purple-600' },
  rose: { light: 'bg-rose-50', text: 'text-rose-600' },
  cyan: { light: 'bg-cyan-50', text: 'text-cyan-600' },
  lime: { light: 'bg-lime-50', text: 'text-lime-600' },
  indigo: { light: 'bg-indigo-50', text: 'text-indigo-600' },
  teal: { light: 'bg-teal-50', text: 'text-teal-600' },
  slate: { light: 'bg-slate-50', text: 'text-slate-600' },
};

export default function VerdelingPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [distributing, setDistributing] = useState(false);
  const [distResult, setDistResult] = useState<{ distributed: number; assignments: number } | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [enrichResult, setEnrichResult] = useState<{ enriched: number; total: number } | null>(null);
  const [tab, setTab] = useState<'overzicht' | 'assignments' | 'batches' | 'leadstatus'>('overzicht');
  const [timePeriod, setTimePeriod] = useState<string>('week');
  const [debugLeads, setDebugLeads] = useState<DebugLead[]>([]);
  const [debugSummary, setDebugSummary] = useState<DebugSummary | null>(null);
  const [debugLoading, setDebugLoading] = useState(false);
  const [expandedLead, setExpandedLead] = useState<string | null>(null);
  const [compensatingBatch, setCompensatingBatch] = useState<string | null>(null);
  const [compensationAmount, setCompensationAmount] = useState('');
  const [compensationNote, setCompensationNote] = useState('');
  const [compensating, setCompensating] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [assignRes, batchRes, branchRes] = await Promise.all([
      adminFetch('/api/admin/assignments'),
      adminFetch('/api/admin/batches'),
      adminFetch('/api/admin/branches'),
    ]);
    if (assignRes.ok) setAssignments(await assignRes.json());
    if (batchRes.ok) setBatches(await batchRes.json());
    if (branchRes.ok) {
      const bd = await branchRes.json();
      setBranches((bd.branches || []).map((b: any) => ({ slug: b.slug, name: b.name, color: b.color })));
    }
    setLoading(false);
  }, []);

  const fetchDebug = useCallback(async () => {
    setDebugLoading(true);
    const res = await adminFetch('/api/admin/distribution-debug');
    if (res.ok) {
      const d = await res.json();
      setDebugLeads(d.leads || []);
      setDebugSummary(d.summary || null);
    }
    setDebugLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDistribute = async () => {
    setDistributing(true);
    setDistResult(null);
    const res = await adminFetch('/api/admin/distribute', { method: 'POST' });
    if (res.ok) {
      setDistResult(await res.json());
      fetchData();
    }
    setDistributing(false);
  };

  const handleEnrich = async () => {
    setEnriching(true);
    setEnrichResult(null);
    const res = await adminFetch('/api/admin/leads/enrich', { method: 'POST' });
    if (res.ok) setEnrichResult(await res.json());
    setEnriching(false);
  };

  const getBranch = (slug: string) => branches.find(b => b.slug === slug);

  const handleCompensation = async (batchId: string) => {
    const amount = parseInt(compensationAmount);
    if (!amount || amount <= 0) return;
    setCompensating(true);
    const batch = batches.find(b => b.id === batchId);
    if (!batch) { setCompensating(false); return; }

    const res = await adminFetch('/api/admin/batches', {
      method: 'PUT',
      body: JSON.stringify({
        id: batchId,
        batch_size: batch.batch_size + amount,
        status: 'active',
        completed_at: null,
        notes: [batch.notes, `Compensatie: +${amount} leads${compensationNote ? ` (${compensationNote})` : ''}`].filter(Boolean).join(' | '),
      }),
    });
    if (res.ok) {
      setCompensatingBatch(null);
      setCompensationAmount('');
      setCompensationNote('');
      fetchData();
    } else {
      alert('Compensatie instellen mislukt');
    }
    setCompensating(false);
  };

  const activeBatches = batches.filter(b => b.status === 'active');
  const totalToDeliver = activeBatches.reduce((s, b) => s + b.batch_size, 0);
  const totalDelivered = activeBatches.reduce((s, b) => s + b.leads_delivered, 0);
  const overallPct = totalToDeliver > 0 ? Math.round((totalDelivered / totalToDeliver) * 100) : 0;
  const totalAssignments = assignments.length;

  const PERIOD_LABELS: Record<string, string> = {
    day: 'Vandaag', week: 'Week', month: 'Maand', quarter: 'Kwartaal', year: 'Jaar',
  };

  const getFilteredAssignments = useCallback(() => {
    const now = new Date();
    let start: Date;
    switch (timePeriod) {
      case 'day': start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
      case 'week': {
        start = new Date(now);
        start.setDate(start.getDate() - start.getDay() + (start.getDay() === 0 ? -6 : 1));
        start.setHours(0, 0, 0, 0);
        break;
      }
      case 'month': start = new Date(now.getFullYear(), now.getMonth(), 1); break;
      case 'quarter': start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); break;
      case 'year': start = new Date(now.getFullYear(), 0, 1); break;
      default: start = new Date(0);
    }
    return assignments.filter(a => new Date(a.assigned_at) >= start);
  }, [assignments, timePeriod]);

  const filteredAssignments = getFilteredAssignments();

  const customerBreakdown = (() => {
    const map: Record<string, { name: string; count: number }> = {};
    for (const a of filteredAssignments) {
      const name = a.customers?.name || 'Onbekend';
      if (!map[name]) map[name] = { name, count: 0 };
      map[name].count++;
    }
    return Object.values(map).sort((a, b) => b.count - a.count);
  })();

  const recentAssignments = assignments.slice(0, 50);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Leadverdeling</h1>
          <p className="mt-0.5 text-sm text-slate-500">Automatische lead distributie naar klanten</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleEnrich}
            disabled={enriching}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
          >
            {enriching ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <MapPinIcon className="h-4 w-4" />}
            Adressen aanvullen
          </button>
          <button
            onClick={handleDistribute}
            disabled={distributing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-button-gradient px-3.5 py-2 text-sm font-bold text-white shadow-sm disabled:opacity-60"
          >
            {distributing ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <ArrowsRightLeftIcon className="h-4 w-4" />}
            {distributing ? 'Verdelen...' : 'Verdeel leads'}
          </button>
        </div>
      </div>

      {/* Result banners */}
      <AnimatePresence>
        {distResult && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-800">
                {distResult.assignments > 0
                  ? `${distResult.distributed} leads verdeeld met ${distResult.assignments} toewijzingen`
                  : 'Geen nieuwe leads om te verdelen'}
              </span>
            </div>
            <button onClick={() => setDistResult(null)} className="text-emerald-500 hover:text-emerald-700"><XMarkIcon className="h-4 w-4" /></button>
          </motion.div>
        )}
        {enrichResult && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-4 flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <MapPinIcon className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">
                {enrichResult.enriched > 0
                  ? `${enrichResult.enriched} van ${enrichResult.total} leads aangevuld met adresgegevens`
                  : 'Alle leads zijn al aangevuld'}
              </span>
            </div>
            <button onClick={() => setEnrichResult(null)} className="text-blue-500 hover:text-blue-700"><XMarkIcon className="h-4 w-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats cards */}
      {loading ? (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />)}
        </div>
      ) : (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={ArrowsRightLeftIcon} label="Totaal toewijzingen" value={totalAssignments} color="purple" />
          <StatCard icon={ChartBarIcon} label="Actieve batches" value={activeBatches.length} color="emerald" />
          <StatCard icon={UserGroupIcon} label="Geleverd / Totaal" value={`${totalDelivered} / ${totalToDeliver}`} sub={`${overallPct}% compleet`} color="sky" />
          <StatCard icon={CurrencyEuroIcon} label="Totale omzet (actief)"
            value={`€${activeBatches.reduce((s, b) => s + Number(b.total_price || 0), 0).toLocaleString('nl-NL', { minimumFractionDigits: 0 })}`}
            color="amber" />
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1">
        {(['overzicht', 'leadstatus', 'assignments', 'batches'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); if (t === 'leadstatus' && debugLeads.length === 0) fetchDebug(); }}
            className={`flex-1 rounded-lg py-2 text-xs font-medium transition sm:text-sm ${tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t === 'overzicht' ? 'Overzicht' : t === 'leadstatus' ? 'Lead status' : t === 'assignments' ? 'Toewijzingen' : 'Alle batches'}
          </button>
        ))}
      </div>

      {tab === 'overzicht' && (
        <div className="space-y-6">
          {/* Period filter + stats */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <CalendarDaysIcon className="h-4 w-4 text-indigo-500" />
                <h3 className="text-sm font-semibold text-slate-700">Periode statistieken</h3>
              </div>
              <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                {Object.entries(PERIOD_LABELS).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setTimePeriod(key)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                      timePeriod === key
                        ? 'bg-white text-brand-purple shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-2xl font-bold text-slate-900">{filteredAssignments.length}</p>
                <p className="text-xs text-slate-500">Uitgedeeld</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-2xl font-bold text-slate-900">{customerBreakdown.length}</p>
                <p className="text-xs text-slate-500">Klanten bediend</p>
              </div>
              <div className="col-span-2 rounded-lg bg-slate-50 p-3 sm:col-span-1">
                <p className="text-2xl font-bold text-slate-900">
                  {filteredAssignments.filter(a => a.distance_km != null).length > 0
                    ? `${(filteredAssignments.filter(a => a.distance_km != null).reduce((s, a) => s + (a.distance_km || 0), 0) / filteredAssignments.filter(a => a.distance_km != null).length).toFixed(1)} km`
                    : '—'}
                </p>
                <p className="text-xs text-slate-500">Gem. afstand</p>
              </div>
            </div>

            {customerBreakdown.length > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Per klant</p>
                <div className="space-y-1.5">
                  {customerBreakdown.slice(0, 8).map(c => (
                    <div key={c.name} className="flex items-center justify-between">
                      <span className="truncate text-xs text-slate-600">{c.name}</span>
                      <span className="ml-2 shrink-0 text-xs font-semibold text-slate-800">{c.count}</span>
                    </div>
                  ))}
                  {customerBreakdown.length > 8 && (
                    <p className="text-xs text-slate-400">+{customerBreakdown.length - 8} meer</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Active batches */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Actieve batches voortgang</h3>
            {activeBatches.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center">
                <InboxIcon className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                <p className="text-sm text-slate-500">Geen actieve batches</p>
                <p className="text-xs text-slate-400">Maak batches aan bij klanten om de verdeling te starten</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeBatches.map(b => {
                  const pct = Math.min(100, Math.round((b.leads_delivered / b.batch_size) * 100));
                  const br = getBranch(b.branch);
                  const c = COLOR_MAP[br?.color || 'slate'] || COLOR_MAP.slate;
                  return (
                    <div key={b.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800">{b.customers?.name || 'Onbekend'}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${c.light} ${c.text}`}>
                            {br?.name || b.branch}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-slate-700">{b.leads_delivered}/{b.batch_size}</span>
                      </div>
                      <div className="mb-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? 'bg-blue-500' : pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-brand-purple'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>{pct}% compleet</span>
                        <span>Nog {b.batch_size - b.leads_delivered} te leveren</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'assignments' && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Recente toewijzingen</h3>
          {recentAssignments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center">
              <InboxIcon className="mx-auto mb-2 h-8 w-8 text-slate-300" />
              <p className="text-sm text-slate-500">Nog geen toewijzingen</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Lead</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Klant</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Branche</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Afstand</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Datum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentAssignments.map(a => {
                      const br = a.leads?.branch ? getBranch(a.leads.branch) : null;
                      const c = COLOR_MAP[br?.color || 'slate'] || COLOR_MAP.slate;
                      return (
                        <tr key={a.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-800">{a.leads?.naam_klant || '—'}</div>
                            <div className="text-xs text-slate-400">{a.leads?.plaatsnaam || a.leads?.postcode || ''}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{a.customers?.name || '—'}</td>
                          <td className="px-4 py-3">
                            {br && (
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${c.light} ${c.text}`}>
                                {br.name}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {a.distance_km != null ? `${a.distance_km} km` : '—'}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-400">
                            {new Date(a.assigned_at).toLocaleDateString('nl-NL')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'batches' && (() => {
        const active = batches.filter(b => b.status === 'active');
        const paused = batches.filter(b => b.status === 'paused');
        const completed = batches.filter(b => b.status === 'completed');
        const statusColors: Record<string, string> = { active: 'bg-emerald-100 text-emerald-700', paused: 'bg-amber-100 text-amber-700', completed: 'bg-blue-100 text-blue-700' };
        const statusLabels: Record<string, string> = { active: 'Actief', paused: 'Gepauzeerd', completed: 'Voltooid' };

        const completedRevenue = completed.reduce((s, b) => s + Number(b.total_price || 0), 0);
        const completedLeads = completed.reduce((s, b) => s + b.leads_delivered, 0);

        return (
          <div className="space-y-6">
            {/* Completed batches summary */}
            {completed.length > 0 && (
              <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-5">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <CheckCircleIcon className="h-4 w-4 text-blue-500" />
                  Afgeronde batches — samenvatting
                </h3>
                <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg bg-white p-3 shadow-sm">
                    <p className="text-xl font-bold text-slate-900">{completed.length}</p>
                    <p className="text-[11px] text-slate-500">Batches voltooid</p>
                  </div>
                  <div className="rounded-lg bg-white p-3 shadow-sm">
                    <p className="text-xl font-bold text-slate-900">{completedLeads}</p>
                    <p className="text-[11px] text-slate-500">Leads geleverd</p>
                  </div>
                  <div className="rounded-lg bg-white p-3 shadow-sm">
                    <p className="text-xl font-bold text-emerald-600">€{completedRevenue.toLocaleString('nl-NL', { minimumFractionDigits: 0 })}</p>
                    <p className="text-[11px] text-slate-500">Totale omzet</p>
                  </div>
                  <div className="rounded-lg bg-white p-3 shadow-sm">
                    <p className="text-xl font-bold text-slate-900">
                      {completedLeads > 0 ? `€${(completedRevenue / completedLeads).toFixed(2)}` : '—'}
                    </p>
                    <p className="text-[11px] text-slate-500">Gem. prijs/lead</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {completed.map(b => {
                    const br = getBranch(b.branch);
                    const c = COLOR_MAP[br?.color || 'slate'] || COLOR_MAP.slate;
                    const created = new Date(b.created_at);
                    const completedAt = b.completed_at ? new Date(b.completed_at) : null;
                    const durationDays = completedAt ? Math.max(1, Math.round((completedAt.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))) : null;
                    return (
                      <div key={b.id} className="rounded-lg bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-800">{b.customers?.name || '—'}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${c.light} ${c.text}`}>{br?.name || b.branch}</span>
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">Voltooid</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-700">{b.leads_delivered}/{b.batch_size}</span>
                            {compensatingBatch !== b.id && (
                              <button
                                onClick={() => { setCompensatingBatch(b.id); setCompensationAmount(''); setCompensationNote(''); }}
                                className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 transition hover:bg-amber-100"
                              >
                                Compensatie
                              </button>
                            )}
                          </div>
                        </div>

                        {compensatingBatch === b.id && (
                          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                            <p className="mb-2 text-xs font-semibold text-amber-800">Compensatie leads toevoegen</p>
                            <p className="mb-3 text-[11px] text-amber-700">Batch wordt opnieuw geactiveerd en ontvangt het opgegeven aantal extra leads via de normale distributie.</p>
                            <div className="mb-2 grid grid-cols-2 gap-2">
                              <div>
                                <label className="mb-0.5 block text-[11px] font-medium text-slate-500">Aantal extra leads *</label>
                                <input
                                  type="number" min={1} value={compensationAmount}
                                  onChange={e => setCompensationAmount(e.target.value)}
                                  placeholder="Bijv. 5"
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
                                />
                              </div>
                              <div>
                                <label className="mb-0.5 block text-[11px] font-medium text-slate-500">Reden (optioneel)</label>
                                <input
                                  value={compensationNote}
                                  onChange={e => setCompensationNote(e.target.value)}
                                  placeholder="Bijv. slechte leads"
                                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
                                />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => setCompensatingBatch(null)}
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50">
                                Annuleren
                              </button>
                              <button
                                onClick={() => handleCompensation(b.id)}
                                disabled={!compensationAmount || parseInt(compensationAmount) <= 0 || compensating}
                                className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-amber-600 disabled:opacity-50"
                              >
                                {compensating ? 'Bezig...' : `+${compensationAmount || '0'} leads toekennen`}
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                          {b.price_per_lead && <span>€{Number(b.price_per_lead).toFixed(2)}/lead</span>}
                          {b.total_price && <span className="font-medium text-emerald-600">Totaal: €{Number(b.total_price).toFixed(2)}</span>}
                          {b.leads_per_week && <span>{b.leads_per_week}/week</span>}
                          <span>Gestart: {created.toLocaleDateString('nl-NL')}</span>
                          {completedAt && <span>Voltooid: {completedAt.toLocaleDateString('nl-NL')}</span>}
                          {durationDays && <span>Duur: {durationDays} {durationDays === 1 ? 'dag' : 'dagen'}</span>}
                          {b.notes && <span className="italic">{b.notes}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Active + paused batches table */}
            {(active.length > 0 || paused.length > 0) && (
              <div>
                <h3 className="mb-3 text-sm font-semibold text-slate-700">Actieve &amp; gepauzeerde batches</h3>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/50">
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Klant</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Branche</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Voortgang</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Per week</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Prijs</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Aangemaakt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...active, ...paused].map(b => {
                          const pct = Math.min(100, Math.round((b.leads_delivered / b.batch_size) * 100));
                          const br = getBranch(b.branch);
                          const c = COLOR_MAP[br?.color || 'slate'] || COLOR_MAP.slate;
                          return (
                            <tr key={b.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                              <td className="px-4 py-3 font-medium text-slate-800">{b.customers?.name || '—'}</td>
                              <td className="px-4 py-3">
                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${c.light} ${c.text}`}>{br?.name || b.branch}</span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
                                    <div className={`h-full rounded-full ${pct >= 100 ? 'bg-blue-500' : 'bg-brand-purple'}`} style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="text-xs text-slate-500">{b.leads_delivered}/{b.batch_size}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColors[b.status] || 'bg-slate-100 text-slate-500'}`}>
                                  {statusLabels[b.status] || b.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-500">{b.leads_per_week || '∞'}</td>
                              <td className="px-4 py-3 text-slate-500">{b.price_per_lead ? `€${Number(b.price_per_lead).toFixed(2)}` : '—'}</td>
                              <td className="px-4 py-3 text-xs text-slate-400">{new Date(b.created_at).toLocaleDateString('nl-NL')}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {batches.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center">
                <InboxIcon className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                <p className="text-sm text-slate-500">Nog geen batches</p>
              </div>
            )}
          </div>
        );
      })()}

      {tab === 'leadstatus' && (
        <div>
          {debugLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}
            </div>
          ) : (
            <>
              {/* Summary banner */}
              {debugSummary && (
                <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <p className="text-lg font-bold text-slate-900">{debugSummary.total_leads}</p>
                    <p className="text-[11px] text-slate-500">Totaal leads</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <p className="text-lg font-bold text-emerald-600">{debugSummary.leads_with_coords}</p>
                    <p className="text-[11px] text-slate-500">Met coördinaten</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <p className="text-lg font-bold text-red-500">{debugSummary.leads_without_coords}</p>
                    <p className="text-[11px] text-slate-500">Zonder coördinaten</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <p className="text-lg font-bold text-brand-purple">{debugSummary.total_assignments}</p>
                    <p className="text-[11px] text-slate-500">Totaal toewijzingen</p>
                  </div>
                </div>
              )}

              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">Per lead: toewijzingen &amp; diagnose</h3>
                <button
                  onClick={fetchDebug}
                  disabled={debugLoading}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50"
                >
                  <ArrowPathIcon className={`h-3.5 w-3.5 ${debugLoading ? 'animate-spin' : ''}`} />
                  Vernieuwen
                </button>
              </div>

              {debugLeads.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center">
                  <InboxIcon className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                  <p className="text-sm text-slate-500">Geen leads gevonden</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {debugLeads.map(lead => {
                    const isExpanded = expandedLead === lead.id;
                    const br = getBranch(lead.branch);
                    const c = COLOR_MAP[br?.color || 'slate'] || COLOR_MAP.slate;
                    const unassigned = lead.potential_matches.filter(m => !m.assigned);
                    const hasIssue = !lead.has_coords || unassigned.some(m => m.reason_not_assigned);

                    return (
                      <div key={lead.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                        <button
                          onClick={() => setExpandedLead(isExpanded ? null : lead.id)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50/50"
                        >
                          {/* Status indicator */}
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                            !lead.has_coords ? 'bg-red-100' :
                            lead.assignment_count === 0 ? 'bg-amber-100' :
                            'bg-emerald-100'
                          }`}>
                            {!lead.has_coords ? (
                              <ExclamationCircleIcon className="h-4 w-4 text-red-500" />
                            ) : lead.assignment_count === 0 ? (
                              <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" />
                            ) : (
                              <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
                            )}
                          </div>

                          {/* Lead info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium text-slate-800">{lead.naam_klant || lead.email}</span>
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${c.light} ${c.text}`}>
                                {br?.name || lead.branch}
                              </span>
                            </div>
                            <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-400">
                              <span>{lead.plaatsnaam || lead.postcode || 'Geen locatie'}</span>
                              {!lead.has_coords && <span className="font-medium text-red-400">Geen coördinaten</span>}
                            </div>
                          </div>

                          {/* Assignment count */}
                          <div className="flex shrink-0 items-center gap-2">
                            <div className="flex gap-0.5">
                              {[0, 1, 2].map(i => (
                                <div
                                  key={i}
                                  className={`h-2 w-2 rounded-full ${
                                    i < lead.assignment_count ? 'bg-brand-purple' : 'bg-slate-200'
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-xs font-medium text-slate-500">{lead.assignment_count}/3</span>
                            <ChevronDownIcon className={`h-4 w-4 text-slate-400 transition ${isExpanded ? 'rotate-180' : ''}`} />
                          </div>
                        </button>

                        {/* Expanded detail */}
                        {isExpanded && (
                          <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3">
                            {/* Assigned customers */}
                            {lead.assignments.length > 0 && (
                              <div className="mb-3">
                                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Toegewezen aan</p>
                                <div className="space-y-1.5">
                                  {lead.assignments.map(a => (
                                    <div key={a.id} className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2">
                                      <div className="flex items-center gap-2">
                                        <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
                                        <span className="text-sm font-medium text-emerald-800">{a.customer_name}</span>
                                      </div>
                                      <div className="flex items-center gap-3 text-xs text-emerald-600">
                                        {a.distance_km != null && <span>{a.distance_km} km</span>}
                                        <span>{new Date(a.assigned_at).toLocaleDateString('nl-NL')}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Potential matches / reasons for not assigned */}
                            {unassigned.length > 0 && (
                              <div>
                                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Niet toegewezen — reden</p>
                                <div className="space-y-1.5">
                                  {unassigned.map(m => (
                                    <div key={m.customer_id} className="flex items-start justify-between rounded-lg bg-white px-3 py-2 ring-1 ring-slate-100">
                                      <div className="flex items-start gap-2">
                                        <ExclamationCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                                        <div>
                                          <span className="text-sm font-medium text-slate-700">{m.customer_name}</span>
                                          <p className="mt-0.5 text-xs text-slate-500">{m.reason_not_assigned}</p>
                                        </div>
                                      </div>
                                      {m.distance_km != null && (
                                        <span className="ml-2 shrink-0 text-xs text-slate-400">{m.distance_km} km</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {lead.assignments.length === 0 && unassigned.length === 0 && (
                              <p className="text-sm text-slate-400">Geen klanten met actieve batches voor deze branche</p>
                            )}

                            {/* Lead details */}
                            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-2 text-xs text-slate-400">
                              <span>Postcode: {lead.postcode || '—'}</span>
                              <span>Plaats: {lead.plaatsnaam || '—'}</span>
                              <span>Land: {lead.land || '—'}</span>
                              <span>Coords: {lead.has_coords ? `${lead.lat}, ${lead.lng}` : 'Geen'}</span>
                              <span>Aangemaakt: {new Date(lead.created_at).toLocaleDateString('nl-NL')}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  const colors: Record<string, { bg: string; icon: string }> = {
    purple: { bg: 'bg-purple-50', icon: 'text-purple-500' },
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-500' },
    sky: { bg: 'bg-sky-50', icon: 'text-sky-500' },
    amber: { bg: 'bg-amber-50', icon: 'text-amber-500' },
  };
  const c = colors[color] || colors.purple;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <div className={`rounded-lg p-2 ${c.bg}`}>
          <Icon className={`h-4 w-4 ${c.icon}`} />
        </div>
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      <div className="text-xl font-bold text-slate-800">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}
