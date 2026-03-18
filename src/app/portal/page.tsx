'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { usePortal } from './portalContext';
import { portalFetch } from '@/lib/portalAuth';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  ArrowTrendingUpIcon,
  CheckCircleIcon,
  SparklesIcon,
  ChevronUpDownIcon,
  InboxIcon,
  ClipboardDocumentIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function whatsappUrl(phone: string) {
  const digits = phone.replace(/\D/g, '');
  const intl = digits.startsWith('0') ? '31' + digits.slice(1) : digits;
  return `https://wa.me/${intl}`;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'Alle statussen' },
  { value: 'nieuw', label: 'Nieuw' },
  { value: 'gecontacteerd', label: 'Gecontacteerd' },
  { value: 'offerte', label: 'Offerte' },
  { value: 'verkocht', label: 'Verkocht' },
  { value: 'afgewezen', label: 'Afgewezen' },
];

const STATUS_COLORS: Record<string, string> = {
  nieuw: 'bg-blue-100 text-blue-700',
  gecontacteerd: 'bg-amber-100 text-amber-700',
  offerte: 'bg-purple-100 text-purple-700',
  verkocht: 'bg-emerald-100 text-emerald-700',
  afgewezen: 'bg-slate-100 text-slate-500',
};

const BRANCH_LABELS: Record<string, string> = {
  thuisbatterij: 'Thuisbatterij',
  airco: 'Airco',
};

interface Lead {
  id: string;
  branch: string;
  naam_klant: string;
  email: string;
  telefoonnummer: string;
  postcode: string;
  huisnummer: string;
  plaatsnaam: string;
  provincie: string;
  status: string;
  notities: string;
  wervingsdatum: string;
  created_at: string;
  bron: string;
  zonnepanelen?: string;
  dynamisch_contract?: string;
  stroomverbruik?: string;
  budget?: string;
  reden_thuisbatterij?: string;
  type_airco?: string;
  koelen_verwarmen?: string;
  hoeveel_ruimtes?: string;
  zakelijk?: string;
  koop_of_huur?: string;
  boorwerkzaamheden_toegestaan?: string;
}

interface Stats {
  totalLeads: number;
  newThisWeek: number;
  contacted: number;
  sold: number;
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="h-8 w-8 animate-pulse rounded-lg bg-slate-100" />
          <div className="mt-3 h-7 w-16 animate-pulse rounded bg-slate-100" />
          <div className="mt-1.5 h-3 w-24 animate-pulse rounded bg-slate-50" />
        </div>
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              {['Naam', 'Plaats', 'Branche', 'Status', 'Datum', 'Contact'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {[...Array(5)].map((_, i) => (
              <tr key={i}>
                <td className="px-4 py-3"><div className="space-y-1"><div className="h-4 w-28 animate-pulse rounded bg-slate-100" /><div className="h-3 w-20 animate-pulse rounded bg-slate-50" /></div></td>
                <td className="px-4 py-3"><div className="h-4 w-20 animate-pulse rounded bg-slate-100" /></td>
                <td className="px-4 py-3"><div className="h-5 w-20 animate-pulse rounded-full bg-slate-100" /></td>
                <td className="px-4 py-3"><div className="h-5 w-24 animate-pulse rounded-full bg-slate-100" /></td>
                <td className="px-4 py-3"><div className="h-4 w-24 animate-pulse rounded bg-slate-100" /></td>
                <td className="px-4 py-3"><div className="flex gap-1.5"><div className="h-7 w-7 animate-pulse rounded-lg bg-slate-100" /><div className="h-7 w-7 animate-pulse rounded-lg bg-slate-100" /><div className="h-7 w-7 animate-pulse rounded-lg bg-slate-100" /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-start justify-between">
              <div className="space-y-1.5">
                <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-24 animate-pulse rounded bg-slate-50" />
              </div>
              <div className="h-5 w-16 animate-pulse rounded-full bg-slate-100" />
            </div>
            <div className="mb-3 flex items-center gap-2">
              <div className="h-5 w-20 animate-pulse rounded-full bg-slate-100" />
              <div className="h-3 w-24 animate-pulse rounded bg-slate-50" />
            </div>
            <div className="flex gap-2">
              <div className="h-9 flex-1 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-9 flex-1 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-9 flex-1 animate-pulse rounded-lg bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function formatDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateLong(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function PortalPage() {
  const { customer } = usePortal();

  const [stats, setStats] = useState<Stats>({ totalLeads: 0, newThisWeek: 0, contacted: 0, sold: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sort, setSort] = useState('created_at');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const showBranchFilter = customer.branches.length > 1;
  const conversionRate = stats.totalLeads > 0
    ? Math.round((stats.sold / stats.totalLeads) * 100)
    : 0;

  const fetchStats = useCallback(async (silent = false) => {
    if (!silent) setStatsLoading(true);
    try {
      const res = await portalFetch('/api/portal/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } finally {
      if (!silent) setStatsLoading(false);
    }
  }, []);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', page.toString());
    params.set('limit', '25');
    params.set('sort', sort);
    params.set('order', order);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (branchFilter !== 'all') params.set('branch', branchFilter);
    if (search) params.set('search', search);
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);

    const res = await portalFetch(`/api/portal/leads?${params}`);
    if (res.ok) {
      const data = await res.json();
      setLeads(data.leads || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    }
    setLoading(false);
  }, [page, sort, order, statusFilter, branchFilter, search, dateFrom, dateTo]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const toggleSort = (col: string) => {
    if (sort === col) {
      setOrder(o => o === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(col);
      setOrder('desc');
    }
    setPage(1);
  };

  const handleStatusUpdate = async (lead: Lead, newStatus: string) => {
    const oldStatus = lead.status;

    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: newStatus } : l));
    if (selectedLead?.id === lead.id) {
      setSelectedLead({ ...lead, status: newStatus });
    }
    showToast('Status bijgewerkt');

    try {
      const res = await portalFetch('/api/portal/leads', {
        method: 'PUT',
        body: JSON.stringify({ id: lead.id, status: newStatus }),
      });
      if (!res.ok) throw new Error();
      fetchStats(true);
    } catch {
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: oldStatus } : l));
      if (selectedLead?.id === lead.id) {
        setSelectedLead({ ...lead, status: oldStatus });
      }
      showToast('Fout bij bijwerken status');
    }
  };

  const handleNotesUpdate = async (lead: Lead, newNotes: string) => {
    const oldNotes = lead.notities;

    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, notities: newNotes } : l));
    if (selectedLead?.id === lead.id) {
      setSelectedLead({ ...lead, notities: newNotes });
    }
    showToast('Notities opgeslagen');

    try {
      const res = await portalFetch('/api/portal/leads', {
        method: 'PUT',
        body: JSON.stringify({ id: lead.id, notities: newNotes }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, notities: oldNotes } : l));
      if (selectedLead?.id === lead.id) {
        setSelectedLead({ ...lead, notities: oldNotes });
      }
      showToast('Fout bij opslaan notities');
    }
  };

  const exportCSV = useCallback(() => {
    if (leads.length === 0) return;
    const headers = ['Naam', 'E-mail', 'Telefoon', 'Postcode', 'Plaats', 'Provincie', 'Status', 'Branche', 'Datum'];
    const rows = leads.map(l => [
      l.naam_klant, l.email, l.telefoonnummer, l.postcode, l.plaatsnaam, l.provincie, l.status, l.branch,
      l.wervingsdatum ? new Date(l.wervingsdatum).toLocaleDateString('nl-NL') : '',
    ]);
    const csv = [headers.join(';'), ...rows.map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${customer.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [leads, customer.name]);

  const activeFilters = useMemo(() => {
    let count = 0;
    if (statusFilter !== 'all') count++;
    if (branchFilter !== 'all') count++;
    if (dateFrom) count++;
    if (dateTo) count++;
    return count;
  }, [statusFilter, branchFilter, dateFrom, dateTo]);

  const resetFilters = () => {
    setStatusFilter('all');
    setBranchFilter('all');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const viewNewLeads = () => {
    setStatusFilter('nieuw');
    setPage(1);
    setShowFilters(false);
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-xl"
          >
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="h-4 w-4 text-emerald-400" />
              {toast}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Welcome */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
          Welkom, {customer.contact_person || customer.name}
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Uw leadoverzicht voor {customer.name}
        </p>
      </div>

      {/* Stats */}
      {statsLoading ? (
        <StatsSkeleton />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Totaal leads', value: stats.totalLeads, icon: UserGroupIcon, color: 'text-brand-purple', bg: 'bg-brand-purple/10' },
            { label: 'Nieuw deze week', value: stats.newThisWeek, icon: SparklesIcon, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Gecontacteerd', value: stats.contacted, icon: ArrowTrendingUpIcon, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Verkocht', value: stats.sold, icon: CheckCircleIcon, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          ].map(stat => (
            <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${stat.bg}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold text-slate-900">{stat.value}</p>
              <p className="text-xs text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Conversion rate + New leads banner */}
      {!statsLoading && stats.totalLeads > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-1">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-purple/10">
              <ChartBarIcon className="h-5 w-5 text-brand-purple" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-slate-500">Conversieratio</p>
              <div className="mt-0.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-purple to-brand-pink transition-all duration-500"
                    style={{ width: `${Math.min(conversionRate, 100)}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-slate-900">{conversionRate}%</span>
              </div>
            </div>
          </div>

          {stats.newThisWeek > 0 && (
            <button
              onClick={viewNewLeads}
              className="flex items-center gap-3 rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 shadow-sm transition hover:shadow-md sm:flex-1"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                <SparklesIcon className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-slate-900">
                  {stats.newThisWeek} nieuwe {stats.newThisWeek === 1 ? 'lead' : 'leads'}
                </p>
                <p className="text-xs text-slate-500">Klik om te bekijken</p>
              </div>
              <ChevronRightIcon className="h-4 w-4 text-slate-400" />
            </button>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 sm:max-w-xs">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Zoeken op naam, e-mail, telefoon..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/20"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`relative inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${
              showFilters || activeFilters > 0
                ? 'border-brand-purple/30 bg-brand-purple/5 text-brand-purple'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <FunnelIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilters > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-purple text-[10px] font-bold text-white">
                {activeFilters}
              </span>
            )}
          </button>
        </div>
        <button
          onClick={exportCSV}
          disabled={leads.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
        >
          <ArrowDownTrayIcon className="h-4 w-4" />
          Exporteer CSV
        </button>
      </div>

      {/* Filters panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-purple/50"
                >
                  {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              {showBranchFilter && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Branche</label>
                  <select
                    value={branchFilter}
                    onChange={(e) => { setBranchFilter(e.target.value); setPage(1); }}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-purple/50"
                  >
                    <option value="all">Alle branches</option>
                    {customer.branches.map(b => (
                      <option key={b} value={b}>{BRANCH_LABELS[b] || b}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Datum vanaf</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-purple/50"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Datum tot</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-purple/50"
                />
              </div>
              {activeFilters > 0 && (
                <div className="flex items-end">
                  <button
                    onClick={resetFilters}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50"
                  >
                    Wis filters
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results count */}
      <p className="text-xs text-slate-500">
        {total} {total === 1 ? 'lead' : 'leads'} gevonden
      </p>

      {/* Data */}
      {loading ? (
        <TableSkeleton />
      ) : leads.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center shadow-sm">
          <InboxIcon className="mx-auto mb-3 h-12 w-12 text-slate-300" />
          <p className="font-medium text-slate-600">Nog geen leads</p>
          <p className="mt-1 text-sm text-slate-400">Zodra er leads voor u worden gegenereerd, verschijnen ze hier.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    {[
                      { key: 'naam_klant', label: 'Naam' },
                      { key: 'plaatsnaam', label: 'Plaats' },
                      { key: 'branch', label: 'Branche' },
                      { key: 'status', label: 'Status' },
                      { key: 'wervingsdatum', label: 'Datum' },
                    ].map(col => (
                      <th
                        key={col.key}
                        className="cursor-pointer px-4 py-3 text-left text-xs font-medium text-slate-500 transition hover:text-slate-700"
                        onClick={() => toggleSort(col.key)}
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          <ChevronUpDownIcon className={`h-3.5 w-3.5 ${sort === col.key ? 'text-brand-purple' : 'text-slate-300'}`} />
                        </span>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Contact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leads.map(lead => (
                    <tr
                      key={lead.id}
                      onClick={() => setSelectedLead(lead)}
                      className="cursor-pointer transition hover:bg-slate-50"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-900">{lead.naam_klant || '—'}</p>
                          {lead.telefoonnummer && (
                            <p className="text-xs text-slate-400">{lead.telefoonnummer}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{lead.plaatsnaam || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${lead.branch === 'thuisbatterij' ? 'bg-emerald-50 text-emerald-600' : 'bg-sky-50 text-sky-600'}`}>
                          {BRANCH_LABELS[lead.branch] || lead.branch}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={lead.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleStatusUpdate(lead, e.target.value)}
                          className={`rounded-full border-0 px-2.5 py-0.5 text-[11px] font-medium outline-none ${STATUS_COLORS[lead.status] || 'bg-slate-100 text-slate-600'}`}
                        >
                          {STATUS_OPTIONS.filter(o => o.value !== 'all').map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(lead.wervingsdatum)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {lead.telefoonnummer && (
                            <a
                              href={`tel:${lead.telefoonnummer}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100"
                              title="Bellen"
                            >
                              <PhoneIcon className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {lead.telefoonnummer && (
                            <a
                              href={whatsappUrl(lead.telefoonnummer)}
                              onClick={(e) => e.stopPropagation()}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-green-50 text-green-600 transition hover:bg-green-100"
                              title="WhatsApp"
                            >
                              <WhatsAppIcon className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {lead.email && (
                            <a
                              href={`mailto:${lead.email}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition hover:bg-blue-100"
                              title="E-mail"
                            >
                              <EnvelopeIcon className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {leads.map(lead => (
              <div
                key={lead.id}
                onClick={() => setSelectedLead(lead)}
                className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition active:scale-[0.99]"
              >
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{lead.naam_klant || '—'}</p>
                    {(lead.plaatsnaam || lead.postcode) && (
                      <p className="flex items-center gap-1 text-xs text-slate-500">
                        <MapPinIcon className="h-3 w-3" />
                        {[lead.postcode, lead.huisnummer, lead.plaatsnaam].filter(Boolean).join(', ')}
                        {lead.provincie ? ` (${lead.provincie})` : ''}
                      </p>
                    )}
                  </div>
                  <select
                    value={lead.status}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => handleStatusUpdate(lead, e.target.value)}
                    className={`rounded-full border-0 px-2 py-0.5 text-[10px] font-medium outline-none ${STATUS_COLORS[lead.status] || 'bg-slate-100 text-slate-600'}`}
                  >
                    {STATUS_OPTIONS.filter(o => o.value !== 'all').map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${lead.branch === 'thuisbatterij' ? 'bg-emerald-50 text-emerald-600' : 'bg-sky-50 text-sky-600'}`}>
                    {BRANCH_LABELS[lead.branch] || lead.branch}
                  </span>
                  <span className="flex items-center gap-1">
                    <CalendarDaysIcon className="h-3 w-3" />
                    {formatDate(lead.wervingsdatum)}
                  </span>
                </div>
                <div className="flex gap-2">
                  {lead.telefoonnummer && (
                    <a
                      href={`tel:${lead.telefoonnummer}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-50 py-2 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100"
                    >
                      <PhoneIcon className="h-3.5 w-3.5" /> Bellen
                    </a>
                  )}
                  {lead.telefoonnummer && (
                    <a
                      href={whatsappUrl(lead.telefoonnummer)}
                      onClick={(e) => e.stopPropagation()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-green-50 py-2 text-xs font-medium text-green-700 transition hover:bg-green-100"
                    >
                      <WhatsAppIcon className="h-3.5 w-3.5" /> WhatsApp
                    </a>
                  )}
                  {lead.email && (
                    <a
                      href={`mailto:${lead.email}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-50 py-2 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
                    >
                      <EnvelopeIcon className="h-3.5 w-3.5" /> E-mail
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Pagina {page} van {totalPages}
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Lead detail slide-over */}
      <AnimatePresence>
        {selectedLead && (
          <LeadDetailPanel
            lead={selectedLead}
            onClose={() => setSelectedLead(null)}
            onStatusChange={(s) => handleStatusUpdate(selectedLead, s)}
            onNotesChange={(n) => handleNotesUpdate(selectedLead, n)}
            showToast={showToast}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function LeadDetailPanel({
  lead,
  onClose,
  onStatusChange,
  onNotesChange,
  showToast,
}: {
  lead: Lead;
  onClose: () => void;
  onStatusChange: (s: string) => void;
  onNotesChange: (n: string) => void;
  showToast: (msg: string) => void;
}) {
  const [notes, setNotes] = useState(lead.notities || '');
  const [notesDirty, setNotesDirty] = useState(false);

  useEffect(() => {
    setNotes(lead.notities || '');
    setNotesDirty(false);
  }, [lead.id, lead.notities]);

  const saveNotes = () => {
    onNotesChange(notes);
    setNotesDirty(false);
  };

  const copyContactInfo = () => {
    const lines = [
      lead.naam_klant,
      lead.telefoonnummer,
      lead.email,
      [lead.postcode, lead.huisnummer, lead.plaatsnaam, lead.provincie].filter(Boolean).join(', '),
    ].filter(Boolean);
    navigator.clipboard.writeText(lines.join('\n'));
    showToast('Contactgegevens gekopieerd');
  };

  const branchFields = lead.branch === 'thuisbatterij'
    ? [
        { label: 'Zonnepanelen', value: lead.zonnepanelen },
        { label: 'Dynamisch contract', value: lead.dynamisch_contract },
        { label: 'Stroomverbruik', value: lead.stroomverbruik },
        { label: 'Budget', value: lead.budget },
        { label: 'Reden thuisbatterij', value: lead.reden_thuisbatterij },
      ]
    : lead.branch === 'airco'
    ? [
        { label: 'Type airco', value: lead.type_airco },
        { label: 'Koelen/verwarmen', value: lead.koelen_verwarmen },
        { label: 'Hoeveel ruimtes', value: lead.hoeveel_ruimtes },
        { label: 'Zakelijk', value: lead.zakelijk },
        { label: 'Koop of huur', value: lead.koop_of_huur },
        { label: 'Boorwerkzaamheden', value: lead.boorwerkzaamheden_toegestaan },
      ]
    : [];

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0, right: 0.5 }}
        dragDirectionLock
        onDragEnd={(_, info) => {
          if (info.offset.x > 80 || info.velocity.x > 300) onClose();
        }}
        className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-md flex-col bg-white shadow-2xl"
      >
        {/* Swipe indicator - mobile */}
        <div className="flex justify-center pt-2 md:hidden">
          <div className="h-1 w-10 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="shrink-0 border-b border-slate-100 bg-white">
          <div className="h-[3px] bg-warmeleads-gradient" />
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{lead.naam_klant || 'Lead details'}</h2>
              <p className="text-xs text-slate-500">
                {BRANCH_LABELS[lead.branch] || lead.branch} &middot; {formatDateLong(lead.wervingsdatum)}
              </p>
            </div>
            <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-5 p-5">
            {/* Status */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Status</label>
              <select
                value={lead.status}
                onChange={(e) => onStatusChange(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-purple/50"
              >
                {STATUS_OPTIONS.filter(o => o.value !== 'all').map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Contact info */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Contactgegevens</h3>
                <button
                  onClick={copyContactInfo}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <ClipboardDocumentIcon className="h-3.5 w-3.5" />
                  Kopieer
                </button>
              </div>
              <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-4">
                {lead.telefoonnummer && (
                  <div className="flex items-center justify-between">
                    <a href={`tel:${lead.telefoonnummer}`} className="flex items-center gap-3 text-sm text-slate-700 hover:text-brand-purple">
                      <PhoneIcon className="h-4 w-4 text-slate-400" /> {lead.telefoonnummer}
                    </a>
                    <a
                      href={whatsappUrl(lead.telefoonnummer)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2 py-1 text-[11px] font-medium text-green-700 transition hover:bg-green-100"
                    >
                      <WhatsAppIcon className="h-3 w-3" /> WhatsApp
                    </a>
                  </div>
                )}
                {lead.email && (
                  <a href={`mailto:${lead.email}`} className="flex items-center gap-3 text-sm text-slate-700 hover:text-brand-purple">
                    <EnvelopeIcon className="h-4 w-4 text-slate-400" /> {lead.email}
                  </a>
                )}
                {(lead.postcode || lead.plaatsnaam) && (
                  <p className="flex items-center gap-3 text-sm text-slate-700">
                    <MapPinIcon className="h-4 w-4 text-slate-400" />
                    {[lead.postcode, lead.huisnummer, lead.plaatsnaam, lead.provincie].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
            </div>

            {/* Branch-specific fields */}
            {branchFields.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {BRANCH_LABELS[lead.branch]} details
                </h3>
                <div className="space-y-1.5 rounded-xl border border-slate-100 bg-slate-50 p-4">
                  {branchFields.map(f => f.value ? (
                    <div key={f.label} className="flex justify-between text-sm">
                      <span className="text-slate-500">{f.label}</span>
                      <span className="font-medium text-slate-700">{f.value}</span>
                    </div>
                  ) : null)}
                  {branchFields.every(f => !f.value) && (
                    <p className="text-xs text-slate-400">Geen specifieke details beschikbaar</p>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Notities</label>
              <textarea
                value={notes}
                onChange={(e) => { setNotes(e.target.value); setNotesDirty(true); }}
                rows={4}
                placeholder="Voeg hier uw notities toe..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-purple/50"
              />
              {notesDirty && (
                <button
                  onClick={saveNotes}
                  className="mt-2 rounded-lg bg-button-gradient px-4 py-1.5 text-xs font-bold text-white shadow-sm"
                >
                  Notities opslaan
                </button>
              )}
            </div>

            {/* Meta info */}
            <div className="border-t border-slate-100 pt-4">
              <div className="space-y-1 text-xs text-slate-400">
                {lead.bron && <p>Bron: {lead.bron}</p>}
                <p>Aangemaakt: {formatDateLong(lead.created_at)}</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}
