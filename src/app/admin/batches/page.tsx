'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';
import { openCustomerPortalAsAdmin } from '@/lib/adminOpenPortal';
import { useAdmin } from '../adminContext';
import { mergeCustomTiers } from '@/lib/pricing';
import { isPipelineBatchKind } from '@/lib/batchKind';
import { coerceCustomerBatchMetaCampaignIds, type MetaCampaignPick } from '@/lib/metaCampaignIds';
import { MetaCampaignLinkerFields } from './MetaCampaignLinkerFields';
import { BatchTargetAreaBadges } from '@/components/admin/BatchTargetAreaBadges';
import type { CustomerTargetRow } from '@/lib/batchTargetAreas';

interface LeadFilter { field: string; operator: string; value: string; values?: string[] }
interface Compensation { amount: number; reason: string; date: string }
interface Batch {
  id: string; customer_id: string; branch: string; batch_size: number;
  price_per_lead: number | null; total_price: number | null;
  leads_per_week: number | null; leads_per_day: number | null;
  leads_delivered: number; leads_delivered_external: number; status: string;
  is_paid: boolean; lookback_days: number | null; notes: string | null; lead_filters: LeadFilter[];
  compensations: Compensation[];
  starts_at: string | null;
  account_manager_id: string | null;
  created_at: string; completed_at: string | null;
  batch_kind?: string | null;
  niche_title?: string | null;
  meta_campaign_ids?: string[] | null;
  meta_campaign_sync_enabled?: boolean | null;
  meta_sync_last_attempt_at?: string | null;
  meta_sync_last_success_at?: string | null;
  meta_sync_last_error?: string | null;
  customers?: {
    id?: string;
    name: string;
    contact_person?: string | null;
    email?: string | null;
    phone?: string | null;
    city?: string | null;
    postcode?: string | null;
    country?: string | null;
    customer_targets?: CustomerTargetRow[] | null;
  } | null;
}

function isBulkLeadsBatch(b: Pick<Batch, 'batch_kind'>): boolean {
  return (b.batch_kind || 'leads') === 'bulk_leads';
}
interface BranchOption { slug: string; name: string; color: string; is_active: boolean }
interface Customer { id: string; name: string; is_active: boolean }
interface BranchField { id: string; key: string; label: string; field_type: string; options: string[] }

function getNLOffset(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Amsterdam', hour: 'numeric', timeZoneName: 'shortOffset' });
  const parts = formatter.formatToParts(date);
  const tzPart = parts.find(p => p.type === 'timeZoneName');
  if (tzPart?.value) {
    const m = tzPart.value.match(/GMT([+-]\d+)/);
    if (m) {
      const h = parseInt(m[1]);
      return `${h >= 0 ? '+' : '-'}${String(Math.abs(h)).padStart(2, '0')}:00`;
    }
  }
  return '+01:00';
}

function formatStartsAt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function startsAtInFuture(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso) > new Date();
}

const STATUS_OPTS = [
  { value: 'all', label: 'Alle' },
  { value: 'active', label: 'Actief' },
  { value: 'pending_payment', label: 'Betaling' },
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
  pending_payment: 'bg-orange-100 text-orange-800',
  paused: 'bg-amber-100 text-amber-700',
  completed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Actief',
  pending_payment: 'Wacht op betaling',
  paused: 'Gepauzeerd',
  completed: 'Afgerond',
  cancelled: 'Geannuleerd',
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
  const [detailBatchId, setDetailBatchId] = useState<string | null>(null);
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
    if (b.status === 'pending_payment' || b.is_paid === false) {
      showToast('Deze batch wacht op betaling. Pauzeren/heractiveren kan na betaling.');
      return;
    }
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
    if (slug === 'niche_research') return { name: 'Niche-onderzoek', color: 'purple' };
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
        return cName.includes(s) || b.branch.includes(s) || (b.notes || '').toLowerCase().includes(s)
          || (b.niche_title || '').toLowerCase().includes(s);
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
  const pendingPayCount = batches.filter(b => b.status === 'pending_payment').length;
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
                  const pct = b.batch_size > 0 ? Math.min(100, Math.round((b.leads_delivered / b.batch_size) * 100)) : 0;
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
                        <BatchTargetAreaBadges customers={b.customers} variant="compact" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-24">
                            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                              <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-blue-500' : pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-brand-purple'}`}
                                style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                          <div>
                            <span className="whitespace-nowrap text-xs text-slate-600">
                              {b.leads_delivered}/{b.batch_size} <span className="text-slate-400">({pct}%)</span>
                              {b.leads_delivered > b.batch_size && <span className="ml-1 text-[10px] font-medium text-amber-600">overlevering</span>}
                            </span>
                            {compTotal > 0 && (
                              <p className="whitespace-nowrap text-[10px] font-medium text-emerald-600">+{compTotal} compensatie</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[b.status] || 'bg-slate-100 text-slate-600'}`}>{STATUS_LABELS[b.status] || b.status}</span>
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
                          {isPipelineBatchKind(b.batch_kind) && metaLinkCount > 0 && (
                            <span className="inline-flex w-fit items-center gap-0.5 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-800">
                              <GlobeAltIcon className="h-3 w-3 shrink-0" aria-hidden />
                              Meta · {metaLinkCount}
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
                          {b.status !== 'completed' && b.status !== 'pending_payment' && (
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
              const pct = b.batch_size > 0 ? Math.min(100, Math.round((b.leads_delivered / b.batch_size) * 100)) : 0;
              const br = getBranch(b.branch);
              const c = COLOR_MAP[br.color] || COLOR_MAP.slate;
              const mobileCompTotal = (Array.isArray(b.compensations) ? b.compensations : []).reduce((s: number, x: Compensation) => s + x.amount, 0);
              const metaLinkCount = coerceCustomerBatchMetaCampaignIds(b.meta_campaign_ids).length;
              return (
                <div key={b.id} onClick={() => setDetailBatchId(b.id)} className={`cursor-pointer rounded-xl border p-4 shadow-sm transition hover:shadow-md ${b.status === 'completed' ? 'border-blue-100 bg-blue-50/30' : b.status === 'paused' ? 'border-amber-100 bg-amber-50/20' : b.status === 'pending_payment' ? 'border-orange-100 bg-orange-50/25' : 'border-slate-200 bg-white'}`}>
                  <div className="mb-2 flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{b.customers?.name || 'Onbekend'}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${c.light} ${c.text}`}>{br.name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[b.status] || 'bg-slate-100 text-slate-600'}`}>{STATUS_LABELS[b.status] || b.status}</span>
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
                        {isPipelineBatchKind(b.batch_kind) && metaLinkCount > 0 && (
                          <span className="inline-flex items-center gap-0.5 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-800">
                            <GlobeAltIcon className="h-3 w-3 shrink-0" aria-hidden />
                            Meta · {metaLinkCount}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button onClick={e => { e.stopPropagation(); setEditBatch(b); }} className="rounded-lg p-2.5 text-slate-400 hover:bg-slate-100 hover:text-brand-purple">
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      {b.status !== 'completed' && b.status !== 'pending_payment' && (
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
                    <BatchTargetAreaBadges customers={b.customers} variant="compact" />
                  </div>
                  {/* Progress */}
                  <div className="mb-2">
                    <div className="mb-1 flex items-baseline justify-between">
                      <div>
                        <span className="text-sm font-bold text-slate-800">{b.leads_delivered} / {b.batch_size}</span>
                        {mobileCompTotal > 0 && (
                          <span className="ml-1.5 text-[10px] font-medium text-emerald-600">+{mobileCompTotal} comp.</span>
                        )}
                      </div>
                      <span className="text-xs font-medium text-slate-500">{pct}%</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-blue-500' : pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-brand-purple'}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  {/* Details */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    {b.leads_per_day && <span className="font-medium text-brand-purple">{b.leads_per_day}/dag</span>}
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

  const [metaCampaignPicks, setMetaCampaignPicks] = useState<MetaCampaignPick[]>(() =>
    serverIds.map(id => ({ id, name: id })),
  );
  const [metaSyncEnabled, setMetaSyncEnabled] = useState(() => batch.meta_campaign_sync_enabled !== false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [saveBranchMetaDefault, setSaveBranchMetaDefault] = useState(false);

  useEffect(() => {
    if (!isPipelineBatchKind(batch.batch_kind)) return;
    const ids = coerceCustomerBatchMetaCampaignIds(batch.meta_campaign_ids);
    if (ids.length === 0) setMetaCampaignPicks([]);
    else setMetaCampaignPicks(ids.map(id => ({ id, name: id })));
  }, [batch.batch_kind, batch.id, serverIdsKey]);

  useEffect(() => {
    setMetaSyncEnabled(batch.meta_campaign_sync_enabled !== false);
  }, [batch.meta_campaign_sync_enabled, batch.id]);

  const saveMeta = async () => {
    setSavingMeta(true);
    try {
      const res = await adminFetch('/api/admin/batches', {
        method: 'PUT',
        body: JSON.stringify({
          id: batch.id,
          meta_campaign_ids: metaCampaignPicks.map(p => p.id).slice(0, 10),
          meta_campaign_sync_enabled: metaSyncEnabled,
          ...(saveBranchMetaDefault ? { save_branch_meta_default: true } : {}),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Opslaan mislukt');
      }
      await onReload();
      onListRefresh?.();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Opslaan mislukt');
    } finally {
      setSavingMeta(false);
    }
  };

  if (!isPipelineBatchKind(batch.batch_kind)) return null;

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3.5">
      <MetaCampaignLinkerFields
        title="Meta campagnes"
        helpText={
          <>
            Zoek op naam (zoals in Ads Manager). Je kunt <strong>meerdere</strong> campagnes koppelen (zelfde batch, zelfde
            pauze/active-logica). Bij <strong>pauzeren</strong> van de batch worden alle gekoppelde campagnes in Meta
            mee gepauzeerd.
          </>
        }
        picks={metaCampaignPicks}
        setPicks={setMetaCampaignPicks}
        syncEnabled={metaSyncEnabled}
        setSyncEnabled={setMetaSyncEnabled}
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
          className="mt-0.5 shrink-0"
        />
        <span>
          <strong>Standaard voor nieuwe batches</strong> — na opslaan wordt deze koppeling bewaard voor deze klant + branche
          (herbestel via portaal pakt dit automatisch op).
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
  const [sendingReminder, setSendingReminder] = useState(false);
  const [reminderFeedback, setReminderFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [sendingInvoice, setSendingInvoice] = useState(false);
  const [invoiceSendFeedback, setInvoiceSendFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
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

  const sendPaymentReminder = async () => {
    if (!batch || batch.is_paid) return;
    setSendingReminder(true);
    setReminderFeedback(null);
    try {
      const res = await adminFetch(`/api/admin/batches/${batch.id}/payment-reminder`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Herinnering versturen mislukt');
      }
      setReminderFeedback({
        kind: 'success',
        message: 'Herinneringsmail is verstuurd naar de klant.',
      });
    } catch (err) {
      setReminderFeedback({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Herinnering versturen mislukt',
      });
    } finally {
      setSendingReminder(false);
    }
  };

  const sendInvoiceWithPayLink = async () => {
    if (!batch || batch.is_paid) return;
    setSendingInvoice(true);
    setInvoiceSendFeedback(null);
    try {
      const res = await adminFetch(`/api/admin/batches/${batch.id}/send-invoice`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Factuur versturen mislukt');
      }
      setInvoiceSendFeedback({
        kind: 'success',
        message: 'Factuur met betaallink is per e-mail naar de klant verstuurd.',
      });
    } catch (err) {
      setInvoiceSendFeedback({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Factuur versturen mislukt',
      });
    } finally {
      setSendingInvoice(false);
    }
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
              <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Sluiten">
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
            const pct = batch.batch_size > 0 ? Math.min(100, Math.round((batch.leads_delivered / batch.batch_size) * 100)) : 0;
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
                  <BatchTargetAreaBadges customers={batch.customers} showHeading />
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

                {(batch.batch_kind || '') === 'niche_research' && (
                  <div className="rounded-lg border border-fuchsia-200 bg-fuchsia-50/60 px-3 py-2.5 text-xs text-fuchsia-950">
                    <p className="font-medium">Onderzoeksbatch (€1.000 excl. btw)</p>
                    {batch.niche_title ? (
                      <p className="mt-1 font-semibold text-fuchsia-900">&ldquo;{batch.niche_title}&rdquo;</p>
                    ) : null}
                    <p className="mt-1 text-fuchsia-900/90">
                      Geen automatische lead-pijplijn. Zelfde product als portaal; bedrag wordt volgens afspraak gecrediteerd in latere leadlevering.
                    </p>
                  </div>
                )}

                {/* Progress */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-2 flex items-baseline justify-between">
                    <div>
                      <span className="text-lg font-bold text-slate-900">{batch.leads_delivered}</span>
                      <span className="text-sm text-slate-400"> / {batch.batch_size} geleverd</span>
                      {totalComp > 0 && (
                        <span className="ml-2 text-xs font-medium text-emerald-600">+{totalComp} compensatie</span>
                      )}
                    </div>
                    <span className="text-sm font-bold text-slate-600">{pct}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                    <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-blue-500' : pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-brand-purple'}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                    {batch.leads_delivered > batch.batch_size && (
                      <p className="text-[11px] font-medium text-amber-600">Overlevering: {batch.leads_delivered - batch.batch_size} extra</p>
                    )}
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
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={sendInvoiceWithPayLink}
                                disabled={sendingInvoice}
                                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-brand-purple/30 bg-brand-purple/5 px-3 py-2 text-xs font-semibold text-brand-purple transition hover:bg-brand-purple/10 disabled:opacity-60"
                              >
                                {sendingInvoice ? (
                                  <>
                                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                                    Verzenden...
                                  </>
                                ) : (
                                  <>
                                    <DocumentTextIcon className="h-4 w-4" />
                                    Stuur factuur + betaallink
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={sendPaymentReminder}
                                disabled={sendingReminder}
                                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-60"
                              >
                                {sendingReminder ? (
                                  <>
                                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                                    Verzenden...
                                  </>
                                ) : (
                                  <>
                                    <EnvelopeIcon className="h-4 w-4" />
                                    Stuur betaalherinnering
                                  </>
                                )}
                              </button>
                            </div>
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
                          <p className="font-medium text-slate-700">{batch.lookback_days === 0 ? 'Geen' : `${batch.lookback_days} dagen`}</p>
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
    </>
  );
}

/* ─── Edit Panel ──────────────────────────────────────────── */
function EditBatchPanel({ batch, branches, customers, onClose, onSaved }: {
  batch: Batch; branches: BranchOption[]; customers: Customer[];
  onClose: () => void; onSaved: () => void;
}) {
  const initStartsAt = batch.starts_at ? new Date(batch.starts_at) : null;
  const [form, setForm] = useState({
    batch_size: batch.batch_size,
    leads_delivered: batch.leads_delivered,
    is_paid: batch.is_paid !== false,
    price_per_lead: batch.price_per_lead ? String(batch.price_per_lead) : '',
    leads_per_day: batch.leads_per_day ? String(batch.leads_per_day) : '',
    leads_per_week: batch.leads_per_week ? String(batch.leads_per_week) : '',
    notes: batch.notes || '',
    lead_filters: batch.lead_filters || [],
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

  const [metaCampaignPicks, setMetaCampaignPicks] = useState<MetaCampaignPick[]>(() =>
    editServerMetaIds.map(id => ({ id, name: id })),
  );
  const [metaSyncEnabled, setMetaSyncEnabled] = useState(() => batch.meta_campaign_sync_enabled !== false);
  const [saveBranchMetaDefault, setSaveBranchMetaDefault] = useState(false);

  useEffect(() => {
    if (!isPipelineBatchKind(batch.batch_kind)) return;
    const ids = coerceCustomerBatchMetaCampaignIds(batch.meta_campaign_ids);
    if (ids.length === 0) setMetaCampaignPicks([]);
    else setMetaCampaignPicks(ids.map(id => ({ id, name: id })));
  }, [batch.batch_kind, batch.id, editServerMetaKey]);

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
        leads_per_week: form.leads_per_week ? parseInt(form.leads_per_week) : null,
        notes: form.notes || null,
        lead_filters: form.lead_filters.filter(f => f.field && (f.values?.length || 0) > 0),
        trigger_backfill: batchSizeGrew,
        starts_at: startsAtISO,
      };
      if (isPipelineBatchKind(batch.batch_kind)) {
        payload.meta_campaign_ids = metaCampaignPicks.map(p => p.id).slice(0, 10);
        payload.meta_campaign_sync_enabled = metaSyncEnabled;
        if (saveBranchMetaDefault) payload.save_branch_meta_default = true;
      }
      if (extraLeads > 0) {
        payload.compensation = { amount: extraLeads, reason: extraReason };
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
    form.leads_delivered < effectiveBatchSize && batch.status === 'completed'
      ? batch.is_paid
        ? 'active'
        : 'pending_payment'
      : null;
  const autoStatus =
    form.leads_delivered >= effectiveBatchSize ? 'completed' : reopenStatus ?? batch.status;

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
          {/* Live progress */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-sm font-bold text-slate-800">{form.leads_delivered} / {effectiveBatchSize} geleverd</span>
              <span className="text-xs font-medium text-slate-500">{livePct}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
              <div className={`h-full rounded-full transition-all duration-300 ${livePct >= 100 ? 'bg-blue-500' : livePct >= 75 ? 'bg-emerald-500' : livePct >= 50 ? 'bg-amber-500' : 'bg-brand-purple'}`}
                style={{ width: `${livePct}%` }} />
            </div>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Geleverde leads</label>
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
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Batch grootte</label>
              <input type="number" value={form.batch_size} onChange={e => setForm(f => ({ ...f, batch_size: Math.max(1, Number(e.target.value)) }))} min={1}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
            </div>
          </div>

          {/* Extra leads toevoegen (compensatie) */}
          <div className="rounded-lg border border-dashed border-brand-purple/30 bg-brand-purple/5 p-3">
            <div className="mb-2 flex items-center gap-2">
              <PlusIcon className="h-4 w-4 text-brand-purple" />
              <p className="text-sm font-medium text-brand-purple">Compensatie leads toevoegen</p>
            </div>
            <p className="mb-3 text-[11px] text-slate-500">
              Voeg extra leads toe als compensatie. De klant ziet dit in het portaal. Het systeem vult de extra plekken direct.
            </p>
            <div className="space-y-2">
              <div className="grid grid-cols-5 gap-2">
                <div className="col-span-2">
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">Aantal</label>
                  <input type="number" value={extraLeads || ''} onChange={e => setExtraLeads(Math.max(0, Number(e.target.value)))}
                    placeholder="0" min={0}
                    className="w-full rounded-lg border border-brand-purple/20 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/20" />
                </div>
                <div className="col-span-3">
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">Reden *</label>
                  <input type="text" value={extraReason} onChange={e => setExtraReason(e.target.value)}
                    placeholder="Bijv. compensatie slechte leads"
                    className="w-full rounded-lg border border-brand-purple/20 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/20" />
                </div>
              </div>
              {extraLeads > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 rounded-md bg-white px-3 py-2">
                    <CheckCircleIcon className="h-4 w-4 text-brand-purple" />
                    <p className="text-xs text-slate-600">
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

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Per dag</label>
              <input type="number" value={form.leads_per_day} onChange={e => setForm(f => ({ ...f, leads_per_day: e.target.value }))}
                placeholder="∞" min={1}
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

          {isPipelineBatchKind(batch.batch_kind) && (
            <>
            <MetaCampaignLinkerFields
              title="Meta campagnes (batch)"
              helpText={
                <>
                  Zoek op <strong>campagnenaam</strong> zoals in Meta Ads Manager. Je kunt <strong>meerdere</strong> campagnes
                  koppelen; die worden samen op <strong>ACTIVE</strong> of <strong>PAUSED</strong> gezet op basis van deze batch
                  (betaald, actief, niet vol, <strong>startmoment</strong>, sync aan, dag/week-limieten).
                </>
              }
              searchPlaceholder="Bijv. Thuisbatterij leads Q2"
              picks={metaCampaignPicks}
              setPicks={setMetaCampaignPicks}
              syncEnabled={metaSyncEnabled}
              setSyncEnabled={setMetaSyncEnabled}
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
                className="mt-0.5 shrink-0"
              />
              <span>
                <strong>Standaard voor nieuwe batches</strong> — sla deze Meta-koppeling op voor{' '}
                <strong>{cust?.name || 'deze klant'}</strong> + <strong>{br?.name || batch.branch}</strong>. Bij een nieuwe
                leads-batch (portaal of admin zonder handmatige Meta-IDs) worden deze campagnes automatisch overgenomen.
              </span>
            </label>
            </>
          )}

          {/* Lookback info (read-only) */}
          {batch.lookback_days !== null && batch.lookback_days !== undefined && (
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
                {form.is_paid ? 'Batch is betaald' : 'Klant kan via portaal betalen'}
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
          <button onClick={save} disabled={saving || form.batch_size < 1 || (extraLeads > 0 && !extraReason.trim())}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-button-gradient py-2.5 text-sm font-bold text-white disabled:opacity-50">
            {saving ? <><ArrowPathIcon className="h-4 w-4 animate-spin" /> Opslaan...</> : 'Wijzigingen opslaan'}
          </button>
        </div>
      </motion.div>
    </>
  );
}

/* ─── Create Panel ────────────────────────────────────────── */
interface PricingTierData { min_leads: number; price_per_lead: number }
interface PricingInfo {
  tiers: PricingTierData[];
  nationwide_discount: number;
  min_batch_size: number;
  is_custom: boolean;
  computed_price?: number | null;
  product: 'leads' | 'appointments';
}

function CreateBatchPanel({ branches, customers, onClose, onCreated }: {
  branches: BranchOption[]; customers: Customer[];
  onClose: () => void; onCreated: () => void;
}) {
  const [form, setForm] = useState({
    customer_id: '', branch: '', batch_size: 100, is_paid: false,
    batch_product: 'leads' as 'leads' | 'appointments',
    price_per_lead: '', price_per_appointment: '', appointments_per_day: '', appointments_per_week: '',
    leads_per_day: '', leads_per_week: '', lookback_days: '3', notes: '', lead_filters: [] as LeadFilter[],
    batch_delivery: 'pipeline' as 'pipeline' | 'bulk' | 'niche_research',
    niche_title: '',
    // Standaard verstuurt het systeem direct een betaallink-mail naar de klant bij
    // een open factuur. Admin/AM kan dit hier uitvinken om alleen de factuur +
    // Mollie-checkout aan te maken zonder mail.
    send_payment_email: true,
  });
  const [saving, setSaving] = useState(false);
  const [branchFields, setBranchFields] = useState<BranchField[]>([]);
  const [pricingInfo, setPricingInfo] = useState<PricingInfo | null>(null);
  const [priceOverride, setPriceOverride] = useState(false);
  const [scheduledStart, setScheduledStart] = useState(false);
  const [startsAtDate, setStartsAtDate] = useState('');
  const [startsAtTime, setStartsAtTime] = useState('09:00');
  const [metaCampaignPicks, setMetaCampaignPicks] = useState<MetaCampaignPick[]>([]);
  const [metaSyncEnabled, setMetaSyncEnabled] = useState(true);

  useEffect(() => {
    if ((form.batch_product === 'leads' && form.batch_delivery === 'niche_research') || !form.branch) {
      setBranchFields([]);
      return;
    }
    adminFetch(`/api/admin/branches/fields?branch=${form.branch}`)
      .then(r => r.ok ? r.json() : { fields: [] })
      .then(d => setBranchFields(d.fields || []))
      .catch(() => {});
  }, [form.branch, form.batch_delivery, form.batch_product]);

  useEffect(() => {
    setPriceOverride(false);
  }, [form.batch_product]);

  useEffect(() => {
    if (form.batch_product === 'appointments') {
      if (!form.branch) {
        setPricingInfo(null);
        return;
      }
      const fetchPricing = async () => {
        const branchRes = await adminFetch('/api/admin/branches');
        if (!branchRes.ok) return;
        const branchData = await branchRes.json();
        const br = (branchData.branches || []).find((b: { slug: string }) => b.slug === form.branch);
        if (!br) return;

        const branchTiers: PricingTierData[] = br.appointment_pricing_tiers || [];
        let tiers: PricingTierData[] = branchTiers;
        let nationwideDiscount = Number(br.appointment_nationwide_discount) || 0;
        let isCustom = false;

        if (form.customer_id) {
          const cpRes = await adminFetch(
            `/api/admin/customer-pricing?customer_id=${form.customer_id}&product=appointments`,
          );
          if (cpRes.ok) {
            const cpData = await cpRes.json();
            const custom = (cpData.pricing || []).find((p: { branch_slug: string }) => p.branch_slug === form.branch);
            if (custom && custom.pricing_tiers && custom.pricing_tiers.length > 0) {
              tiers = mergeCustomTiers(branchTiers, custom.pricing_tiers);
              if (custom.nationwide_discount != null) nationwideDiscount = Number(custom.nationwide_discount);
              isCustom = true;
            }
          }
        }

        const sorted = [...tiers].sort((a: PricingTierData, b: PricingTierData) => b.min_leads - a.min_leads);
        const tier = sorted.find((t: PricingTierData) => form.batch_size >= t.min_leads);
        const computedPrice = tier ? tier.price_per_lead : null;

        setPricingInfo({
          tiers,
          nationwide_discount: nationwideDiscount,
          min_batch_size: Number(br.appointment_min_batch_size) || 5,
          is_custom: isCustom,
          computed_price: computedPrice,
          product: 'appointments',
        });

        if (!priceOverride && computedPrice !== null) {
          setForm(f => ({ ...f, price_per_appointment: String(computedPrice) }));
        }
      };
      fetchPricing();
      return;
    }

    if (form.batch_delivery === 'niche_research') {
      setPricingInfo(null);
      return;
    }
    if (!form.branch) { setPricingInfo(null); return; }
    const fetchPricing = async () => {
      const branchRes = await adminFetch('/api/admin/branches');
      if (!branchRes.ok) return;
      const branchData = await branchRes.json();
      const br = (branchData.branches || []).find((b: { slug: string }) => b.slug === form.branch);
      if (!br) return;

      const branchTiers: PricingTierData[] = br.pricing_tiers || [];
      let tiers: PricingTierData[] = branchTiers;
      let nationwideDiscount = Number(br.nationwide_discount) || 0;
      let isCustom = false;

      if (form.customer_id) {
        const cpRes = await adminFetch(`/api/admin/customer-pricing?customer_id=${form.customer_id}`);
        if (cpRes.ok) {
          const cpData = await cpRes.json();
          const custom = (cpData.pricing || []).find((p: { branch_slug: string }) => p.branch_slug === form.branch);
          if (custom && custom.pricing_tiers && custom.pricing_tiers.length > 0) {
            tiers = mergeCustomTiers(branchTiers, custom.pricing_tiers);
            if (custom.nationwide_discount != null) nationwideDiscount = Number(custom.nationwide_discount);
            isCustom = true;
          }
        }
      }

      const sorted = [...tiers].sort((a: PricingTierData, b: PricingTierData) => b.min_leads - a.min_leads);
      const tier = sorted.find((t: PricingTierData) => form.batch_size >= t.min_leads);
      const computedPrice = tier ? tier.price_per_lead : null;

      setPricingInfo({
        tiers,
        nationwide_discount: nationwideDiscount,
        min_batch_size: br.min_batch_size || 10,
        is_custom: isCustom,
        computed_price: computedPrice,
        product: 'leads',
      });

      if (!priceOverride && computedPrice !== null) {
        setForm(f => ({ ...f, price_per_lead: String(computedPrice) }));
      }
    };
    fetchPricing();
  }, [form.branch, form.customer_id, form.batch_size, priceOverride, form.batch_delivery, form.batch_product]);

  const create = async () => {
    if (form.batch_product === 'appointments') {
      if (!form.customer_id || !form.branch || !form.batch_size) {
        alert('Vul klant, branche en batchgrootte in.');
        return;
      }
      const ppa = form.price_per_appointment ? parseFloat(form.price_per_appointment) : NaN;
      if (!Number.isFinite(ppa) || ppa <= 0) {
        alert('Vul een geldige prijs per afspraak in (groter dan 0).');
        return;
      }
      setSaving(true);
      try {
        let startsAtISO: string | null = null;
        if (scheduledStart && startsAtDate) {
          const nlDateTime = `${startsAtDate}T${startsAtTime || '09:00'}:00`;
          const nlOffset = getNLOffset(new Date(nlDateTime));
          startsAtISO = `${nlDateTime}${nlOffset}`;
        }
        const res = await adminFetch('/api/admin/appointment-batches', {
          method: 'POST',
          body: JSON.stringify({
            customer_id: form.customer_id,
            branch: form.branch,
            batch_size: form.batch_size,
            price_per_appointment: ppa,
            appointments_per_day: form.appointments_per_day ? parseInt(form.appointments_per_day, 10) : null,
            appointments_per_week: form.appointments_per_week ? parseInt(form.appointments_per_week, 10) : null,
            notes: form.notes || null,
            lead_filters: form.lead_filters.filter(f => f.field && (f.values?.length || 0) > 0),
            is_paid: form.is_paid,
            ...(startsAtISO ? { starts_at: startsAtISO } : {}),
            ...(form.is_paid ? {} : { send_payment_email: form.send_payment_email }),
          }),
        });
        if (res.ok) onCreated();
        else {
          const d = await res.json();
          alert(d.error || 'Aanmaken mislukt');
        }
      } catch {
        alert('Er ging iets mis');
      }
      setSaving(false);
      return;
    }

    if (form.batch_delivery === 'niche_research') {
      if (!form.customer_id || form.niche_title.trim().length < 3) {
        alert('Kies een klant en vul een duidelijke nichenaam in (minimaal 3 tekens).');
        return;
      }
    } else if (!form.customer_id || !form.branch || !form.batch_size) {
      return;
    }
    setSaving(true);
    try {
      let startsAtISO: string | null = null;
      if (scheduledStart && startsAtDate) {
        const nlDateTime = `${startsAtDate}T${startsAtTime || '09:00'}:00`;
        const nlOffset = getNLOffset(new Date(nlDateTime));
        startsAtISO = `${nlDateTime}${nlOffset}`;
      }
      if (form.batch_delivery === 'niche_research') {
        const res = await adminFetch('/api/admin/batches', {
          method: 'POST',
          body: JSON.stringify({
            customer_id: form.customer_id,
            batch_kind: 'niche_research',
            niche_title: form.niche_title.trim(),
            is_paid: form.is_paid,
            notes: form.notes || null,
            ...(startsAtISO ? { starts_at: startsAtISO } : {}),
            ...(form.is_paid ? {} : { send_payment_email: form.send_payment_email }),
          }),
        });
        if (res.ok) onCreated();
        else { const d = await res.json(); alert(d.error || 'Aanmaken mislukt'); }
        setSaving(false);
        return;
      }
      const res = await adminFetch('/api/admin/batches', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: form.customer_id,
          branch: form.branch,
          batch_size: form.batch_size,
          is_paid: form.is_paid,
          price_per_lead: form.price_per_lead ? parseFloat(form.price_per_lead) : null,
          leads_per_day: form.leads_per_day ? parseInt(form.leads_per_day) : null,
          leads_per_week: form.leads_per_week ? parseInt(form.leads_per_week) : null,
          lookback_days: parseInt(form.lookback_days) || 0,
          notes: form.notes || null,
          lead_filters: form.lead_filters.filter(f => f.field && (f.values?.length || 0) > 0),
          starts_at: startsAtISO,
          batch_kind: form.batch_delivery === 'bulk' ? 'bulk_leads' : 'leads',
          ...(form.is_paid ? {} : { send_payment_email: form.send_payment_email }),
          ...(form.batch_delivery === 'pipeline'
            ? {
                meta_campaign_ids: metaCampaignPicks.map(p => p.id).slice(0, 10),
                meta_campaign_sync_enabled: metaSyncEnabled,
              }
            : {}),
        }),
      });
      if (res.ok) onCreated();
      else { const d = await res.json(); alert(d.error || 'Aanmaken mislukt'); }
    } catch { alert('Er ging iets mis'); }
    setSaving(false);
  };

  const isNicheDelivery = form.batch_product === 'leads' && form.batch_delivery === 'niche_research';
  const isAppointments = form.batch_product === 'appointments';
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
              <p className="mt-0.5 text-xs text-slate-500">
                {isAppointments ? 'Afspraak-batch voor een klant (parallel aan lead-batches)' : 'Lead-batch voor een klant'}
              </p>
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

          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, batch_product: 'leads' }))}
              className={`flex-1 rounded-md py-2 text-xs font-semibold transition ${
                form.batch_product === 'leads'
                  ? 'bg-brand-purple text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white/80'
              }`}
            >
              Leads
            </button>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, batch_product: 'appointments' }))}
              className={`flex-1 rounded-md py-2 text-xs font-semibold transition ${
                form.batch_product === 'appointments'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white/80'
              }`}
            >
              Afspraken
            </button>
          </div>

          {form.batch_product === 'leads' && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-xs font-medium text-slate-700">Levering</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, batch_delivery: 'pipeline' }))}
                className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${
                  form.batch_delivery === 'pipeline'
                    ? 'border-brand-purple bg-brand-purple/10 text-brand-purple'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Verse leads
                <span className="mt-0.5 block font-normal text-[10px] text-slate-500">Automatische pijplijn + backfill</span>
              </button>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, batch_delivery: 'bulk' }))}
                className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${
                  form.batch_delivery === 'bulk'
                    ? 'border-violet-500 bg-violet-50 text-violet-900'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Bulk (CRM)
                <span className="mt-0.5 block font-normal text-[10px] text-slate-500">Factuur/anker; export naar portaal</span>
              </button>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, batch_delivery: 'niche_research' }))}
                className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${
                  form.batch_delivery === 'niche_research'
                    ? 'border-fuchsia-600 bg-fuchsia-50 text-fuchsia-950'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Niche-onderzoek
                <span className="mt-0.5 block font-normal text-[10px] text-slate-600">€1.000 excl. btw · validatie + voorbereiding</span>
              </button>
            </div>
          </div>
          )}

          {isAppointments && (
            <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-3 text-[11px] text-teal-900">
              <p className="font-semibold text-teal-950">Afspraak-batch</p>
              <p className="mt-0.5 text-teal-900/90">
                Zelfde product als in het klantportaal: aparte facturatie, minimum batchgrootte per branche, filters optioneel.
              </p>
            </div>
          )}

          {!isNicheDelivery ? (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Branche *</label>
            <select value={form.branch} onChange={e => setForm(f => ({ ...f, branch: e.target.value, lead_filters: [] }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-purple/50">
              <option value="">Selecteer branche...</option>
              {activeBranches.map(b => <option key={b.slug} value={b.slug}>{b.name}</option>)}
            </select>
          </div>
          ) : (
            <div className="space-y-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Niche / onderwerp *</label>
                <input
                  type="text"
                  value={form.niche_title}
                  onChange={e => setForm(f => ({ ...f, niche_title: e.target.value }))}
                  placeholder="Bijv. elektriciens in regio X"
                  maxLength={200}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-fuchsia-500/50"
                />
                <p className="mt-1 text-[10px] text-slate-500">Minimaal 3 tekens. Zelfde product als in het klantportaal (€1.000 excl. btw, 100% te crediteren in leads).</p>
              </div>
              <div className="rounded-lg border border-fuchsia-200 bg-fuchsia-50/50 px-3 py-2 text-[11px] text-fuchsia-950">
                <p className="font-semibold">Vast pakket</p>
                <p className="mt-0.5 text-fuchsia-900/90">1 × €1.000 excl. btw · geen lead-staffel · branche <span className="font-mono text-[10px]">niche_research</span> wordt automatisch gezet.</p>
              </div>
            </div>
          )}

          {!isNicheDelivery && (
          <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Batch grootte *</label>
              <input type="number" value={form.batch_size} onChange={e => setForm(f => ({ ...f, batch_size: Number(e.target.value) }))} min={1}
                className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 outline-none ${
                  isAppointments && pricingInfo?.product === 'appointments' && form.batch_size > 0 && form.batch_size < pricingInfo.min_batch_size
                    ? 'border-amber-400 bg-amber-50/40 focus:border-amber-500'
                    : 'border-slate-200 focus:border-brand-purple/50'
                }`} />
              {isAppointments && pricingInfo?.product === 'appointments' && (
                <p className="mt-0.5 text-[10px] text-slate-500">Minimum in deze branche: {pricingInfo.min_batch_size}</p>
              )}
            </div>
            <div>
              <label className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-500">
                {isAppointments ? '€/afspraak' : '€/lead'}
                {pricingInfo?.computed_price != null && !priceOverride && pricingInfo.product === (isAppointments ? 'appointments' : 'leads') && (
                  <span className="rounded bg-emerald-50 px-1 py-0.5 text-[9px] font-bold text-emerald-600">AUTO</span>
                )}
              </label>
              {isAppointments ? (
                <>
                  <input type="number" step="0.01" value={form.price_per_appointment}
                    onChange={e => { setPriceOverride(true); setForm(f => ({ ...f, price_per_appointment: e.target.value })); }}
                    placeholder="-"
                    className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-600/50 ${
                      pricingInfo?.computed_price != null && !priceOverride && pricingInfo.product === 'appointments' ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200'
                    }`} />
                  {priceOverride && pricingInfo?.computed_price != null && pricingInfo.product === 'appointments' && (
                    <button type="button" onClick={() => { setPriceOverride(false); setForm(f => ({ ...f, price_per_appointment: String(pricingInfo.computed_price) })); }}
                      className="mt-0.5 text-[10px] text-teal-700 hover:underline">
                      Reset naar staffelprijs (€{pricingInfo.computed_price.toFixed(2)})
                    </button>
                  )}
                </>
              ) : (
                <>
                  <input type="number" step="0.01" value={form.price_per_lead}
                    onChange={e => { setPriceOverride(true); setForm(f => ({ ...f, price_per_lead: e.target.value })); }}
                    placeholder="-"
                    className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50 ${
                      pricingInfo?.computed_price != null && !priceOverride && pricingInfo.product === 'leads' ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200'
                    }`} />
                  {priceOverride && pricingInfo?.computed_price != null && pricingInfo.product === 'leads' && (
                    <button type="button" onClick={() => { setPriceOverride(false); setForm(f => ({ ...f, price_per_lead: String(pricingInfo.computed_price) })); }}
                      className="mt-0.5 text-[10px] text-brand-purple hover:underline">
                      Reset naar staffelprijs (€{pricingInfo.computed_price.toFixed(2)})
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {pricingInfo && pricingInfo.tiers.length > 0 && (
            <div className={`rounded-lg border p-3 ${isAppointments ? 'border-teal-200 bg-teal-50/40' : 'border-slate-200 bg-slate-50/50'}`}>
              <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {isAppointments ? 'Staffel (€/afspraak)' : 'Staffelprijzen'} {pricingInfo.is_custom && <span className="rounded bg-amber-100 px-1 py-0.5 text-amber-700 normal-case">Klantspecifiek</span>}
              </div>
              <div className="flex flex-wrap gap-1">
                {[...pricingInfo.tiers].sort((a, b) => a.min_leads - b.min_leads).map((t, i) => {
                  const sortedAsc = [...pricingInfo.tiers].sort((a, b) => a.min_leads - b.min_leads);
                  const active =
                    form.batch_size >= t.min_leads &&
                    (i === sortedAsc.length - 1 || form.batch_size < sortedAsc[i + 1]?.min_leads);
                  const activeCls =
                    isAppointments
                      ? 'border-teal-600 bg-teal-100/80 text-teal-900'
                      : 'border-brand-purple bg-brand-purple/10 text-brand-purple';
                  return (
                  <span key={i} className={`rounded-md border px-1.5 py-0.5 text-[10px] font-medium shadow-sm ${
                    active ? activeCls : 'border-slate-100 bg-white text-slate-600'
                  }`}>
                    {t.min_leads}+ → €{Number(t.price_per_lead).toFixed(2)}
                  </span>
                );
                })}
              </div>
              {Number(pricingInfo.nationwide_discount) > 0 && (
                <p className="mt-1 text-[10px] text-emerald-600">
                  Landelijke korting: -€{pricingInfo.nationwide_discount.toFixed(2)}{isAppointments ? '/afspraak' : '/lead'}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Max per dag</label>
              {isAppointments ? (
                <input type="number" value={form.appointments_per_day} onChange={e => setForm(f => ({ ...f, appointments_per_day: e.target.value }))}
                  placeholder="∞" min={1}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-600/50" />
              ) : (
                <input type="number" value={form.leads_per_day} onChange={e => setForm(f => ({ ...f, leads_per_day: e.target.value }))}
                  placeholder="∞" min={1}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Max per week</label>
              {isAppointments ? (
                <input type="number" value={form.appointments_per_week} onChange={e => setForm(f => ({ ...f, appointments_per_week: e.target.value }))}
                  placeholder="∞" min={1}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-600/50" />
              ) : (
                <input type="number" value={form.leads_per_week} onChange={e => setForm(f => ({ ...f, leads_per_week: e.target.value }))}
                  placeholder="∞" min={1}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
              )}
            </div>
          </div>
          </>
          )}

          {/* Lookback — alleen zinvol voor lead pijplijn-batches */}
          {isAppointments ? (
            <div className="rounded-lg border border-teal-200 bg-teal-50/30 p-3 text-[11px] text-teal-900">
              Lookback geldt niet voor afspraak-batches. Startmoment hieronder bepaalt wanneer de batch actief wordt (na betaling).
            </div>
          ) : form.batch_delivery === 'pipeline' ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700">Lookback dagen</p>
                  <p className="text-[11px] text-slate-400">
                    {form.lookback_days === '0'
                      ? 'Alleen nieuwe leads, geen bestaande leads laden'
                      : `Direct bestaande leads van de afgelopen ${form.lookback_days || 3} dag(en) toewijzen`}
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
            </div>
          ) : form.batch_delivery === 'bulk' ? (
            <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-3 text-[11px] text-violet-900">
              Lookback en automatische backfill gelden niet voor bulk-batches. Leads koppel je later via <span className="font-semibold">Admin → Leads → Bulk export</span> met portaaltoewijzing.
            </div>
          ) : (
            <div className="rounded-lg border border-fuchsia-200 bg-fuchsia-50/40 p-3 text-[11px] text-fuchsia-950">
              Lookback en automatische lead-toewijzing gelden niet voor onderzoeksbatches. Eenmalig pakket à €1.000 excl. btw (zelfde als portaal).
            </div>
          )}

          {!isAppointments && form.batch_delivery === 'pipeline' && (
            <MetaCampaignLinkerFields
              title="Meta campagnes (optioneel)"
              helpText={
                <>
                  Koppel één of <strong>meerdere</strong> Meta-campagnes. Ze worden samen op <strong>ACTIVE</strong> of{' '}
                  <strong>PAUSED</strong> gezet volgens deze batch (zoals bij bewerken). Leeg laten kan; je kunt later altijd
                  alsnog koppelen.
                </>
              }
              picks={metaCampaignPicks}
              setPicks={setMetaCampaignPicks}
              syncEnabled={metaSyncEnabled}
              setSyncEnabled={setMetaSyncEnabled}
            />
          )}

          {/* Startdatum */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">Startdatum</p>
                <p className="text-[11px] text-slate-400">
                  {isAppointments
                    ? (scheduledStart
                      ? 'Afspraak-batch wordt actief op het ingestelde tijdstip (na betaling).'
                      : 'Batch start direct na aanmaken (na betaling).')
                    : form.batch_delivery === 'bulk'
                    ? (scheduledStart ? 'Batch wordt actief op het ingestelde tijdstip (zonder automatische lead-toewijzing).' : 'Batch start direct na aanmaken.')
                    : form.batch_delivery === 'niche_research'
                      ? (scheduledStart ? 'Batch-record actief vanaf dit tijdstip (geen automatische lead-flow).' : 'Batch start direct na aanmaken.')
                      : (scheduledStart ? 'Batch start op het ingestelde tijdstip' : 'Batch start direct na aanmaken')}
                </p>
              </div>
              <button type="button" onClick={() => {
                const next = !scheduledStart;
                setScheduledStart(next);
                if (next && !startsAtDate) {
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  setStartsAtDate(tomorrow.toISOString().slice(0, 10));
                }
              }}
                role="switch" aria-checked={scheduledStart}
                className={`relative inline-flex h-[26px] w-[48px] shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${
                  scheduledStart ? 'bg-brand-purple' : 'bg-slate-300'
                }`}>
                <span className={`pointer-events-none inline-block h-[22px] w-[22px] transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                  scheduledStart ? 'translate-x-[24px]' : 'translate-x-[2px]'
                }`} />
              </button>
            </div>
            {scheduledStart && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">Datum</label>
                  <div className="relative">
                    <CalendarDaysIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input type="date" value={startsAtDate} onChange={e => setStartsAtDate(e.target.value)}
                      min={new Date().toISOString().slice(0, 10)}
                      className="w-full rounded-lg border border-brand-purple/20 bg-white py-2 pl-8 pr-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/20" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">Tijd (NL)</label>
                  <div className="relative">
                    <ClockIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input type="time" value={startsAtTime} onChange={e => setStartsAtTime(e.target.value)}
                      className="w-full rounded-lg border border-brand-purple/20 bg-white py-2 pl-8 pr-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/20" />
                  </div>
                </div>
                <p className="col-span-2 text-[10px] text-slate-400">
                  {isAppointments
                    ? 'Batch is direct betaalbaar; afspraken worden volgens jullie proces toegewezen. Geen lead-lookback.'
                    : form.batch_delivery === 'bulk'
                    ? 'Batch is direct betaalbaar; bulk-leads worden handmatig via export aan het portaal gekoppeld.'
                    : form.batch_delivery === 'niche_research'
                      ? 'Onderzoeksbatch: facturatie en opvolging volgens afspraak met de klant (zelfde product als portaal).'
                      : 'Batch is direct betaalbaar, maar leads worden pas toegewezen vanaf dit moment. De lookback telt dan ook terug vanaf de startdatum.'}
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Notities</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
          </div>

          {/* Payment status */}
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div>
              <p className="text-sm font-medium text-slate-700">Betaalstatus</p>
              <p className="text-[11px] text-slate-400">
                {form.is_paid
                  ? 'Batch wordt als betaald gemarkeerd'
                  : isAppointments
                    ? 'Klant kan via portaal betalen (afspraken-factuur)'
                    : form.batch_delivery === 'bulk'
                    ? 'Open factuur / betaallink voor het bulk-pakket'
                    : form.batch_delivery === 'niche_research'
                      ? 'Open factuur / betaallink voor het onderzoekspakket (€1.000 excl. btw)'
                      : 'Klant kan via portaal betalen'}
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

          {!form.is_paid && (
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div>
                <p className="text-sm font-medium text-slate-700">Stuur betaallink-mail naar klant</p>
                <p className="text-[11px] text-slate-400">
                  {form.send_payment_email
                    ? 'Klant ontvangt direct de open factuur met Mollie-betaallink'
                    : 'Factuur wordt aangemaakt zonder mail — verstuur later via de batchdetails'}
                </p>
              </div>
              <button type="button" onClick={() => setForm(f => ({ ...f, send_payment_email: !f.send_payment_email }))}
                role="switch" aria-checked={form.send_payment_email}
                aria-label={form.send_payment_email ? 'Betaallink-mail uitschakelen' : 'Betaallink-mail inschakelen'}
                className={`relative inline-flex h-[26px] w-[48px] shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${
                  form.send_payment_email ? 'bg-emerald-500' : 'bg-slate-300'
                }`}>
                <span className={`pointer-events-none inline-block h-[22px] w-[22px] transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                  form.send_payment_email ? 'translate-x-[24px]' : 'translate-x-[2px]'
                }`} />
              </button>
            </div>
          )}

          {!isNicheDelivery && form.branch && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">
                {isAppointments ? 'Filters (optioneel, zelfde als bij lead-batches)' : 'Lead vereisten (filters)'}
              </label>
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
          <button
            type="button"
            onClick={create}
            disabled={
              saving ||
              !form.customer_id ||
              (isNicheDelivery
                ? form.niche_title.trim().length < 3
                : !form.branch ||
                  form.batch_size < 1 ||
                  (isAppointments &&
                    (!form.price_per_appointment.trim() ||
                      !Number.isFinite(parseFloat(form.price_per_appointment)) ||
                      parseFloat(form.price_per_appointment) <= 0)))
            }
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-button-gradient py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
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
