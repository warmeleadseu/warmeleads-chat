'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlusIcon,
  XMarkIcon,
  TrashIcon,
  PencilSquareIcon,
  PauseIcon,
  PlayIcon,
  FunnelIcon,
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
  RectangleStackIcon,
  ChevronUpDownIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';

interface LeadFilter { field: string; operator: string; value: string; values?: string[] }
interface Batch {
  id: string; customer_id: string; branch: string; batch_size: number;
  price_per_lead: number | null; total_price: number | null;
  leads_per_week: number | null; leads_delivered: number; status: string;
  notes: string | null; lead_filters: LeadFilter[];
  created_at: string; completed_at: string | null;
  customers?: { name: string } | null;
}
interface BranchOption { slug: string; name: string; color: string; is_active: boolean }
interface Customer { id: string; name: string; is_active: boolean }
interface BranchField { id: string; key: string; label: string; field_type: string; options: string[] }

const STATUS_OPTS = [
  { value: 'all', label: 'Alle' },
  { value: 'active', label: 'Actief' },
  { value: 'paused', label: 'Gepauzeerd' },
  { value: 'completed', label: 'Afgerond' },
];

const SORT_OPTS = [
  { value: 'date', label: 'Datum' },
  { value: 'progress', label: 'Voortgang' },
  { value: 'customer', label: 'Klant' },
  { value: 'branch', label: 'Branche' },
];

const COLOR_MAP: Record<string, { light: string; text: string; bar: string }> = {
  emerald: { light: 'bg-emerald-50', text: 'text-emerald-600', bar: 'bg-emerald-500' },
  sky: { light: 'bg-sky-50', text: 'text-sky-600', bar: 'bg-sky-500' },
  amber: { light: 'bg-amber-50', text: 'text-amber-600', bar: 'bg-amber-500' },
  purple: { light: 'bg-purple-50', text: 'text-purple-600', bar: 'bg-purple-500' },
  rose: { light: 'bg-rose-50', text: 'text-rose-600', bar: 'bg-rose-500' },
  cyan: { light: 'bg-cyan-50', text: 'text-cyan-600', bar: 'bg-cyan-500' },
  lime: { light: 'bg-lime-50', text: 'text-lime-600', bar: 'bg-lime-500' },
  indigo: { light: 'bg-indigo-50', text: 'text-indigo-600', bar: 'bg-indigo-500' },
  teal: { light: 'bg-teal-50', text: 'text-teal-600', bar: 'bg-teal-500' },
  slate: { light: 'bg-slate-50', text: 'text-slate-600', bar: 'bg-slate-500' },
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-amber-100 text-amber-700',
  completed: 'bg-blue-100 text-blue-700',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Actief', paused: 'Gepauzeerd', completed: 'Afgerond',
};

export default function BatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editBatch, setEditBatch] = useState<Batch | null>(null);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [bRes, brRes, cRes] = await Promise.all([
      adminFetch('/api/admin/batches'),
      adminFetch('/api/admin/branches'),
      adminFetch('/api/admin/customers'),
    ]);
    if (bRes.ok) setBatches(await bRes.json());
    if (brRes.ok) { const d = await brRes.json(); setBranches(d.branches || []); }
    if (cRes.ok) { const d = await cRes.json(); setCustomers(d.customers || []); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleStatus = async (b: Batch) => {
    const newStatus = b.status === 'active' ? 'paused' : 'active';
    await adminFetch('/api/admin/batches', { method: 'PUT', body: JSON.stringify({ id: b.id, status: newStatus, completed_at: null }) });
    showToast(`Batch ${newStatus === 'active' ? 'geactiveerd' : 'gepauzeerd'}`);
    fetchData();
  };

  const removeBatch = async (b: Batch) => {
    const name = b.customers?.name || 'Onbekend';
    if (!confirm(`Batch van ${name} verwijderen?`)) return;
    await adminFetch(`/api/admin/batches?id=${b.id}`, { method: 'DELETE' });
    showToast('Batch verwijderd');
    fetchData();
  };

  const getBranch = (slug: string) => {
    const br = branches.find(b => b.slug === slug);
    return { name: br?.name || slug, color: br?.color || 'slate' };
  };

  const filtered = useMemo(() => {
    let list = [...batches];
    if (statusFilter !== 'all') list = list.filter(b => b.status === statusFilter);
    if (branchFilter !== 'all') list = list.filter(b => b.branch === branchFilter);
    if (customerFilter !== 'all') list = list.filter(b => b.customer_id === customerFilter);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(b => {
        const cName = (b.customers?.name || '').toLowerCase();
        return cName.includes(s) || b.branch.includes(s) || (b.notes || '').toLowerCase().includes(s);
      });
    }
    list.sort((a, b) => {
      if (sortBy === 'progress') {
        const pA = a.batch_size > 0 ? a.leads_delivered / a.batch_size : 0;
        const pB = b.batch_size > 0 ? b.leads_delivered / b.batch_size : 0;
        return pB - pA;
      }
      if (sortBy === 'customer') return (a.customers?.name || '').localeCompare(b.customers?.name || '');
      if (sortBy === 'branch') return a.branch.localeCompare(b.branch);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return list;
  }, [batches, statusFilter, branchFilter, customerFilter, search, sortBy]);

  const activeCount = batches.filter(b => b.status === 'active').length;
  const totalRemaining = batches.filter(b => b.status === 'active').reduce((s, b) => s + Math.max(0, b.batch_size - b.leads_delivered), 0);
  const totalDelivered = batches.reduce((s, b) => s + b.leads_delivered, 0);
  const avgProgress = batches.length > 0
    ? Math.round(batches.reduce((s, b) => s + (b.batch_size > 0 ? Math.min(100, (b.leads_delivered / b.batch_size) * 100) : 0), 0) / batches.length)
    : 0;

  const activeFilterCount = [statusFilter !== 'all', branchFilter !== 'all', customerFilter !== 'all'].filter(Boolean).length;

  const uniqueBranches = [...new Set(batches.map(b => b.branch))];
  const uniqueCustomers = [...new Set(batches.map(b => b.customer_id))];

  return (
    <div>
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-xl">
            <div className="flex items-center gap-2"><CheckCircleIcon className="h-4 w-4 text-emerald-400" />{toast}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Batches</h1>
          <p className="mt-0.5 text-sm text-slate-500">Beheer alle lead batches van al je klanten</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-button-gradient px-3.5 py-2 text-sm font-bold text-white shadow-sm">
          <PlusIcon className="h-4 w-4" /> Nieuwe batch
        </button>
      </div>

      {/* KPI cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Actieve batches', value: activeCount, color: 'text-emerald-600' },
          { label: 'Te leveren', value: totalRemaining, color: 'text-amber-600' },
          { label: 'Totaal geleverd', value: totalDelivered, color: 'text-brand-purple' },
          { label: 'Gem. voortgang', value: `${avgProgress}%`, color: 'text-blue-600' },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">{kpi.label}</p>
            <p className={`mt-1 text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Search + filter bar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Zoek op klant, branche..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/30" />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${
              activeFilterCount > 0 ? 'border-brand-purple bg-brand-purple/5 text-brand-purple' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}>
            <FunnelIcon className="h-4 w-4" /> Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
          </button>
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
            <ChevronUpDownIcon className="h-4 w-4 text-slate-400" />
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              className="bg-transparent text-sm text-slate-700 outline-none">
              {SORT_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Filter panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="mb-4 overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-500">Status</label>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none">
                  {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-500">Branche</label>
                <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none">
                  <option value="all">Alle</option>
                  {uniqueBranches.map(slug => <option key={slug} value={slug}>{getBranch(slug).name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-500">Klant</label>
                <select value={customerFilter} onChange={e => setCustomerFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none">
                  <option value="all">Alle</option>
                  {uniqueCustomers.map(cid => {
                    const c = customers.find(x => x.id === cid);
                    return <option key={cid} value={cid}>{c?.name || cid.slice(0, 8)}</option>;
                  })}
                </select>
              </div>
              {activeFilterCount > 0 && (
                <button onClick={() => { setStatusFilter('all'); setBranchFilter('all'); setCustomerFilter('all'); }}
                  className="mt-4 text-xs font-medium text-red-500 hover:text-red-600">Filters wissen</button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status tabs (quick filter) */}
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1" style={{ scrollbarWidth: 'none' }}>
        {STATUS_OPTS.map(o => {
          const count = o.value === 'all' ? batches.length : batches.filter(b => b.status === o.value).length;
          return (
            <button key={o.value} onClick={() => setStatusFilter(o.value)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition ${
                statusFilter === o.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {o.label} <span className="text-xs text-slate-400">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Batch list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <RectangleStackIcon className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="font-medium text-slate-600">{batches.length === 0 ? 'Nog geen batches' : 'Geen batches gevonden'}</p>
          <p className="mt-1 text-sm text-slate-400">{batches.length === 0 ? 'Maak een eerste batch aan' : 'Pas je filters aan'}</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Klant</th>
                  <th className="px-4 py-3">Branche</th>
                  <th className="px-4 py-3">Voortgang</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">€/lead</th>
                  <th className="px-4 py-3 text-right">Per week</th>
                  <th className="px-4 py-3">Filters</th>
                  <th className="px-4 py-3 text-right">Acties</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(b => {
                  const pct = b.batch_size > 0 ? Math.min(100, Math.round((b.leads_delivered / b.batch_size) * 100)) : 0;
                  const br = getBranch(b.branch);
                  const c = COLOR_MAP[br.color] || COLOR_MAP.slate;
                  return (
                    <tr key={b.id} className="group transition hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{b.customers?.name || 'Onbekend'}</p>
                        <p className="text-[11px] text-slate-400">{new Date(b.created_at).toLocaleDateString('nl-NL')}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${c.light} ${c.text}`}>{br.name}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-24">
                            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                              <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-blue-500' : pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-brand-purple'}`}
                                style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                          <span className="whitespace-nowrap text-xs text-slate-600">{b.leads_delivered}/{b.batch_size} <span className="text-slate-400">({pct}%)</span></span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[b.status]}`}>{STATUS_LABELS[b.status]}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {b.price_per_lead ? `€${Number(b.price_per_lead).toFixed(2)}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {b.leads_per_week || '∞'}
                      </td>
                      <td className="px-4 py-3">
                        {b.lead_filters && b.lead_filters.length > 0 ? (
                          <div className="flex items-center gap-1">
                            <AdjustmentsHorizontalIcon className="h-3.5 w-3.5 text-amber-500" />
                            <span className="text-xs text-amber-600">{b.lead_filters.length}</span>
                          </div>
                        ) : <span className="text-xs text-slate-300">-</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setEditBatch(b)} title="Bewerken"
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-brand-purple">
                            <PencilSquareIcon className="h-4 w-4" />
                          </button>
                          {b.status !== 'completed' && (
                            <button onClick={() => toggleStatus(b)} title={b.status === 'active' ? 'Pauzeren' : 'Heractiveren'}
                              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-amber-600">
                              {b.status === 'active' ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
                            </button>
                          )}
                          <button onClick={() => removeBatch(b)} title="Verwijderen"
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500">
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map(b => {
              const pct = b.batch_size > 0 ? Math.min(100, Math.round((b.leads_delivered / b.batch_size) * 100)) : 0;
              const br = getBranch(b.branch);
              const c = COLOR_MAP[br.color] || COLOR_MAP.slate;
              return (
                <div key={b.id} className={`rounded-xl border p-4 shadow-sm ${b.status === 'completed' ? 'border-blue-100 bg-blue-50/30' : b.status === 'paused' ? 'border-amber-100 bg-amber-50/20' : 'border-slate-200 bg-white'}`}>
                  <div className="mb-2 flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{b.customers?.name || 'Onbekend'}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${c.light} ${c.text}`}>{br.name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[b.status]}`}>{STATUS_LABELS[b.status]}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => setEditBatch(b)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-purple">
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      {b.status !== 'completed' && (
                        <button onClick={() => toggleStatus(b)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-amber-600">
                          {b.status === 'active' ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
                        </button>
                      )}
                      <button onClick={() => removeBatch(b)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500">
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {/* Progress */}
                  <div className="mb-2">
                    <div className="mb-1 flex items-baseline justify-between">
                      <span className="text-sm font-bold text-slate-800">{b.leads_delivered} / {b.batch_size}</span>
                      <span className="text-xs font-medium text-slate-500">{pct}%</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-blue-500' : pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-brand-purple'}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  {/* Details */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    {b.leads_per_week && <span className="font-medium text-brand-purple">{b.leads_per_week}/week</span>}
                    {b.price_per_lead && <span>€{Number(b.price_per_lead).toFixed(2)}/lead</span>}
                    <span>{new Date(b.created_at).toLocaleDateString('nl-NL')}</span>
                    {b.notes && <span className="italic">{b.notes}</span>}
                  </div>
                  {b.lead_filters && b.lead_filters.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <AdjustmentsHorizontalIcon className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                      {b.lead_filters.map((f, i) => {
                        const count = f.values?.length || (f.value ? 1 : 0);
                        return <span key={i} className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">{f.field}: {count} waarden</span>;
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Edit slide-over */}
      <AnimatePresence>
        {editBatch && (
          <EditBatchPanel
            batch={editBatch}
            branches={branches}
            customers={customers}
            onClose={() => setEditBatch(null)}
            onSaved={() => { setEditBatch(null); fetchData(); showToast('Batch bijgewerkt'); }}
          />
        )}
      </AnimatePresence>

      {/* Create slide-over */}
      <AnimatePresence>
        {showCreate && (
          <CreateBatchPanel
            branches={branches}
            customers={customers}
            onClose={() => setShowCreate(false)}
            onCreated={() => { setShowCreate(false); fetchData(); showToast('Batch aangemaakt'); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Edit Panel ──────────────────────────────────────────── */
function EditBatchPanel({ batch, branches, customers, onClose, onSaved }: {
  batch: Batch; branches: BranchOption[]; customers: Customer[];
  onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    batch_size: batch.batch_size,
    price_per_lead: batch.price_per_lead ? String(batch.price_per_lead) : '',
    leads_per_week: batch.leads_per_week ? String(batch.leads_per_week) : '',
    notes: batch.notes || '',
    lead_filters: batch.lead_filters || [],
  });
  const [saving, setSaving] = useState(false);
  const [branchFields, setBranchFields] = useState<BranchField[]>([]);

  useEffect(() => {
    adminFetch(`/api/admin/branches/fields?branch=${batch.branch}`)
      .then(r => r.ok ? r.json() : { fields: [] })
      .then(d => setBranchFields(d.fields || []))
      .catch(() => {});
  }, [batch.branch]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await adminFetch('/api/admin/batches', {
        method: 'PUT',
        body: JSON.stringify({
          id: batch.id,
          batch_size: form.batch_size,
          price_per_lead: form.price_per_lead ? parseFloat(form.price_per_lead) : null,
          leads_per_week: form.leads_per_week ? parseInt(form.leads_per_week) : null,
          notes: form.notes || null,
          lead_filters: form.lead_filters.filter(f => f.field && (f.values?.length || 0) > 0),
        }),
      });
      if (res.ok) onSaved();
      else { const d = await res.json(); alert(d.error || 'Opslaan mislukt'); }
    } catch { alert('Er ging iets mis'); }
    setSaving(false);
  };

  const br = branches.find(b => b.slug === batch.branch);
  const cust = customers.find(c => c.id === batch.customer_id);
  const pct = batch.batch_size > 0 ? Math.min(100, Math.round((batch.leads_delivered / batch.batch_size) * 100)) : 0;

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="shrink-0 border-b border-slate-100">
          <div className="h-[3px] bg-warmeleads-gradient" />
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Batch bewerken</h2>
              <p className="mt-0.5 text-xs text-slate-500">{cust?.name || 'Onbekend'} &middot; {br?.name || batch.branch}</p>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><XMarkIcon className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Current progress */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-sm font-bold text-slate-800">{batch.leads_delivered} / {batch.batch_size} geleverd</span>
              <span className="text-xs font-medium text-slate-500">{pct}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
              <div className={`h-full rounded-full ${pct >= 100 ? 'bg-blue-500' : pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-brand-purple'}`}
                style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">Status: {STATUS_LABELS[batch.status] || batch.status}</p>
          </div>

          {/* Fields */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Batch grootte</label>
              <input type="number" value={form.batch_size} onChange={e => setForm(f => ({ ...f, batch_size: Number(e.target.value) }))} min={1}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Per week</label>
              <input type="number" value={form.leads_per_week} onChange={e => setForm(f => ({ ...f, leads_per_week: e.target.value }))}
                placeholder="∞" min={1}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">€/lead</label>
              <input type="number" step="0.01" value={form.price_per_lead} onChange={e => setForm(f => ({ ...f, price_per_lead: e.target.value }))}
                placeholder="-"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Notities</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
          </div>

          {/* Lead filters */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Lead vereisten (filters)</label>
            <FilterEditor
              filters={form.lead_filters}
              onChange={filters => setForm(f => ({ ...f, lead_filters: filters }))}
              branchSlug={batch.branch}
              branchFields={branchFields}
            />
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-100 px-5 py-4">
          <button onClick={save} disabled={saving || form.batch_size < 1}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-button-gradient py-2.5 text-sm font-bold text-white disabled:opacity-50">
            {saving ? <><ArrowPathIcon className="h-4 w-4 animate-spin" /> Opslaan...</> : 'Wijzigingen opslaan'}
          </button>
        </div>
      </motion.div>
    </>
  );
}

/* ─── Create Panel ────────────────────────────────────────── */
function CreateBatchPanel({ branches, customers, onClose, onCreated }: {
  branches: BranchOption[]; customers: Customer[];
  onClose: () => void; onCreated: () => void;
}) {
  const [form, setForm] = useState({
    customer_id: '', branch: '', batch_size: 100,
    price_per_lead: '', leads_per_week: '', notes: '', lead_filters: [] as LeadFilter[],
  });
  const [saving, setSaving] = useState(false);
  const [branchFields, setBranchFields] = useState<BranchField[]>([]);

  useEffect(() => {
    if (!form.branch) { setBranchFields([]); return; }
    adminFetch(`/api/admin/branches/fields?branch=${form.branch}`)
      .then(r => r.ok ? r.json() : { fields: [] })
      .then(d => setBranchFields(d.fields || []))
      .catch(() => {});
  }, [form.branch]);

  const create = async () => {
    if (!form.customer_id || !form.branch || !form.batch_size) return;
    setSaving(true);
    try {
      const res = await adminFetch('/api/admin/batches', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: form.customer_id,
          branch: form.branch,
          batch_size: form.batch_size,
          price_per_lead: form.price_per_lead ? parseFloat(form.price_per_lead) : null,
          leads_per_week: form.leads_per_week ? parseInt(form.leads_per_week) : null,
          notes: form.notes || null,
          lead_filters: form.lead_filters.filter(f => f.field && (f.values?.length || 0) > 0),
        }),
      });
      if (res.ok) onCreated();
      else { const d = await res.json(); alert(d.error || 'Aanmaken mislukt'); }
    } catch { alert('Er ging iets mis'); }
    setSaving(false);
  };

  const activeCustomers = customers.filter(c => c.is_active);
  const activeBranches = branches.filter(b => b.is_active);

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="shrink-0 border-b border-slate-100">
          <div className="h-[3px] bg-warmeleads-gradient" />
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Nieuwe batch</h2>
              <p className="mt-0.5 text-xs text-slate-500">Maak een lead batch aan voor een klant</p>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><XMarkIcon className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Klant *</label>
            <select value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-purple/50">
              <option value="">Selecteer klant...</option>
              {activeCustomers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Branche *</label>
            <select value={form.branch} onChange={e => setForm(f => ({ ...f, branch: e.target.value, lead_filters: [] }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-purple/50">
              <option value="">Selecteer branche...</option>
              {activeBranches.map(b => <option key={b.slug} value={b.slug}>{b.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Batch grootte *</label>
              <input type="number" value={form.batch_size} onChange={e => setForm(f => ({ ...f, batch_size: Number(e.target.value) }))} min={1}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Per week</label>
              <input type="number" value={form.leads_per_week} onChange={e => setForm(f => ({ ...f, leads_per_week: e.target.value }))}
                placeholder="∞" min={1}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">€/lead</label>
              <input type="number" step="0.01" value={form.price_per_lead} onChange={e => setForm(f => ({ ...f, price_per_lead: e.target.value }))}
                placeholder="-"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Notities</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
          </div>

          {form.branch && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Lead vereisten (filters)</label>
              <FilterEditor
                filters={form.lead_filters}
                onChange={filters => setForm(f => ({ ...f, lead_filters: filters }))}
                branchSlug={form.branch}
                branchFields={branchFields}
              />
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-100 px-5 py-4">
          <button onClick={create} disabled={saving || !form.customer_id || !form.branch || form.batch_size < 1}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-button-gradient py-2.5 text-sm font-bold text-white disabled:opacity-50">
            {saving ? <><ArrowPathIcon className="h-4 w-4 animate-spin" /> Aanmaken...</> : <><PlusIcon className="h-4 w-4" /> Batch aanmaken</>}
          </button>
        </div>
      </motion.div>
    </>
  );
}

/* ─── Filter Editor (multi-select per field) ──────────────── */
function FilterEditor({ filters, onChange, branchSlug, branchFields }: {
  filters: LeadFilter[]; onChange: (f: LeadFilter[]) => void;
  branchSlug: string; branchFields: BranchField[];
}) {
  const [addingField, setAddingField] = useState('');

  const allFields = [
    ...branchFields.map(f => ({ key: f.key, label: f.label })),
    { key: 'quality_score', label: 'Kwaliteitsscore' },
    { key: 'phone_valid', label: 'Telefoon geldig' },
  ];

  const usedFields = new Set(filters.map(f => f.field));
  const availableFields = allFields.filter(f => !usedFields.has(f.key));

  const addFilter = () => {
    if (!addingField) return;
    onChange([...filters, { field: addingField, operator: 'in', value: '', values: [] }]);
    setAddingField('');
  };

  const removeFilter = (idx: number) => {
    onChange(filters.filter((_, i) => i !== idx));
  };

  const updateValues = (idx: number, values: string[]) => {
    const updated = [...filters];
    updated[idx] = { ...updated[idx], values };
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      {filters.map((f, i) => {
        const fieldLabel = allFields.find(af => af.key === f.field)?.label || f.field;
        return (
          <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700">{fieldLabel}</span>
              <button onClick={() => removeFilter(i)} className="text-xs text-red-500 hover:text-red-600">Verwijderen</button>
            </div>
            <FilterValuesSelect branchSlug={branchSlug} fieldKey={f.field} selected={f.values || []} onChange={vals => updateValues(i, vals)} />
          </div>
        );
      })}

      {availableFields.length > 0 && (
        <div className="flex items-center gap-2">
          <select value={addingField} onChange={e => setAddingField(e.target.value)}
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none">
            <option value="">Filter toevoegen...</option>
            {availableFields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          {addingField && (
            <button onClick={addFilter} className="rounded-lg bg-brand-purple px-3 py-2 text-sm font-medium text-white">
              <PlusIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Filter Values Multi-Select ──────────────────────────── */
function FilterValuesSelect({ branchSlug, fieldKey, selected, onChange }: {
  branchSlug: string; fieldKey: string; selected: string[]; onChange: (v: string[]) => void;
}) {
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminFetch(`/api/admin/leads/field-values?branch=${branchSlug}&field=${fieldKey}`)
      .then(r => r.ok ? r.json() : { values: [] })
      .then(d => setOptions(d.values || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [branchSlug, fieldKey]);

  const toggle = (val: string) => {
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);
  };

  if (loading) return <div className="h-8 animate-pulse rounded bg-slate-100" />;
  if (options.length === 0) return <p className="text-xs text-slate-400">Geen waarden gevonden</p>;

  return (
    <div className="max-h-40 space-y-1 overflow-y-auto">
      {options.map(opt => (
        <label key={opt} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-white">
          <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)}
            className="h-3.5 w-3.5 rounded border-slate-300 text-brand-purple focus:ring-brand-purple/30" />
          <span className="text-slate-700">{opt}</span>
        </label>
      ))}
    </div>
  );
}
