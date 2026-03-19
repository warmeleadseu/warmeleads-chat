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
  status: string;
  price_per_lead: number | null;
  total_price: number | null;
  notes: string | null;
  created_at: string;
  completed_at: string | null;
  customers: { name: string } | null;
}

interface BranchOption { slug: string; name: string; color: string; }

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
  const [tab, setTab] = useState<'overzicht' | 'assignments' | 'batches'>('overzicht');
  const [timePeriod, setTimePeriod] = useState<string>('week');

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
        {(['overzicht', 'assignments', 'batches'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t === 'overzicht' ? 'Overzicht' : t === 'assignments' ? 'Toewijzingen' : 'Alle batches'}
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

      {tab === 'batches' && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Alle batches</h3>
          {batches.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center">
              <InboxIcon className="mx-auto mb-2 h-8 w-8 text-slate-300" />
              <p className="text-sm text-slate-500">Nog geen batches</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Klant</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Branche</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Voortgang</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Prijs</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Aangemaakt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map(b => {
                      const pct = Math.min(100, Math.round((b.leads_delivered / b.batch_size) * 100));
                      const br = getBranch(b.branch);
                      const c = COLOR_MAP[br?.color || 'slate'] || COLOR_MAP.slate;
                      const statusColors: Record<string, string> = {
                        active: 'bg-emerald-100 text-emerald-700',
                        paused: 'bg-amber-100 text-amber-700',
                        completed: 'bg-blue-100 text-blue-700',
                      };
                      const statusLabels: Record<string, string> = { active: 'Actief', paused: 'Gepauzeerd', completed: 'Voltooid' };
                      return (
                        <tr key={b.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-medium text-slate-800">{b.customers?.name || '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${c.light} ${c.text}`}>
                              {br?.name || b.branch}
                            </span>
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
                          <td className="px-4 py-3 text-slate-500">
                            {b.price_per_lead ? `€${Number(b.price_per_lead).toFixed(2)}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-400">
                            {new Date(b.created_at).toLocaleDateString('nl-NL')}
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
