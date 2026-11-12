'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import ExterneFactuurKeuze, { beginStand, naarVelden, type ExterneFactuurStand } from '@/components/admin/ExterneFactuurKeuze';
import BatchWinstBlok from '@/components/admin/BatchWinstBlok';
import BatchHerkomstBlok from '@/components/admin/BatchHerkomstBlok';
import BetaalOpvolging from '@/components/admin/BetaalOpvolging';
import { type DirectStand } from '@/lib/directLeveren';
import Link from 'next/link';
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
  CalendarDaysIcon,
  ClockIcon,
  EnvelopeIcon,
  DocumentTextIcon,
  ArrowDownTrayIcon,
  DocumentDuplicateIcon,
  CheckBadgeIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  ShoppingCartIcon,
  ArrowTopRightOnSquareIcon,
  GlobeAltIcon,
  PhoneIcon,
  UserIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';
import { openCustomerPortalAsAdmin } from '@/lib/adminOpenPortal';
import BatchTargetsEditor from '@/components/admin/BatchTargetsEditor';
import { useAdmin } from '../adminContext';
import { isPipelineBatchKind } from '@/lib/batchKind';
import { isSellableLeadBranch } from '@/lib/branchPolicy';
import { behoudCampagneNamen, coerceCustomerBatchMetaCampaignIds, type MetaCampaignPick } from '@/lib/metaCampaignIds';
import { batchMatchesBranchDefault } from '@/lib/metaCampaignDefaults';
import { MetaCampaignLinkerFields } from './MetaCampaignLinkerFields';
import { BatchTargetAreaBadges } from '@/components/admin/BatchTargetAreaBadges';
import { BatchProgressDisplay } from '@/components/admin/BatchProgressDisplay';
import { getBatchProgressView, isCappedDeliveryModel } from '@/lib/batchDeliveryModel';
import { EmailPreviewModal } from '../_components/EmailPreviewModal';
import {
  metaFieldsFromPicks,
  uitgeslotenVanBatch,
  exclusieveCampagneLabel,
  alleenEigenCampagneLabel,
  picksFromBatchMeta,
  Compensation,
  Batch,
  isBulkLeadsBatch,
  isNicheResearchBatch,
  supportsBatchMetaCampaigns,
  showDistributionPriorityBadge,
  DistributionPriorityField,
  directLabel,
  DirectLeverenField,
  DagdoseringKeuze,
  batchProgressProps,
  BranchOption,
  Customer,
  BranchField,
  getNLOffset,
  formatStartsAt,
  startsAtInFuture,
  STATUS_OPTS,
  SORT_OPTS,
  COLOR_MAP,
  STATUS_COLORS,
  STATUS_LABELS,
  CreateBatchPanel,
  FilterEditor,
} from './batchFormulier';

function DoorloopChip({ b, klein }: { b: Pick<Batch, 'op_factuur' | 'gepauzeerd_reden' | 'is_paid'>; klein?: boolean }) {
  if (!b.op_factuur) return null;
  const maat = klein ? 'text-[10px]' : 'text-[11px]';
  if (b.gepauzeerd_reden === 'onbetaald') {
    return <span className={`rounded-full bg-red-100 px-2 py-0.5 ${maat} font-medium text-red-700`} title="Gepauzeerd: doorloopfactuur na 7 dagen niet betaald">Onbetaald</span>;
  }
  return (
    <span className={`rounded-full px-2 py-0.5 ${maat} font-medium ${b.is_paid ? 'bg-violet-50 text-violet-600' : 'bg-violet-100 text-violet-700'}`}
      title={b.is_paid ? 'Doorgelopen op factuur, factuur betaald' : 'Doorgelopen op factuur, factuur staat open (7 dagen)'}>
      {b.is_paid ? 'Doorgelopen' : 'Op factuur'}
    </span>
  );
}

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
  const [detailBatchId, setDetailBatchId] = useState<string | null>(null);
  /* Directe link vanuit een mail: /admin/batches?batch=<id> opent het detail. */
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('batch');
    if (id) setDetailBatchId(id);
  }, []);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [bRes, brRes, cRes] = await Promise.all([
      adminFetch('/api/admin/batches'),
      adminFetch('/api/admin/branches'),
      adminFetch('/api/admin/customers/options'),
    ]);
    if (bRes.ok) setBatches(await bRes.json());
    if (brRes.ok) { const d = await brRes.json(); setBranches(d.branches || []); }
    if (cRes.ok) { const d = await cRes.json(); setCustomers(d.customers || []); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleStatus = async (b: Batch) => {
    if (b.status === 'pending_payment' || b.is_paid === false) {
      showToast('Deze batch wacht op betaling. Pauzeren/heractiveren kan na betaling.');
      return;
    }
    const newStatus = b.status === 'active' ? 'paused' : 'active';
    await adminFetch('/api/admin/batches', { method: 'PUT', body: JSON.stringify({ id: b.id, status: newStatus, completed_at: null }) });
    showToast(`Batch ${newStatus === 'active' ? 'geactiveerd' : 'gepauzeerd'}`);
    fetchData();
  };

  /* Zelfde export als de Excel-knop bij de klant (tabblad Leads), gefilterd op deze batch. */
  const [exporterend, setExporterend] = useState<string | null>(null);
  const exportBatch = async (b: Batch) => {
    if (exporterend) return;
    setExporterend(b.id);
    try {
      const res = await adminFetch('/api/admin/assignments/export', {
        method: 'POST',
        body: JSON.stringify({ customer_id: b.customer_id, format: 'xlsx', all_filtered: true, filters: { batch_id: b.id } }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        showToast(d.error === 'Geen leads om te exporteren' ? 'Deze batch heeft nog geen leads' : (d.error || 'Export mislukt'));
        return;
      }
      const blob = await res.blob();
      const klant = (b.customers?.name || 'klant').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads-${klant}-${b.branch}-${String(b.created_at || '').slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('Leads van deze batch geëxporteerd als Excel');
    } catch {
      showToast('Export mislukt');
    } finally {
      setExporterend(null);
    }
  };

  const removeBatch = async (b: Batch) => {
    const name = b.customers?.name || 'Onbekend';
    if (!confirm(`Batch van ${name} verwijderen?`)) return;
    await adminFetch(`/api/admin/batches?id=${b.id}`, { method: 'DELETE' });
    showToast('Batch verwijderd');
    fetchData();
  };

  const getBranch = (slug: string) => {
    if (slug === 'niche_research') return { name: 'Niche-onderzoek', color: 'purple' };
    const br = branches.find(b => b.slug === slug);
    return { name: br?.name || slug, color: br?.color || 'slate' };
  };

  const filtered = useMemo(() => {
    let list = [...batches];
    /* Verlopen offertes alleen via hun eigen filter, anders vervuilen ze de lijst. */
    if (statusFilter !== 'all') list = list.filter(b => b.status === statusFilter);
    else list = list.filter(b => b.status !== 'expired');
    if (branchFilter !== 'all') list = list.filter(b => b.branch === branchFilter);
    if (customerFilter !== 'all') list = list.filter(b => b.customer_id === customerFilter);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(b => {
        const cName = (b.customers?.name || '').toLowerCase();
        return cName.includes(s) || b.branch.includes(s) || (b.notes || '').toLowerCase().includes(s)
          || (b.niche_title || '').toLowerCase().includes(s);
      });
    }
    list.sort((a, b) => {
      if (sortBy === 'progress') {
        const pA = getBatchProgressView(batchProgressProps(a)).sortProgress;
        const pB = getBatchProgressView(batchProgressProps(b)).sortProgress;
        return pB - pA;
      }
      if (sortBy === 'customer') return (a.customers?.name || '').localeCompare(b.customers?.name || '');
      if (sortBy === 'branch') return a.branch.localeCompare(b.branch);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return list;
  }, [batches, statusFilter, branchFilter, customerFilter, search, sortBy]);

  const activeCount = batches.filter(b => b.status === 'active').length;
  const pendingPayCount = batches.filter(b => b.status === 'pending_payment').length;
  const totalRemaining = batches
    .filter(b => b.status === 'active' && isCappedDeliveryModel(b.delivery_model, b.batch_kind))
    .reduce((s, b) => s + Math.max(0, b.batch_size - b.leads_delivered), 0);
  const totalDelivered = batches.reduce((s, b) => s + b.leads_delivered, 0);
  const cappedForAvg = batches.filter(b => isCappedDeliveryModel(b.delivery_model, b.batch_kind));
  const avgProgress = cappedForAvg.length > 0
    ? Math.round(
        cappedForAvg.reduce(
          (s, b) => s + (b.batch_size > 0 ? Math.min(100, (b.leads_delivered / b.batch_size) * 100) : 0),
          0,
        ) / cappedForAvg.length,
      )
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

      <div className="mb-5 flex gap-3 rounded-xl border border-sky-200 bg-sky-50/90 px-4 py-3 text-sm text-sky-950">
        <InformationCircleIcon className="h-5 w-5 shrink-0 text-sky-600" />
        <p>
          <Link href="/admin/batch-levering" className="font-semibold text-sky-900 underline decoration-sky-400/60 hover:decoration-sky-800">
            Levering batches
          </Link>
          {' — '}zie in één oogopslag of klanten hun <strong>afgesproken maximum per dag</strong> halen (incl. tips bij achterstand).
        </p>
      </div>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Batches</h1>
          <p className="mt-0.5 text-sm text-slate-500">Beheer alle lead batches van al je klanten</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-button-gradient px-3.5 py-2.5 text-sm font-bold text-white shadow-sm">
          <PlusIcon className="h-4 w-4" /> Nieuwe batch
        </button>
      </div>

      {/* KPI cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: 'Actieve batches', value: activeCount, color: 'text-emerald-600' },
          { label: 'Wacht op betaling', value: pendingPayCount, color: 'text-orange-600' },
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
        <div className="flex flex-wrap items-center gap-2">
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
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Klant</th>
                  <th className="px-4 py-3">Branche</th>
                  <th className="px-4 py-3">Targetgebieden</th>
                  <th className="px-4 py-3">Voortgang</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">€/lead</th>
                  <th className="px-4 py-3 text-right">Per dag</th>
                  <th className="px-4 py-3 text-right">Per week</th>
                  <th className="px-4 py-3">Filters</th>
                  <th className="px-4 py-3 text-right">Acties</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(b => {
                  const br = getBranch(b.branch);
                  const c = COLOR_MAP[br.color] || COLOR_MAP.slate;
                  const compTotal = (Array.isArray(b.compensations) ? b.compensations : []).reduce((s: number, x: Compensation) => s + x.amount, 0);
                  const metaLinkCount = coerceCustomerBatchMetaCampaignIds(b.meta_campaign_ids).length;
                  return (
                    <tr key={b.id} onClick={() => setDetailBatchId(b.id)} className="group cursor-pointer transition hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{b.customers?.name || 'Onbekend'}</p>
                        <p className="text-[11px] text-slate-400">{new Date(b.created_at).toLocaleDateString('nl-NL')}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${c.light} ${c.text}`}>{br.name}</span>
                      </td>
                      <td className="max-w-[14rem] px-4 py-3 align-top">
                        <BatchTargetAreaBadges customers={b.customers} batchTargets={b.batch_targets} variant="compact" />
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <BatchProgressDisplay {...batchProgressProps(b)} size="sm" />
                          {compTotal > 0 && (
                            <p className="mt-0.5 whitespace-nowrap text-[10px] font-medium text-emerald-600">+{compTotal} compensatie</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[b.status] || 'bg-slate-100 text-slate-600'}`}>{STATUS_LABELS[b.status] || b.status}</span>
                          <DoorloopChip b={b} />
                          {isBulkLeadsBatch(b) && (
                            <span className="w-fit rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800">Bulk</span>
                          )}
                          {(b.batch_kind || '') === 'niche_research' && (
                            <span className="w-fit rounded-full bg-fuchsia-100 px-2 py-0.5 text-[10px] font-semibold text-fuchsia-900">Onderzoek</span>
                          )}
                          {!b.is_paid && (
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">Onbetaald</span>
                          )}
                          {b.starts_at && new Date(b.starts_at) > new Date() && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                              <ClockIcon className="h-3 w-3" />
                              Start {formatStartsAt(b.starts_at)}
                            </span>
                          )}
                          {supportsBatchMetaCampaigns(b.batch_kind) && metaLinkCount > 0 && (
                            <span className="inline-flex w-fit items-center gap-0.5 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-800">
                              <GlobeAltIcon className="h-3 w-3 shrink-0" aria-hidden />
                              Meta · {metaLinkCount}
                            </span>
                          )}
                          {alleenEigenCampagneLabel(b) && (
                            <span title="Krijgt alleen leads uit de gekoppelde campagnes" className="inline-flex w-fit items-center rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800">
                              Alleen eigen campagne
                            </span>
                          )}
                          {exclusieveCampagneLabel(b) && (
                            <span title={exclusieveCampagneLabel(b) ?? undefined} className="inline-flex w-fit items-center rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800">
                              Exclusief
                            </span>
                          )}
                          {directLabel(b) && (
                            <span title={directLabel(b) ?? undefined} className="inline-flex w-fit items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                              <BoltIcon className="h-3 w-3 shrink-0" aria-hidden />
                              Direct
                            </span>
                          )}
                          {showDistributionPriorityBadge(b) && (
                            <span className="inline-flex w-fit items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                              <BoltIcon className="h-3 w-3 shrink-0" aria-hidden />
                              Voorrang
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {b.price_per_lead ? `€${Number(b.price_per_lead).toFixed(2)}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {b.leads_per_day || '∞'}
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
                          <button onClick={e => { e.stopPropagation(); setEditBatch(b); }} title="Bewerken"
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-brand-purple">
                            <PencilSquareIcon className="h-4 w-4" />
                          </button>
                          <button onClick={e => { e.stopPropagation(); exportBatch(b); }} title="Leads van deze batch exporteren als Excel"
                            disabled={exporterend === b.id}
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-emerald-600 disabled:animate-pulse disabled:opacity-60">
                            <ArrowDownTrayIcon className="h-4 w-4" />
                          </button>
                          {b.status !== 'completed' && b.status !== 'pending_payment' && b.status !== 'expired' && (
                            <button onClick={e => { e.stopPropagation(); toggleStatus(b); }} title={b.status === 'active' ? 'Pauzeren' : 'Heractiveren'}
                              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-amber-600">
                              {b.status === 'active' ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
                            </button>
                          )}
                          <button onClick={e => { e.stopPropagation(); removeBatch(b); }} title="Verwijderen"
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-500">
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
              const br = getBranch(b.branch);
              const c = COLOR_MAP[br.color] || COLOR_MAP.slate;
              const mobileCompTotal = (Array.isArray(b.compensations) ? b.compensations : []).reduce((s: number, x: Compensation) => s + x.amount, 0);
              const metaLinkCount = coerceCustomerBatchMetaCampaignIds(b.meta_campaign_ids).length;
              return (
                <div key={b.id} onClick={() => setDetailBatchId(b.id)} className={`cursor-pointer rounded-xl border p-4 shadow-sm transition hover:shadow-md ${b.status === 'completed' ? 'border-blue-100 bg-blue-50/30' : b.status === 'paused' ? 'border-amber-100 bg-amber-50/20' : b.status === 'pending_payment' ? 'border-orange-100 bg-orange-50/25' : 'border-slate-200 bg-white'}`}>
                  <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">{b.customers?.name || 'Onbekend'}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${c.light} ${c.text}`}>{br.name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[b.status] || 'bg-slate-100 text-slate-600'}`}>{STATUS_LABELS[b.status] || b.status}</span>
                        <DoorloopChip b={b} klein />
                        {isBulkLeadsBatch(b) && (
                          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800">Bulk</span>
                        )}
                        {(b.batch_kind || '') === 'niche_research' && (
                          <span className="rounded-full bg-fuchsia-100 px-2 py-0.5 text-[10px] font-semibold text-fuchsia-900">Onderzoek</span>
                        )}
                        {!b.is_paid && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">Onbetaald</span>}
                        {b.starts_at && new Date(b.starts_at) > new Date() && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            <ClockIcon className="h-3 w-3" />
                            Start {formatStartsAt(b.starts_at)}
                          </span>
                        )}
                        {supportsBatchMetaCampaigns(b.batch_kind) && metaLinkCount > 0 && (
                          <span className="inline-flex items-center gap-0.5 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-800">
                            <GlobeAltIcon className="h-3 w-3 shrink-0" aria-hidden />
                            Meta · {metaLinkCount}
                          </span>
                        )}
                        {alleenEigenCampagneLabel(b) && (
                          <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800">
                            Alleen eigen campagne
                          </span>
                        )}
                        {directLabel(b) && (
                          <span title={directLabel(b) ?? undefined} className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                            <BoltIcon className="h-3 w-3 shrink-0" aria-hidden />
                            Direct
                          </span>
                        )}
                        {showDistributionPriorityBadge(b) && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                            <BoltIcon className="h-3 w-3 shrink-0" aria-hidden />
                            Voorrang
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button onClick={e => { e.stopPropagation(); setEditBatch(b); }} className="rounded-lg p-2.5 text-slate-400 hover:bg-slate-100 hover:text-brand-purple">
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      <button onClick={e => { e.stopPropagation(); exportBatch(b); }} title="Leads exporteren als Excel"
                        disabled={exporterend === b.id}
                        className="rounded-lg p-2.5 text-slate-400 hover:bg-slate-100 hover:text-emerald-600 disabled:animate-pulse disabled:opacity-60">
                        <ArrowDownTrayIcon className="h-4 w-4" />
                      </button>
                      {b.status !== 'completed' && b.status !== 'pending_payment' && b.status !== 'expired' && (
                        <button onClick={e => { e.stopPropagation(); toggleStatus(b); }} className="rounded-lg p-2.5 text-slate-400 hover:bg-slate-100 hover:text-amber-600">
                          {b.status === 'active' ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
                        </button>
                      )}
                      <button onClick={e => { e.stopPropagation(); removeBatch(b); }} className="rounded-lg p-2.5 text-slate-400 hover:bg-red-50 hover:text-red-500">
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mb-2">
                    <BatchTargetAreaBadges customers={b.customers} batchTargets={b.batch_targets} variant="compact" />
                  </div>
                  <div className="mb-2">
                    <BatchProgressDisplay {...batchProgressProps(b)} size="md" />
                    {mobileCompTotal > 0 && (
                      <p className="mt-1 text-[10px] font-medium text-emerald-600">+{mobileCompTotal} compensatie</p>
                    )}
                  </div>
                  {/* Details */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    {b.leads_per_day && <span className="font-medium text-brand-purple">{b.leads_per_day}/dag</span>}
                    {b.leads_per_week && <span className="font-medium text-brand-purple">{b.leads_per_week}/week</span>}
                    {b.price_per_lead && <span>€{Number(b.price_per_lead).toFixed(2)}/lead</span>}
                    <span>{new Date(b.created_at).toLocaleDateString('nl-NL')}</span>
                    {b.notes && <span className="line-clamp-2 break-words italic">{b.notes}</span>}
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

      {/* Detail slide-over */}
      <AnimatePresence>
        {detailBatchId && (
          <BatchDetailPanel
            batchId={detailBatchId}
            branches={branches}
            onClose={() => setDetailBatchId(null)}
            onEdit={(b) => { setDetailBatchId(null); setEditBatch(b); }}
            onListRefresh={fetchData}
          />
        )}
      </AnimatePresence>

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

/** Meta koppeling in detail-drawer (zelfde API als batch bewerken). */
function BatchDetailMetaBlock({
  batch,
  onReload,
  onListRefresh,
}: {
  batch: Batch;
  onReload: () => Promise<void>;
  onListRefresh?: () => void;
}) {
  const serverIds = coerceCustomerBatchMetaCampaignIds(batch.meta_campaign_ids);
  const serverIdsKey = serverIds.join(',');

  const [metaCampaignPicks, setMetaCampaignPicks] = useState<MetaCampaignPick[]>(() => picksFromBatchMeta(batch));
  const [campagneUitgesloten, setCampagneUitgesloten] = useState<MetaCampaignPick[]>(() => uitgeslotenVanBatch(batch));
  const [alleenEigen, setAlleenEigen] = useState(() => batch.alleen_eigen_campagne === true);
  useEffect(() => { setAlleenEigen(batch.alleen_eigen_campagne === true); }, [batch.id, batch.alleen_eigen_campagne]);
  const { user: metaBewerker } = useAdmin();
  const toonCampagneRegels = isPipelineBatchKind(batch.batch_kind);
  const [metaSyncEnabled, setMetaSyncEnabled] = useState(() => batch.meta_campaign_sync_enabled !== false);
  const [savingMeta, setSavingMeta] = useState(false);
  // Match-aware staat:
  //  - `defaultExists`: heeft deze klant+branche een actieve default?
  //  - `defaultMatches`: zijn de IDs/sync-vlag van deze batch identiek aan de default?
  //  - `saveBranchMetaDefault`: vinkje-state, geïnitialiseerd op `defaultMatches`.
  // Door de drie afzonderlijk te tracken kunnen we voorkomen dat een save op
  // batch Y stilletjes de default van batch X overschrijft.
  const [saveBranchMetaDefault, setSaveBranchMetaDefault] = useState(false);
  const [initialSaveBranchMetaDefault, setInitialSaveBranchMetaDefault] = useState(false);
  const [defaultExists, setDefaultExists] = useState(false);
  const [defaultLoaded, setDefaultLoaded] = useState(false);

  useEffect(() => {
    if (!supportsBatchMetaCampaigns(batch.batch_kind)) return;
    setMetaCampaignPicks(prev => behoudCampagneNamen(picksFromBatchMeta(batch), prev));
    setCampagneUitgesloten(prev => behoudCampagneNamen(uitgeslotenVanBatch(batch), prev));
  }, [batch.batch_kind, batch.id, serverIdsKey, batch.meta_campaign_paused_ids, JSON.stringify(batch.meta_campagne_exclusief ?? {}), (batch.meta_campagne_uitgesloten ?? []).join(',')]);

  useEffect(() => {
    setMetaSyncEnabled(batch.meta_campaign_sync_enabled !== false);
  }, [batch.meta_campaign_sync_enabled, batch.id]);

  // Stabiele fingerprint van de meta-staat van de batch zodat de fetch alleen
  // re-runt wanneer relevante velden wijzigen (niet bij elke parent re-render).
  const batchMetaFingerprint = `${batch.id}|${batch.batch_kind || ''}|${batch.customer_id}|${batch.branch}|${batch.lead_branch_slug || ''}|${serverIdsKey}|${coerceCustomerBatchMetaCampaignIds(batch.meta_campaign_paused_ids).join(',')}|${batch.meta_campaign_sync_enabled !== false ? 1 : 0}`;

  const reloadBranchDefault = useCallback(async () => {
    if (!supportsBatchMetaCampaigns(batch.batch_kind)) {
      setDefaultLoaded(true);
      return;
    }
    const params = new URLSearchParams({
      customer_id: batch.customer_id,
      branch: batch.branch,
      batch_kind: batch.batch_kind || '',
    });
    if (batch.lead_branch_slug) params.set('lead_branch_slug', batch.lead_branch_slug);
    try {
      const res = await adminFetch(`/api/admin/customer-branch-meta-defaults?${params.toString()}`);
      if (res.ok) {
        const d = await res.json();
        const exists = Boolean(d?.exists);
        const matches = exists && batchMatchesBranchDefault(batch, {
          meta_campaign_ids: Array.isArray(d.meta_campaign_ids) ? d.meta_campaign_ids : [],
          meta_campaign_paused_ids: Array.isArray(d.meta_campaign_paused_ids) ? d.meta_campaign_paused_ids : [],
          meta_campaign_sync_enabled: d.meta_campaign_sync_enabled !== false,
        });
        setDefaultExists(exists);
        setSaveBranchMetaDefault(matches);
        setInitialSaveBranchMetaDefault(matches);
      }
    } catch { /* niet-blokkerend */ } finally {
      setDefaultLoaded(true);
    }
    // We willen reload wanneer de meta-fingerprint (id/branch/IDs/paused/sync)
    // wijzigt, óók al gebruikt de body `batch` direct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchMetaFingerprint]);

  useEffect(() => {
    setDefaultLoaded(false);
    void reloadBranchDefault();
  }, [reloadBranchDefault]);

  const saveMeta = async () => {
    setSavingMeta(true);
    try {
      // Stuur het vinkje alleen mee als er werkelijk iets te doen is op de
      // default. Anders laten we de server-state ongemoeid (geen silent
      // overwrite van een default die door een andere batch is gezet).
      let savePayload: { save_branch_meta_default?: boolean } = {};
      if (saveBranchMetaDefault) {
        // Aan: upsert (zet deze batch's koppeling als de actieve standaard).
        savePayload = { save_branch_meta_default: true };
      } else if (initialSaveBranchMetaDefault) {
        // Was aan, nu uit: deze batch was de standaard → expliciet verwijderen.
        savePayload = { save_branch_meta_default: false };
      }
      // Geval "vinkje uit en nooit aan geweest voor deze batch": niets
      // versturen → een eventueel door een andere batch gezette default
      // blijft intact.

      const res = await adminFetch('/api/admin/batches', {
        method: 'PUT',
        body: JSON.stringify({
          id: batch.id,
          ...metaFieldsFromPicks(metaCampaignPicks, toonCampagneRegels ? campagneUitgesloten : undefined, toonCampagneRegels ? alleenEigen : undefined),
          meta_campaign_sync_enabled: metaSyncEnabled,
          ...savePayload,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Opslaan mislukt');
      }
      await onReload();
      onListRefresh?.();
      await reloadBranchDefault();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Opslaan mislukt');
    } finally {
      setSavingMeta(false);
    }
  };

  if (!supportsBatchMetaCampaigns(batch.batch_kind)) return null;

  const nicheMeta = isNicheResearchBatch(batch);

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3.5">
      <MetaCampaignLinkerFields
        title="Meta campagnes"
        helpText={
          nicheMeta ? (
            <>
              Koppel campagnes voor dit onderzoek. Bij een <strong>actieve, betaalde</strong> batch en sync aan gaan ze op{' '}
              <strong>ACTIVE</strong> in Meta (onderzoek heeft geen batch-cap). Bij <strong>pauzeren</strong> van de batch
              of uitzetten van sync worden ze gepauzeerd.
            </>
          ) : (
            <>
              Zoek op naam (zoals in Ads Manager). Je kunt <strong>meerdere</strong> campagnes koppelen (zelfde batch, zelfde
              pauze/active-logica). Bij <strong>pauzeren</strong> van de batch worden alle gekoppelde campagnes in Meta
              mee gepauzeerd.
            </>
          )
        }
        picks={metaCampaignPicks}
        setPicks={setMetaCampaignPicks}
        syncEnabled={metaSyncEnabled}
        setSyncEnabled={setMetaSyncEnabled}
        campagneRegels={toonCampagneRegels ? { magWijzigen: metaBewerker.role !== 'accountmanager', uitgesloten: campagneUitgesloten, setUitgesloten: setCampagneUitgesloten, alleenEigen, setAlleenEigen } : undefined}
        syncStatusSlot={
          (batch.meta_sync_last_error || batch.meta_sync_last_success_at) ? (
            <div className="mt-2 space-y-0.5 border-t border-indigo-200/60 pt-2 text-[10px] text-indigo-900/70">
              {batch.meta_sync_last_success_at && (
                <p>Laatste sync: {new Date(batch.meta_sync_last_success_at).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })}</p>
              )}
              {batch.meta_sync_last_error && <p className="text-rose-700">{batch.meta_sync_last_error}</p>}
            </div>
          ) : null
        }
      />

      <label className="mt-2 flex cursor-pointer items-start gap-2 rounded-lg border border-indigo-100 bg-white px-3 py-2 text-[11px] leading-snug text-indigo-950">
        <input
          type="checkbox"
          checked={saveBranchMetaDefault}
          onChange={e => setSaveBranchMetaDefault(e.target.checked)}
          disabled={!defaultLoaded}
          className="mt-0.5 shrink-0"
        />
        <span>
          <strong>Standaard voor nieuwe batches</strong>{' '}
          {defaultLoaded && initialSaveBranchMetaDefault && (
            <span className="rounded-full bg-emerald-100 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-emerald-800">
              actief
            </span>
          )}
          {defaultLoaded && !initialSaveBranchMetaDefault && defaultExists && (
            <span className="rounded-full bg-amber-100 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-amber-800">
              andere batch is standaard
            </span>
          )}
          <span className="block">
            Toekomstige batches voor deze klant
            {nicheMeta && batch.lead_branch_slug ? (
              <>
                {' '}
                + inbound branche <strong className="font-mono text-[10px]">{batch.lead_branch_slug}</strong>
              </>
            ) : (
              <> + branche</>
            )}{' '}
            erven deze meta-koppeling automatisch (tenzij handmatig overschreven).
            {defaultLoaded && initialSaveBranchMetaDefault && (
              <> Uitvinken &amp; opslaan verwijdert de standaard.</>
            )}
            {defaultLoaded && !initialSaveBranchMetaDefault && defaultExists && (
              <> Aanvinken &amp; opslaan zet deze batch&apos;s koppeling als nieuwe standaard.</>
            )}
          </span>
        </span>
      </label>

      <button
        type="button"
        onClick={saveMeta}
        disabled={savingMeta}
        className="mt-3 w-full rounded-lg bg-indigo-600 py-2 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50"
      >
        {savingMeta ? 'Opslaan…' : 'Koppelingen opslaan'}
      </button>
    </div>
  );
}

/* ─── Detail Panel ────────────────────────────────────────── */
interface OrderInfo { id: string; branch: string; batch_size: number; price_per_lead: number; total_price: number; status: string; mollie_payment_id: string | null; created_at: string; paid_at: string | null }
interface InvoiceInfo { id: string; invoice_number: string | null; description: string | null; subtotal: number; btw_percentage: number; btw_amount: number; total_incl_btw: number; status: string; paid_at: string | null; created_at: string; uploaded_pdf_path: string | null }

interface AMOption { id: string; name: string; avatar_url?: string | null }
interface AdminUserOption extends AMOption { is_account_manager?: boolean; is_active?: boolean }

function BatchDetailPanel({ batchId, branches, onClose, onEdit, onListRefresh }: {
  batchId: string; branches: BranchOption[];
  onClose: () => void; onEdit: (b: Batch) => void;
  onListRefresh?: () => void;
}) {
  const { user: currentUser } = useAdmin();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [orders, setOrders] = useState<OrderInfo[]>([]);
  const [invoices, setInvoices] = useState<InvoiceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [amOptions, setAmOptions] = useState<AMOption[]>([]);
  const [savingAM, setSavingAM] = useState(false);
  const [reminderFeedback, setReminderFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [invoiceSendFeedback, setInvoiceSendFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [invoicePreviewOpen, setInvoicePreviewOpen] = useState(false);
  const [reminderPreviewOpen, setReminderPreviewOpen] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [portalOpenError, setPortalOpenError] = useState<string | null>(null);
  const [pauseBusy, setPauseBusy] = useState(false);

  const reloadDetailBatch = useCallback(async () => {
    const r = await adminFetch(`/api/admin/batches/${batchId}`);
    if (!r.ok) return;
    const d = await r.json();
    if (d?.batch) {
      setBatch(d.batch);
      setOrders(d.orders || []);
      setInvoices(d.invoices || []);
    }
  }, [batchId]);

  useEffect(() => {
    setPortalOpenError(null);
  }, [batchId]);

  const togglePauseInDetail = async () => {
    if (!batch || batch.status === 'pending_payment' || batch.is_paid === false || batch.status === 'completed') return;
    setPauseBusy(true);
    try {
      const newStatus = batch.status === 'active' ? 'paused' : 'active';
      const res = await adminFetch('/api/admin/batches', {
        method: 'PUT',
        body: JSON.stringify({ id: batch.id, status: newStatus, completed_at: null }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || 'Status wijzigen mislukt');
        return;
      }
      await reloadDetailBatch();
      onListRefresh?.();
    } finally {
      setPauseBusy(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setReminderFeedback(null);
    setInvoiceSendFeedback(null);
    adminFetch(`/api/admin/batches/${batchId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setBatch(d.batch);
          setOrders(d.orders || []);
          setInvoices(d.invoices || []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [batchId]);

  useEffect(() => {
    if (currentUser.role === 'accountmanager') return;
    adminFetch('/api/admin/users').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.users) setAmOptions((d.users as AdminUserOption[]).filter((u) => u.is_account_manager && u.is_active));
    }).catch(() => {});
  }, [currentUser.role]);

  const changeAM = async (newAmId: string) => {
    if (!batch) return;
    setSavingAM(true);
    try {
      const res = await adminFetch('/api/admin/batches', {
        method: 'PUT',
        body: JSON.stringify({ id: batch.id, account_manager_id: newAmId || null }),
      });
      if (res.ok) {
        setBatch(prev => prev ? { ...prev, account_manager_id: newAmId || null } : prev);
      }
    } catch { /* silent */ } finally {
      setSavingAM(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const openPaymentReminderPreview = () => {
    if (!batch || batch.is_paid) return;
    setReminderFeedback(null);
    setReminderPreviewOpen(true);
  };

  const openInvoicePreview = () => {
    if (!batch || batch.is_paid) return;
    setInvoiceSendFeedback(null);
    setInvoicePreviewOpen(true);
  };

  const openCustomerPortal = async () => {
    if (!batch?.customer_id) return;
    setOpeningPortal(true);
    setPortalOpenError(null);
    const r = await openCustomerPortalAsAdmin(batch.customer_id);
    setOpeningPortal(false);
    if (!r.ok) setPortalOpenError(r.error);
  };

  const getBranch = (slug: string) => {
    if (slug === 'niche_research') return { name: 'Niche-onderzoek', color: 'purple' };
    const br = branches.find(b => b.slug === slug);
    return { name: br?.name || slug, color: br?.color || 'slate' };
  };

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
  const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const fmtCurrency = (n: number) => `€${Number(n).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const ORDER_STATUS_MAP: Record<string, { label: string; cls: string }> = {
    paid: { label: 'Betaald', cls: 'bg-emerald-100 text-emerald-700' },
    pending: { label: 'In afwachting', cls: 'bg-amber-100 text-amber-700' },
    failed: { label: 'Mislukt', cls: 'bg-red-100 text-red-700' },
    expired: { label: 'Verlopen', cls: 'bg-slate-100 text-slate-600' },
    cancelled: { label: 'Geannuleerd', cls: 'bg-slate-100 text-slate-600' },
  };

  const INV_STATUS_MAP: Record<string, { label: string; cls: string }> = {
    paid: { label: 'Betaald', cls: 'bg-emerald-100 text-emerald-700' },
    open: { label: 'Open', cls: 'bg-amber-100 text-amber-700' },
    credit_note: { label: 'Creditnota', cls: 'bg-blue-100 text-blue-700' },
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-lg flex-col bg-white shadow-2xl">

        {/* Header bar */}
        <div className="shrink-0 border-b border-slate-100">
          <div className="h-[3px] bg-warmeleads-gradient" />
          <div className="flex items-start justify-between gap-3 px-5 py-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-slate-900">Batch details</h2>
              {batch && (
                <p className="mt-0.5 flex flex-wrap items-center gap-x-1 text-xs text-slate-500">
                  <Link
                    href={`/admin/customers?open=${batch.customer_id}`}
                    className="inline-flex max-w-[min(100%,18rem)] items-center gap-0.5 font-medium text-brand-purple hover:underline"
                    title="Klant openen in klantenbeheer"
                  >
                    <span className="truncate">{batch.customers?.name || 'Onbekend'}</span>
                    <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                  </Link>
                  <span className="shrink-0">&middot;</span>
                  <span className="shrink-0">{getBranch(batch.branch).name}</span>
                </p>
              )}
              {portalOpenError && (
                <p className="mt-1.5 text-[11px] font-medium text-red-600" role="alert">
                  {portalOpenError}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {batch?.customer_id && (
                <button
                  type="button"
                  onClick={openCustomerPortal}
                  disabled={loading || openingPortal}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                  title="Klantportaal openen (ingelogd als klant)"
                >
                  {openingPortal ? (
                    <ArrowPathIcon className="h-4 w-4 animate-spin text-slate-500" aria-hidden />
                  ) : (
                    <GlobeAltIcon className="h-4 w-4 text-slate-500" aria-hidden />
                  )}
                  Portaal
                </button>
              )}
              <button type="button" onClick={onClose} className="rounded-lg p-2.5 min-h-11 min-w-11 text-slate-400 hover:bg-slate-100" aria-label="Sluiten">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="space-y-2">
                  <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
                  <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
                </div>
              ))}
            </div>
          ) : !batch ? (
            <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center">
              <ExclamationCircleIcon className="mx-auto mb-2 h-8 w-8 text-slate-300" />
              <p className="text-sm font-medium text-slate-500">Batch niet gevonden</p>
            </div>
          ) : (() => {
            const br = getBranch(batch.branch);
            const c = COLOR_MAP[br.color] || COLOR_MAP.slate;
            const compensations: Compensation[] = Array.isArray(batch.compensations) ? batch.compensations : [];
            const totalComp = compensations.reduce((s, x) => s + x.amount, 0);
            const durationDays = batch.completed_at && batch.created_at
              ? Math.round((new Date(batch.completed_at).getTime() - new Date(batch.created_at).getTime()) / 86400000)
              : null;
            const paidAt = orders.find(o => o.status === 'paid')?.paid_at || invoices.find(inv => inv.paid_at)?.paid_at || null;

            return (
              <>
                {/* Status + meta */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${c.light} ${c.text}`}>{br.name}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[batch.status] || 'bg-slate-100 text-slate-600'}`}>{STATUS_LABELS[batch.status] || batch.status}</span>
                  <DoorloopChip b={batch} />
                  {isBulkLeadsBatch(batch) && (
                    <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-800">Bulk CRM</span>
                  )}
                  {(batch.batch_kind || '') === 'niche_research' && (
                    <span className="rounded-full bg-fuchsia-100 px-2.5 py-1 text-xs font-semibold text-fuchsia-900">Niche-onderzoek</span>
                  )}
                  {batch.is_paid ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                      <CheckBadgeIcon className="h-3.5 w-3.5" /> Betaald
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
                      <ExclamationCircleIcon className="h-3.5 w-3.5" /> Onbetaald
                    </span>
                  )}
                  {alleenEigenCampagneLabel(batch) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-800">
                      {alleenEigenCampagneLabel(batch)}
                    </span>
                  )}
                  {exclusieveCampagneLabel(batch) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-800">
                      {exclusieveCampagneLabel(batch)}
                    </span>
                  )}
                  {directLabel(batch) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                      <BoltIcon className="h-3.5 w-3.5" aria-hidden />
                      {directLabel(batch)}
                    </span>
                  )}
                  {showDistributionPriorityBadge(batch) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
                      <BoltIcon className="h-3.5 w-3.5" aria-hidden />
                      Voorrang leadverdeling
                    </span>
                  )}
                </div>

                {batch.status !== 'completed' && batch.status !== 'pending_payment' && batch.is_paid && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { void togglePauseInDetail(); }}
                      disabled={pauseBusy}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 disabled:opacity-50"
                    >
                      {pauseBusy ? (
                        <ArrowPathIcon className="h-3.5 w-3.5 shrink-0 animate-spin" />
                      ) : batch.status === 'active' ? (
                        <PauseIcon className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <PlayIcon className="h-3.5 w-3.5 shrink-0" />
                      )}
                      {batch.status === 'active' ? 'Batch pauzeren (Meta-campagnes ook)' : 'Batch hervatten'}
                    </button>
                  </div>
                )}

                <BatchDetailMetaBlock batch={batch} onReload={reloadDetailBatch} onListRefresh={onListRefresh} />

                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
                  <BatchTargetAreaBadges customers={batch.customers} batchTargets={batch.batch_targets} showHeading />
                </div>

                <div className="text-xs text-slate-400">
                  Aangemaakt op {fmtDate(batch.created_at)}
                  {batch.completed_at && (
                    <> &middot; Afgerond op {fmtDate(batch.completed_at)}{durationDays !== null && <> &middot; {durationDays} {durationDays === 1 ? 'dag' : 'dagen'}</>}</>
                  )}
                  {batch.starts_at && startsAtInFuture(batch.starts_at) && (
                    <> &middot; <span className="font-medium text-amber-600">Start {formatStartsAt(batch.starts_at)}</span></>
                  )}
                </div>

                {(() => {
                  const cu = batch.customers;
                  const hasContact =
                    !!(cu?.contact_person?.trim()) ||
                    !!(cu?.email?.trim()) ||
                    !!(cu?.phone?.trim()) ||
                    !!(cu?.postcode?.trim()) ||
                    !!(cu?.city?.trim());
                  if (!hasContact) return null;
                  const cityLine = [cu?.postcode?.trim(), cu?.city?.trim()].filter(Boolean).join(' ').trim();
                  return (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3.5">
                      <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Contact klant</p>
                      <div className="space-y-2 text-sm">
                        {cu?.contact_person?.trim() && (
                          <div className="flex items-start gap-2">
                            <UserIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                            <span className="font-medium text-slate-800">{cu.contact_person.trim()}</span>
                          </div>
                        )}
                        {cu?.email?.trim() && (
                          <div className="flex items-start gap-2">
                            <EnvelopeIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                              <a href={`mailto:${cu.email.trim()}`} className="break-all font-medium text-brand-purple hover:underline">
                                {cu.email.trim()}
                              </a>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(cu.email!.trim(), 'email')}
                                className="shrink-0 rounded p-1 text-slate-400 hover:bg-white hover:text-slate-600"
                                title="E-mail kopiëren"
                              >
                                <DocumentDuplicateIcon className="h-3.5 w-3.5" />
                              </button>
                              {copied === 'email' && <span className="text-[10px] text-emerald-600">Gekopieerd</span>}
                            </div>
                          </div>
                        )}
                        {cu?.phone?.trim() && (
                          <div className="flex items-start gap-2">
                            <PhoneIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                            <div className="flex flex-wrap items-center gap-2">
                              <a href={`tel:${cu.phone.replace(/\s/g, '')}`} className="font-medium text-brand-purple hover:underline">
                                {cu.phone.trim()}
                              </a>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(cu.phone!.trim(), 'phone')}
                                className="shrink-0 rounded p-1 text-slate-400 hover:bg-white hover:text-slate-600"
                                title="Telefoon kopiëren"
                              >
                                <DocumentDuplicateIcon className="h-3.5 w-3.5" />
                              </button>
                              {copied === 'phone' && <span className="text-[10px] text-emerald-600">Gekopieerd</span>}
                            </div>
                          </div>
                        )}
                        {cityLine && (
                          <p className="pl-6 text-xs text-slate-600">
                            {cityLine}
                            {cu?.country?.trim() && (
                              <span className="text-slate-400"> · {cu.country.trim()}</span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {isBulkLeadsBatch(batch) && (
                  <div className="space-y-2">
                    <div className="rounded-lg border border-violet-200 bg-violet-50/60 px-3 py-2.5 text-xs text-violet-900">
                      <p className="font-medium">Bulk-leads pakket</p>
                      <p className="mt-0.5 text-violet-800/90">
                        Er worden geen leads automatisch via de pijplijn toegewezen. Gebruik bulk export op de leads-pagina om leads aan het klantportaal te koppelen aan deze batch.
                      </p>
                    </div>
                    {batch.is_paid && (
                      <Link
                        href={`/admin/leads?customer=${encodeURIComponent(batch.customer_id)}&bulk_batch=${encodeURIComponent(batch.id)}`}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-violet-300 bg-white px-4 py-2.5 text-sm font-semibold text-violet-800 shadow-sm transition hover:bg-violet-50"
                      >
                        <ArrowDownTrayIcon className="h-4 w-4" />
                        Bulk leads uitdelen
                      </Link>
                    )}
                  </div>
                )}

                {isNicheResearchBatch(batch) && (
                  <div className="rounded-lg border border-fuchsia-200 bg-fuchsia-50/60 px-3 py-2.5 text-xs text-fuchsia-950">
                    <p className="font-medium">Onderzoeksbatch (€1.000 excl. btw)</p>
                    {batch.niche_title ? (
                      <p className="mt-1 font-semibold text-fuchsia-900">&ldquo;{batch.niche_title}&rdquo;</p>
                    ) : null}
                    {batch.lead_branch_slug ? (
                      <p className="mt-1 text-fuchsia-900/90">
                        Inbound branche:{' '}
                        <span className="font-semibold">
                          {getBranch(batch.lead_branch_slug).name}
                        </span>{' '}
                        <span className="font-mono text-[10px]">({batch.lead_branch_slug})</span>
                      </p>
                    ) : (
                      <p className="mt-1 font-medium text-amber-800">
                        Geen inbound-branche gekoppeld — leads worden nog niet automatisch ingeladen.
                      </p>
                    )}
                    <p className="mt-1 text-fuchsia-900/90">
                      Actieve, betaalde batches ontvangen automatisch inbound leads (geldig telefoonnummer) op de gekoppelde branche in het klantportaal. Geen geo-pijplijn.
                    </p>
                  </div>
                )}

                {/* Progress */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <BatchProgressDisplay {...batchProgressProps(batch)} size="md" />
                  {totalComp > 0 && (
                    <p className="mt-2 text-xs font-medium text-emerald-600">+{totalComp} compensatie in batchgrootte</p>
                  )}
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                    {batch.leads_delivered_external > 0 && (
                      <p className="text-[11px] text-slate-400">
                        <span className="font-medium text-slate-500">{batch.leads_delivered - batch.leads_delivered_external}</span> via systeem
                        {' + '}
                        <span className="font-medium text-amber-600">{batch.leads_delivered_external}</span> extern
                      </p>
                    )}
                  </div>
                  {compensations.length > 0 && (
                    <div className="mt-3 border-t border-slate-200 pt-3">
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Compensaties</p>
                      <div className="space-y-1">
                        {compensations.map((comp, i) => (
                          <div key={i} className="flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-brand-purple/10 px-2 py-0.5 font-bold text-brand-purple">+{comp.amount}</span>
                              <span className="text-slate-600">{comp.reason || 'Geen reden'}</span>
                            </div>
                            <span className="text-slate-400">{new Date(comp.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Financial */}
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Financieel</p>
                  <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
                    {batch.price_per_lead ? (
                      <div className="space-y-3">
                        <div className="flex items-baseline justify-between">
                          <span className="text-sm text-slate-500">Orderbedrag</span>
                          <span className="text-xl font-bold text-slate-900">{fmtCurrency(Number(batch.total_price) || (batch.batch_size * batch.price_per_lead))}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-400">{batch.batch_size} leads &times; {fmtCurrency(batch.price_per_lead)}</span>
                          <span className="text-[11px] text-slate-400">excl. BTW</span>
                        </div>
                        <div className="border-t border-slate-100 pt-3">
                          {batch.is_paid ? (
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100">
                                <CheckBadgeIcon className="h-4 w-4 text-emerald-600" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-emerald-700">Betaald</p>
                                {(paidAt) && (
                                  <p className="text-[11px] text-slate-400">op {fmtDateTime(paidAt)}</p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-red-100">
                                <ExclamationCircleIcon className="h-4 w-4 text-red-500" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-red-600">Onbetaald</p>
                                <p className="text-[11px] text-slate-400">Klant kan via portaal betalen</p>
                              </div>
                            </div>
                          )}
                        </div>
                        {!batch.is_paid && (
                          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                            {batch.status !== 'expired' && (
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={openInvoicePreview}
                                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-brand-purple/30 bg-brand-purple/5 px-3 py-2 text-xs font-semibold text-brand-purple transition hover:bg-brand-purple/10"
                              >
                                <DocumentTextIcon className="h-4 w-4" />
                                Stuur factuur + betaallink
                              </button>
                              <button
                                type="button"
                                onClick={openPaymentReminderPreview}
                                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                              >
                                <EnvelopeIcon className="h-4 w-4" />
                                Stuur betaalherinnering
                              </button>
                            </div>
                            )}
                            <BetaalOpvolging batch={batch} onGewijzigd={() => { void reloadDetailBatch(); onListRefresh?.(); }} />
                            {invoiceSendFeedback && (
                              <p className={`text-[11px] ${invoiceSendFeedback.kind === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                                {invoiceSendFeedback.message}
                              </p>
                            )}
                            {reminderFeedback && (
                              <p className={`text-[11px] ${reminderFeedback.kind === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                                {reminderFeedback.message}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <InformationCircleIcon className="h-4 w-4" />
                        <span>Geen prijs ingesteld voor deze batch</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Winst (alleen superadmin) */}
                {currentUser.role === 'superadmin' && <BatchWinstBlok batchId={batch.id} />}

                {/* Herkomst leads per Meta-campagne (alleen superadmin) */}
                {currentUser.role === 'superadmin' && <BatchHerkomstBlok batchId={batch.id} />}

                {/* Account Manager */}
                {currentUser.role !== 'accountmanager' && (
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Accountmanager</p>
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <select
                        value={batch.account_manager_id || ''}
                        onChange={e => changeAM(e.target.value)}
                        disabled={savingAM}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50 disabled:opacity-60"
                      >
                        <option value="">Geen accountmanager</option>
                        {amOptions.map(am => (
                          <option key={am.id} value={am.id}>{am.name}</option>
                        ))}
                      </select>
                      {savingAM && <p className="mt-1.5 text-[11px] text-slate-400">Opslaan...</p>}
                    </div>
                  </div>
                )}

                {/* Orders */}
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Bestellingen {orders.length > 0 && <span className="normal-case text-slate-300">({orders.length})</span>}
                  </p>
                  {orders.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center">
                      <ShoppingCartIcon className="mx-auto mb-1.5 h-6 w-6 text-slate-300" />
                      <p className="text-xs text-slate-400">Geen bestellingen — batch is handmatig aangemaakt</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {orders.map(o => {
                        const os = ORDER_STATUS_MAP[o.status] || { label: o.status, cls: 'bg-slate-100 text-slate-600' };
                        return (
                          <div key={o.id} className="rounded-xl border border-slate-200 bg-white p-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-sm font-medium text-slate-800">{fmtCurrency(Number(o.total_price))}</p>
                                <p className="text-[11px] text-slate-400">{fmtDateTime(o.created_at)}</p>
                              </div>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${os.cls}`}>{os.label}</span>
                            </div>
                            {o.paid_at && (
                              <p className="mt-1 text-[11px] text-emerald-600">Betaald op {fmtDateTime(o.paid_at)}</p>
                            )}
                            {o.mollie_payment_id && (
                              <button onClick={() => copyToClipboard(o.mollie_payment_id!, o.id)}
                                className="mt-1.5 inline-flex items-center gap-1 rounded bg-slate-50 px-2 py-0.5 text-[10px] font-mono text-slate-500 transition hover:bg-slate-100">
                                <DocumentDuplicateIcon className="h-3 w-3" />
                                {copied === o.id ? 'Gekopieerd!' : o.mollie_payment_id}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Invoices */}
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Facturen {invoices.length > 0 && <span className="normal-case text-slate-300">({invoices.length})</span>}
                  </p>
                  {invoices.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center">
                      <DocumentTextIcon className="mx-auto mb-1.5 h-6 w-6 text-slate-300" />
                      <p className="text-xs text-slate-400">Geen facturen gekoppeld aan deze batch</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {invoices.map(inv => {
                        const invStatus = INV_STATUS_MAP[inv.status] || { label: inv.status, cls: 'bg-slate-100 text-slate-600' };
                        return (
                          <div key={inv.id} className="rounded-xl border border-slate-200 bg-white p-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="text-sm font-medium text-slate-800">
                                  {inv.invoice_number || 'Geen nummer'}
                                </p>
                                <p className="text-[11px] text-slate-400">{fmtDate(inv.created_at)}</p>
                              </div>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${invStatus.cls}`}>{invStatus.label}</span>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                              <span>Subtotaal {fmtCurrency(Number(inv.subtotal))}</span>
                              <span className="text-slate-300">&middot;</span>
                              <span>BTW {inv.btw_percentage}% {fmtCurrency(Number(inv.btw_amount))}</span>
                              <span className="text-slate-300">&middot;</span>
                              <span className="font-semibold text-slate-700">Totaal {fmtCurrency(Number(inv.total_incl_btw))}</span>
                            </div>
                            {inv.paid_at && (
                              <p className="mt-1 text-[11px] text-emerald-600">Betaald op {fmtDateTime(inv.paid_at)}</p>
                            )}
                            <div className="mt-2">
                              <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 hover:text-brand-purple">
                                <ArrowDownTrayIcon className="h-3.5 w-3.5" /> Download PDF
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Settings */}
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Instellingen</p>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-[11px] font-medium text-slate-400">Max per dag</p>
                        <p className="font-medium text-slate-700">{batch.leads_per_day || '∞'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-medium text-slate-400">Max per week</p>
                        <p className="font-medium text-slate-700">{batch.leads_per_week || '∞'}</p>
                      </div>
                      {batch.lookback_days !== null && batch.lookback_days !== undefined && (
                        <div>
                          <p className="text-[11px] font-medium text-slate-400">Lookback</p>
                          <p className="font-medium text-slate-700">
                            {batch.lookback_days === 0 ? 'Geen' : `${batch.lookback_days} dagen`}
                            {batch.lookback_levering === 'spoed' && (batch.lookback_days ?? 0) > 0 && (
                              <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">met spoed</span>
                            )}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-[11px] font-medium text-slate-400">Startdatum</p>
                        <p className="font-medium text-slate-700">{batch.starts_at ? formatStartsAt(batch.starts_at) : 'Direct gestart'}</p>
                      </div>
                    </div>
                    {batch.lead_filters && batch.lead_filters.length > 0 && (
                      <div className="mt-3 border-t border-slate-200 pt-3">
                        <p className="mb-1.5 text-[11px] font-medium text-slate-400">Lead filters</p>
                        <div className="flex flex-wrap gap-1">
                          {batch.lead_filters.map((f, i) => (
                            <span key={i} className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                              {f.field}: {f.values?.length || 0} waarden
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {batch.notes && (
                      <div className="mt-3 border-t border-slate-200 pt-3">
                        <p className="mb-1 text-[11px] font-medium text-slate-400">Notities</p>
                        <p className="text-sm text-slate-600">{batch.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            );
          })()}
        </div>

        {/* Action bar */}
        {batch && (
          <div className="shrink-0 border-t border-slate-100 px-5 py-4">
            <button onClick={() => onEdit(batch)}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-button-gradient py-2.5 text-sm font-bold text-white">
              <PencilSquareIcon className="h-4 w-4" /> Bewerken
            </button>
          </div>
        )}
      </motion.div>
      {batch && (
        <>
          <EmailPreviewModal
            open={invoicePreviewOpen}
            onClose={() => setInvoicePreviewOpen(false)}
            title="Stuur factuur + betaallink"
            previewUrl={`/api/admin/batches/${batch.id}/send-invoice/preview`}
            sendUrl={`/api/admin/batches/${batch.id}/send-invoice`}
            confirmLabel="Nu factuur versturen"
            successMessage="Factuur met betaallink is per e-mail naar de klant verstuurd."
            variant="invoice"
            onSent={(message) => setInvoiceSendFeedback({ kind: 'success', message })}
          />
          <EmailPreviewModal
            open={reminderPreviewOpen}
            onClose={() => setReminderPreviewOpen(false)}
            title="Stuur betaalherinnering"
            previewUrl={`/api/admin/batches/${batch.id}/payment-reminder/preview`}
            sendUrl={`/api/admin/batches/${batch.id}/payment-reminder`}
            confirmLabel="Nu herinnering versturen"
            successMessage="Herinneringsmail is verstuurd naar de klant."
            variant="reminder"
            onSent={(message) => setReminderFeedback({ kind: 'success', message })}
          />
        </>
      )}
    </>
  );
}

/* ─── Edit Panel ──────────────────────────────────────────── */
function EditBatchPanel({ batch, branches, customers, onClose, onSaved }: {
  batch: Batch; branches: BranchOption[]; customers: Customer[];
  onClose: () => void; onSaved: () => void;
}) {
  const isNicheResearch = isNicheResearchBatch(batch);
  const initStartsAt = batch.starts_at ? new Date(batch.starts_at) : null;
  const [leadBranchSlug, setLeadBranchSlug] = useState(batch.lead_branch_slug || '');
  const [externeFactuur, setExterneFactuur] = useState<ExterneFactuurStand>(() => beginStand(batch));
  /* Echt via Mollie betaald: dan valt er niets te kiezen. */
  const betaaldViaMollie = (batch.mollie_payment_id ?? '').startsWith('tr_');
  const [form, setForm] = useState({
    batch_size: batch.batch_size,
    leads_delivered: batch.leads_delivered,
    is_paid: batch.is_paid !== false,
    price_per_lead: batch.price_per_lead ? String(batch.price_per_lead) : '',
    leads_per_day: batch.leads_per_day ? String(batch.leads_per_day) : '',
    dagdosering: batch.dagdosering !== false,
    leads_per_week: batch.leads_per_week ? String(batch.leads_per_week) : '',
    notes: batch.notes || '',
    lead_filters: batch.lead_filters || [],
    lookback_days:
      batch.lookback_days !== null && batch.lookback_days !== undefined
        ? String(batch.lookback_days)
        : '',
  });
  const [saving, setSaving] = useState(false);
  const [branchFields, setBranchFields] = useState<BranchField[]>([]);
  const [extraLeads, setExtraLeads] = useState(0);
  const [extraReason, setExtraReason] = useState('');
  const [editStartsAt, setEditStartsAt] = useState(batch.starts_at ? true : false);
  const [editStartDate, setEditStartDate] = useState(
    initStartsAt ? initStartsAt.toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' }) : ''
  );
  const [editStartTime, setEditStartTime] = useState(
    initStartsAt ? initStartsAt.toLocaleTimeString('nl-NL', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit', hour12: false }) : '09:00'
  );
  const editServerMetaIds = coerceCustomerBatchMetaCampaignIds(batch.meta_campaign_ids);
  const editServerMetaKey = editServerMetaIds.join(',');

  const [metaCampaignPicks, setMetaCampaignPicks] = useState<MetaCampaignPick[]>(() => picksFromBatchMeta(batch));
  const [campagneUitgesloten, setCampagneUitgesloten] = useState<MetaCampaignPick[]>(() => uitgeslotenVanBatch(batch));
  const [alleenEigen, setAlleenEigen] = useState(() => batch.alleen_eigen_campagne === true);
  useEffect(() => { setAlleenEigen(batch.alleen_eigen_campagne === true); }, [batch.id, batch.alleen_eigen_campagne]);
  const { user: metaBewerker } = useAdmin();
  const toonCampagneRegels = isPipelineBatchKind(batch.batch_kind);
  const [metaSyncEnabled, setMetaSyncEnabled] = useState(() => batch.meta_campaign_sync_enabled !== false);
  // Match-aware staat (zie BatchDetailMetaBlock voor uitleg).
  const [saveBranchMetaDefault, setSaveBranchMetaDefault] = useState(false);
  const [initialSaveBranchMetaDefault, setInitialSaveBranchMetaDefault] = useState(false);
  const [defaultExists, setDefaultExists] = useState(false);
  const [defaultLoaded, setDefaultLoaded] = useState(false);
  const [distributionPriority, setDistributionPriority] = useState(() => batch.distribution_priority === true);
  const { user: bewerker } = useAdmin();
  const magDirectWijzigen = bewerker.role !== 'accountmanager';
  const [directStand, setDirectStand] = useState<DirectStand>(() => (batch.direct_leveren === 'aan' || batch.direct_leveren === 'uit' ? batch.direct_leveren : null));
  const priorityEditable = isPipelineBatchKind(batch.batch_kind) && batch.status !== 'completed';

  useEffect(() => {
    setDistributionPriority(batch.distribution_priority === true);
  }, [batch.id, batch.distribution_priority]);

  useEffect(() => {
    setDirectStand(batch.direct_leveren === 'aan' || batch.direct_leveren === 'uit' ? batch.direct_leveren : null);
  }, [batch.id, batch.direct_leveren]);

  useEffect(() => {
    if (!supportsBatchMetaCampaigns(batch.batch_kind)) return;
    setMetaCampaignPicks(prev => behoudCampagneNamen(picksFromBatchMeta(batch), prev));
    setCampagneUitgesloten(prev => behoudCampagneNamen(uitgeslotenVanBatch(batch), prev));
  }, [batch.batch_kind, batch.id, editServerMetaKey, batch.meta_campaign_paused_ids, JSON.stringify(batch.meta_campagne_exclusief ?? {}), (batch.meta_campagne_uitgesloten ?? []).join(',')]);

  // Stabiele fingerprint (zie BatchDetailMetaBlock).
  const editBatchMetaFingerprint = `${batch.id}|${batch.batch_kind || ''}|${batch.customer_id}|${batch.branch}|${batch.lead_branch_slug || ''}|${editServerMetaKey}|${coerceCustomerBatchMetaCampaignIds(batch.meta_campaign_paused_ids).join(',')}|${batch.meta_campaign_sync_enabled !== false ? 1 : 0}`;

  useEffect(() => {
    if (!supportsBatchMetaCampaigns(batch.batch_kind)) {
      setDefaultLoaded(true);
      return;
    }
    const params = new URLSearchParams({
      customer_id: batch.customer_id,
      branch: batch.branch,
      batch_kind: batch.batch_kind || '',
    });
    if (batch.lead_branch_slug) params.set('lead_branch_slug', batch.lead_branch_slug);
    let cancelled = false;
    setDefaultLoaded(false);
    adminFetch(`/api/admin/customer-branch-meta-defaults?${params.toString()}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (cancelled || !d) return;
        const exists = Boolean(d.exists);
        const matches = exists && batchMatchesBranchDefault(batch, {
          meta_campaign_ids: Array.isArray(d.meta_campaign_ids) ? d.meta_campaign_ids : [],
          meta_campaign_paused_ids: Array.isArray(d.meta_campaign_paused_ids) ? d.meta_campaign_paused_ids : [],
          meta_campaign_sync_enabled: d.meta_campaign_sync_enabled !== false,
        });
        setDefaultExists(exists);
        setSaveBranchMetaDefault(matches);
        setInitialSaveBranchMetaDefault(matches);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setDefaultLoaded(true); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editBatchMetaFingerprint]);

  useEffect(() => {
    adminFetch(`/api/admin/branches/fields?branch=${batch.branch}`)
      .then(r => r.ok ? r.json() : { fields: [] })
      .then(d => setBranchFields(d.fields || []))
      .catch(() => {});
  }, [batch.branch]);

  const effectiveBatchSize = form.batch_size + extraLeads;

  const save = async () => {
    setSaving(true);
    try {
      const batchSizeGrew = effectiveBatchSize > batch.batch_size;
      let startsAtISO: string | null = null;
      if (editStartsAt && editStartDate) {
        const nlDateTime = `${editStartDate}T${editStartTime || '09:00'}:00`;
        const nlOffset = getNLOffset(new Date(nlDateTime));
        startsAtISO = `${nlDateTime}${nlOffset}`;
      }
      const payload: Record<string, unknown> = {
        id: batch.id,
        batch_size: effectiveBatchSize,
        leads_delivered: form.leads_delivered,
        is_paid: form.is_paid,
        price_per_lead: form.price_per_lead ? parseFloat(form.price_per_lead) : null,
        leads_per_day: form.leads_per_day ? parseInt(form.leads_per_day) : null,
        dagdosering: form.dagdosering,
        leads_per_week: form.leads_per_week ? parseInt(form.leads_per_week) : null,
        notes: form.notes || null,
        lead_filters: form.lead_filters.filter(f => f.field && (f.values?.length || 0) > 0),
        trigger_backfill: batchSizeGrew,
        starts_at: startsAtISO,
        ...(form.is_paid && !betaaldViaMollie ? naarVelden(externeFactuur) : {}),
      };
      // Lookback: aanpasbaar voor pijplijn-batches (ook na betaling → retroactieve backfill).
      if (isPipelineBatchKind(batch.batch_kind) && !isNicheResearch) {
        const parsed = parseInt(form.lookback_days, 10);
        const clamped = Number.isFinite(parsed) ? Math.max(0, Math.min(30, parsed)) : 0;
        payload.lookback_days = clamped;
      }
      if (supportsBatchMetaCampaigns(batch.batch_kind)) {
        Object.assign(payload, metaFieldsFromPicks(metaCampaignPicks, toonCampagneRegels ? campagneUitgesloten : undefined, toonCampagneRegels ? alleenEigen : undefined));
        payload.meta_campaign_sync_enabled = metaSyncEnabled;
        // Match-aware (zie BatchDetailMetaBlock):
        //  - vinkje aan → upsert met huidige meta-staat;
        //  - was aan, nu uit → expliciete delete;
        //  - was uit en blijft uit → niets sturen, raak een door een andere
        //    batch gezette default niet aan.
        if (saveBranchMetaDefault) {
          payload.save_branch_meta_default = true;
        } else if (initialSaveBranchMetaDefault) {
          payload.save_branch_meta_default = false;
        }
      }
      if (priorityEditable) payload.distribution_priority = distributionPriority;
      if (priorityEditable && magDirectWijzigen) payload.direct_leveren = directStand;
      if (extraLeads > 0) {
        payload.compensation = { amount: extraLeads, reason: extraReason };
      }
      if (isNicheResearch) {
        payload.lead_branch_slug = leadBranchSlug;
      }
      const res = await adminFetch('/api/admin/batches', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (res.ok) onSaved();
      else { const d = await res.json(); alert(d.error || 'Opslaan mislukt'); }
    } catch { alert('Er ging iets mis'); }
    setSaving(false);
  };

  const br = branches.find(b => b.slug === batch.branch);
  const cust = customers.find(c => c.id === batch.customer_id);
  const existingCompensations: Compensation[] = Array.isArray(batch.compensations) ? batch.compensations : [];
  const totalPreviousComp = existingCompensations.reduce((s, c) => s + c.amount, 0);
  const livePct = effectiveBatchSize > 0 ? Math.min(100, Math.round((form.leads_delivered / effectiveBatchSize) * 100)) : 0;
  const deliveredChanged = form.leads_delivered !== batch.leads_delivered;
  const sizeChanged = effectiveBatchSize !== batch.batch_size;
  const reopenStatus =
    !isNicheResearch &&
    form.leads_delivered < effectiveBatchSize &&
    batch.status === 'completed'
      ? batch.is_paid
        ? 'active'
        : 'pending_payment'
      : null;
  const autoStatus = isNicheResearch
    ? batch.status
    : form.leads_delivered >= effectiveBatchSize
      ? 'completed'
      : reopenStatus ?? batch.status;

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
            <button onClick={onClose} className="rounded-lg p-2.5 min-h-11 min-w-11 text-slate-400 hover:bg-slate-100"><XMarkIcon className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {isNicheResearch && (
            <div className="space-y-3 rounded-lg border border-fuchsia-200 bg-fuchsia-50/50 p-3">
              <p className="text-xs font-semibold text-fuchsia-950">Onderzoeksbatch</p>
              {batch.niche_title && (
                <p className="text-sm font-medium text-fuchsia-900">&ldquo;{batch.niche_title}&rdquo;</p>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Inbound lead-branche (Zapier) *</label>
                <select
                  value={leadBranchSlug}
                  onChange={e => setLeadBranchSlug(e.target.value)}
                  className="w-full rounded-lg border border-fuchsia-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-fuchsia-500/50"
                >
                  <option value="">Kies branche…</option>
                  {branches.filter(isSellableLeadBranch).map(b => (
                    <option key={b.slug} value={b.slug}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Live progress */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-sm font-bold text-slate-800">
                {isNicheResearch
                  ? `${form.leads_delivered} onderzoeksleads ingeladen`
                  : `${form.leads_delivered} / ${effectiveBatchSize} geleverd`}
              </span>
              {!isNicheResearch && (
                <span className="text-xs font-medium text-slate-500">{livePct}%</span>
              )}
            </div>
            {!isNicheResearch && (
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
              <div className={`h-full rounded-full transition-all duration-300 ${livePct >= 100 ? 'bg-blue-500' : livePct >= 75 ? 'bg-emerald-500' : livePct >= 50 ? 'bg-amber-500' : 'bg-brand-purple'}`}
                style={{ width: `${livePct}%` }} />
            </div>
            )}
            <div className="mt-1.5 flex items-center justify-between">
              <p className="text-[11px] text-slate-400">Status: {STATUS_LABELS[autoStatus] || autoStatus}</p>
              {(deliveredChanged || sizeChanged) && autoStatus !== batch.status && (
                <p className="text-[11px] font-medium text-amber-600">
                  Status wordt automatisch naar &apos;{STATUS_LABELS[autoStatus]}&apos;
                </p>
              )}
            </div>
          </div>

          {/* Fields */}
          <div className={`grid gap-3 ${isNicheResearch ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                {isNicheResearch ? 'Ingeladen onderzoeksleads' : 'Geleverde leads'}
              </label>
              <input type="number" value={form.leads_delivered} onChange={e => setForm(f => ({ ...f, leads_delivered: Math.max(0, Number(e.target.value)) }))} min={0}
                className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50 ${
                  deliveredChanged ? 'border-amber-300 bg-amber-50/50 ring-1 ring-amber-200' : 'border-slate-200'
                }`} />
              {batch.leads_delivered_external > 0 ? (
                <p className="mt-1 text-[10px] text-slate-500">
                  <span className="font-medium">{batch.leads_delivered - batch.leads_delivered_external}</span> via systeem
                  {' + '}
                  <span className="font-medium text-amber-600">{batch.leads_delivered_external}</span> extern
                </p>
              ) : (
                <p className="mt-1 text-[10px] text-slate-400">Pas aan voor extern geleverde leads (mail/Excel)</p>
              )}
            </div>
            {!isNicheResearch && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Batch grootte</label>
              <input type="number" value={form.batch_size} onChange={e => setForm(f => ({ ...f, batch_size: Math.max(1, Number(e.target.value)) }))} min={1}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
            </div>
            )}
          </div>

          {/* Extra leads toevoegen (compensatie) */}
          {!isNicheResearch && (
          <div className="rounded-lg border border-dashed border-brand-purple/30 bg-brand-purple/5 p-3">
            <div className="mb-2 flex items-center gap-2">
              <PlusIcon className="h-4 w-4 text-brand-purple" />
              <p className="text-sm font-medium text-brand-purple">Compensatie leads toevoegen</p>
            </div>
            <p className="mb-3 text-[11px] text-slate-500">
              Voeg extra leads toe als compensatie. De klant ziet dit in het portaal. Het systeem vult de extra plekken direct.
            </p>
            <div className="space-y-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">Aantal</label>
                  <input type="number" value={extraLeads || ''} onChange={e => setExtraLeads(Math.max(0, Number(e.target.value)))}
                    placeholder="0" min={0}
                    className="w-full rounded-lg border border-brand-purple/20 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/20" />
                </div>
                <div className="sm:col-span-3">
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">Reden *</label>
                  <input type="text" value={extraReason} onChange={e => setExtraReason(e.target.value)}
                    placeholder="Bijv. compensatie slechte leads"
                    className="w-full rounded-lg border border-brand-purple/20 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/20" />
                </div>
              </div>
              {extraLeads > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 rounded-md bg-white px-3 py-2">
                    <CheckCircleIcon className="h-4 w-4 shrink-0 text-brand-purple" />
                    <p className="min-w-0 text-xs text-slate-600">
                      Batch grootte wordt <span className="font-semibold text-slate-900">{form.batch_size}</span> → <span className="font-bold text-brand-purple">{effectiveBatchSize}</span> (+{extraLeads} compensatie)
                    </p>
                  </div>
                  {!extraReason.trim() && (
                    <p className="text-[11px] font-medium text-red-500">Vul een reden in om op te slaan</p>
                  )}
                </div>
              )}
            </div>

            {/* Eerdere compensaties */}
            {existingCompensations.length > 0 && (
              <div className="mt-3 border-t border-brand-purple/10 pt-3">
                <p className="mb-1.5 text-[11px] font-semibold text-slate-500">Eerdere compensaties ({totalPreviousComp} leads totaal)</p>
                <div className="space-y-1">
                  {existingCompensations.map((c, i) => (
                    <div key={i} className="flex items-center justify-between rounded-md bg-white px-2.5 py-1.5 text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-brand-purple/10 px-2 py-0.5 font-bold text-brand-purple">+{c.amount}</span>
                        <span className="text-slate-600">{c.reason || 'Geen reden opgegeven'}</span>
                      </div>
                      <span className="text-slate-400">{new Date(c.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          )}

          {isPipelineBatchKind(batch.batch_kind) && (
            <DistributionPriorityField
              checked={distributionPriority}
              onChange={setDistributionPriority}
              disabled={!priorityEditable}
            />
          )}

          {isPipelineBatchKind(batch.batch_kind) && (
            <DirectLeverenField
              stand={directStand}
              onChange={setDirectStand}
              klantDirect={batch.customers?.direct_leveren}
              disabled={!priorityEditable || !magDirectWijzigen}
            />
          )}

          {!isNicheResearch && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Per dag</label>
              <input type="number" value={form.leads_per_day} onChange={e => setForm(f => ({ ...f, leads_per_day: e.target.value }))}
                placeholder="∞" min={1}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
              {form.leads_per_day && (
                <DagdoseringKeuze aan={form.dagdosering} onChange={v => setForm(f => ({ ...f, dagdosering: v }))} />
              )}
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
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Notities</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
          </div>

          {supportsBatchMetaCampaigns(batch.batch_kind) && (
            <>
            <MetaCampaignLinkerFields
              title="Meta campagnes (batch)"
              helpText={
                isNicheResearch ? (
                  <>
                    Koppel campagnes voor dit onderzoek. Bij actieve, betaalde batch + sync aan → <strong>ACTIVE</strong> in Meta
                    (geen cap op aantal onderzoeksleads). Batch pauzeren of sync uit → campagnes naar <strong>PAUSED</strong>.
                  </>
                ) : (
                  <>
                    Zoek op <strong>campagnenaam</strong> zoals in Meta Ads Manager. Je kunt <strong>meerdere</strong> campagnes
                    koppelen; die worden samen op <strong>ACTIVE</strong> of <strong>PAUSED</strong> gezet op basis van deze batch
                    (betaald, actief, niet vol, <strong>startmoment</strong>, sync aan, dag/week-limieten).
                  </>
                )
              }
              searchPlaceholder="Bijv. Thuisbatterij leads Q2"
              picks={metaCampaignPicks}
              setPicks={setMetaCampaignPicks}
              syncEnabled={metaSyncEnabled}
              setSyncEnabled={setMetaSyncEnabled}
              campagneRegels={toonCampagneRegels && !isNicheResearch ? { magWijzigen: metaBewerker.role !== 'accountmanager', uitgesloten: campagneUitgesloten, setUitgesloten: setCampagneUitgesloten, alleenEigen, setAlleenEigen } : undefined}
              syncStatusSlot={
                (batch.meta_sync_last_error || batch.meta_sync_last_success_at) ? (
                  <div className="mt-2 space-y-1 border-t border-indigo-200/60 pt-2 text-[10px] text-indigo-900/70">
                    {batch.meta_sync_last_success_at && (
                      <p>
                        Laatste sync OK:{' '}
                        {new Date(batch.meta_sync_last_success_at).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })}
                      </p>
                    )}
                    {batch.meta_sync_last_error && <p className="text-rose-700">Fout: {batch.meta_sync_last_error}</p>}
                  </div>
                ) : null
              }
            />
            <label className="mt-2 flex cursor-pointer items-start gap-2 rounded-lg border border-indigo-100 bg-white/80 px-3 py-2 text-[11px] leading-snug text-indigo-950">
              <input
                type="checkbox"
                checked={saveBranchMetaDefault}
                onChange={e => setSaveBranchMetaDefault(e.target.checked)}
                disabled={!defaultLoaded}
                className="mt-0.5 shrink-0"
              />
              <span>
                <strong>Standaard voor nieuwe batches</strong>{' '}
                {defaultLoaded && initialSaveBranchMetaDefault && (
                  <span className="rounded-full bg-emerald-100 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-emerald-800">
                    actief
                  </span>
                )}
                {defaultLoaded && !initialSaveBranchMetaDefault && defaultExists && (
                  <span className="rounded-full bg-amber-100 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-amber-800">
                    andere batch is standaard
                  </span>
                )}
                <span className="block">
                  Toekomstige batches voor <strong>{cust?.name || 'deze klant'}</strong>
                  {isNicheResearch && leadBranchSlug ? (
                    <>
                      {' '}
                      + inbound <strong>{branches.find(b => b.slug === leadBranchSlug)?.name || leadBranchSlug}</strong>
                    </>
                  ) : (
                    <> + <strong>{br?.name || batch.branch}</strong></>
                  )}{' '}
                  erven deze Meta-koppeling automatisch.
                  {defaultLoaded && initialSaveBranchMetaDefault && (
                    <> Uitvinken &amp; opslaan verwijdert de standaard.</>
                  )}
                  {defaultLoaded && !initialSaveBranchMetaDefault && defaultExists && (
                    <> Aanvinken &amp; opslaan zet deze batch&apos;s koppeling als nieuwe standaard.</>
                  )}
                </span>
              </span>
            </label>
            </>
          )}

          {/* Lookback — aanpasbaar voor pijplijn-batches; wijziging triggert retroactieve backfill. */}
          {batch.lookback_days !== null && batch.lookback_days !== undefined && (
            (() => {
              const lookbackEditable =
                isPipelineBatchKind(batch.batch_kind) &&
                !isNicheResearch;
              if (!lookbackEditable) {
                return (
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div>
                      <p className="text-sm font-medium text-slate-700">Lookback bij aanmaak</p>
                      <p className="text-[11px] text-slate-400">
                        {batch.lookback_days === 0
                          ? 'Geen backfill, alleen nieuwe leads'
                          : `Bestaande leads van ${batch.lookback_days} dag(en) toegewezen`}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                      {batch.lookback_days}d
                    </span>
                  </div>
                );
              }
              return (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-700">Lookback dagen</p>
                      <p className="text-[11px] text-slate-400">
                        {form.lookback_days === '0' || form.lookback_days === ''
                          ? 'Geen backfill, alleen nieuwe leads'
                          : batch.is_paid
                            ? `Wijziging triggert met terugwerkende kracht backfill (${form.lookback_days} dag(en))`
                            : `Bij betaling: bestaande leads van de afgelopen ${form.lookback_days} dag(en) toewijzen`}
                      </p>
                    </div>
                    <input
                      type="number"
                      value={form.lookback_days}
                      onChange={e => setForm(f => ({ ...f, lookback_days: e.target.value }))}
                      min={0}
                      max={30}
                      className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-sm font-semibold text-slate-900 outline-none focus:border-brand-purple/50"
                    />
                  </div>
                  <div className="flex gap-1">
                    {[0, 1, 3, 7, 14].map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, lookback_days: String(d) }))}
                        className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                          form.lookback_days === String(d)
                            ? 'bg-brand-purple text-white'
                            : 'bg-white text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        {d === 0 ? 'Geen' : `${d}d`}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400">
                    {batch.is_paid
                      ? 'Na opslaan worden extra leads uit het verlengde venster met terugwerkende kracht toegewezen.'
                      : 'Backfill draait automatisch zodra de batch betaald wordt.'}
                  </p>
                </div>
              );
            })()
          )}

          {/* Startdatum */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">Startdatum</p>
                <p className="text-[11px] text-slate-400">
                  {editStartsAt
                    ? startsAtInFuture(batch.starts_at)
                      ? 'Batch start op het geplande moment'
                      : batch.starts_at ? 'Batch is gestart' : 'Geplande start'
                    : 'Direct gestart'}
                </p>
              </div>
              {startsAtInFuture(batch.starts_at) || !batch.starts_at ? (
                <button type="button" onClick={() => {
                  const next = !editStartsAt;
                  setEditStartsAt(next);
                  if (next && !editStartDate) {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    setEditStartDate(tomorrow.toISOString().slice(0, 10));
                  }
                }}
                  role="switch" aria-checked={editStartsAt}
                  className={`relative inline-flex h-[26px] w-[48px] shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${
                    editStartsAt ? 'bg-brand-purple' : 'bg-slate-300'
                  }`}>
                  <span className={`pointer-events-none inline-block h-[22px] w-[22px] transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                    editStartsAt ? 'translate-x-[24px]' : 'translate-x-[2px]'
                  }`} />
                </button>
              ) : (
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                  Gestart {formatStartsAt(batch.starts_at!)}
                </span>
              )}
            </div>
            {editStartsAt && (startsAtInFuture(batch.starts_at) || !batch.starts_at) && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">Datum</label>
                  <div className="relative">
                    <CalendarDaysIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input type="date" value={editStartDate} onChange={e => setEditStartDate(e.target.value)}
                      className="w-full rounded-lg border border-brand-purple/20 bg-white py-2 pl-8 pr-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/20" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">Tijd (NL)</label>
                  <div className="relative">
                    <ClockIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input type="time" value={editStartTime} onChange={e => setEditStartTime(e.target.value)}
                      className="w-full rounded-lg border border-brand-purple/20 bg-white py-2 pl-8 pr-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/20" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Payment status */}
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div>
              <p className="text-sm font-medium text-slate-700">Betaalstatus</p>
              <p className="text-[11px] text-slate-400">
                {form.is_paid ? (betaaldViaMollie ? 'Batch is betaald via Mollie' : 'Batch is betaald') : 'Klant kan via portaal betalen'}
              </p>
            </div>
            <button type="button" onClick={() => setForm(f => ({ ...f, is_paid: !f.is_paid }))}
              role="switch" aria-checked={form.is_paid}
              className={`relative inline-flex h-[26px] w-[48px] shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${
                form.is_paid ? 'bg-emerald-500' : 'bg-red-400'
              }`}>
              <span className={`pointer-events-none inline-block h-[22px] w-[22px] transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                form.is_paid ? 'translate-x-[24px]' : 'translate-x-[2px]'
              }`} />
            </button>
          </div>
          {form.is_paid && !betaaldViaMollie && (
            <ExterneFactuurKeuze stand={externeFactuur} onChange={setExterneFactuur} batchprijs={batch.total_price} modus="bewerken" />
          )}

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

          {/* Batch-specifieke targetgebieden (overrulen klant-targetgebieden) */}
          <BatchTargetsEditor batchId={batch.id} />
        </div>

        <div className="shrink-0 border-t border-slate-100 px-5 py-4">
          <button onClick={save} disabled={saving || form.batch_size < 1 || (extraLeads > 0 && !extraReason.trim())}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-button-gradient py-2.5 text-sm font-bold text-white disabled:opacity-50">
            {saving ? <><ArrowPathIcon className="h-4 w-4 animate-spin" /> Opslaan...</> : 'Wijzigingen opslaan'}
          </button>
        </div>
      </motion.div>
    </>
  );
}
