'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
} from '@heroicons/react/24/outline';

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

export default function PortalPage() {
  const { customer } = usePortal();

  const [stats, setStats] = useState<Stats>({ totalLeads: 0, newThisWeek: 0, contacted: 0, sold: 0 });
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sort, setSort] = useState('created_at');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const fetchStats = useCallback(async () => {
    const res = await portalFetch('/api/portal/stats');
    if (res.ok) {
      const data = await res.json();
      setStats(data);
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
  }, [page, sort, order, statusFilter, search, dateFrom, dateTo]);

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
    const res = await portalFetch('/api/portal/leads', {
      method: 'PUT',
      body: JSON.stringify({ id: lead.id, status: newStatus }),
    });
    if (res.ok) {
      fetchLeads();
      fetchStats();
      if (selectedLead?.id === lead.id) {
        setSelectedLead({ ...lead, status: newStatus });
      }
    }
  };

  const handleNotesUpdate = async (lead: Lead, newNotes: string) => {
    const res = await portalFetch('/api/portal/leads', {
      method: 'PUT',
      body: JSON.stringify({ id: lead.id, notities: newNotes }),
    });
    if (res.ok) {
      fetchLeads();
      if (selectedLead?.id === lead.id) {
        setSelectedLead({ ...lead, notities: newNotes });
      }
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
    if (dateFrom) count++;
    if (dateTo) count++;
    return count;
  }, [statusFilter, dateFrom, dateTo]);

  const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="space-y-6">
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
                    onClick={() => { setStatusFilter('all'); setDateFrom(''); setDateTo(''); setPage(1); }}
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

      {/* Desktop table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-brand-purple" />
        </div>
      ) : leads.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center shadow-sm">
          <InboxIcon className="mx-auto mb-3 h-12 w-12 text-slate-300" />
          <p className="font-medium text-slate-600">Nog geen leads</p>
          <p className="mt-1 text-sm text-slate-400">Zodra er leads voor u worden gegenereerd, verschijnen ze hier.</p>
        </div>
      ) : (
        <>
          {/* Desktop */}
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
                      <td className="px-4 py-3 font-medium text-slate-900">{lead.naam_klant || '—'}</td>
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
                        <div className="flex items-center gap-2">
                          {lead.telefoonnummer && (
                            <a
                              href={`tel:${lead.telefoonnummer}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100"
                            >
                              <PhoneIcon className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {lead.email && (
                            <a
                              href={`mailto:${lead.email}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition hover:bg-blue-100"
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
                    {lead.plaatsnaam && (
                      <p className="flex items-center gap-1 text-xs text-slate-500">
                        <MapPinIcon className="h-3 w-3" /> {lead.plaatsnaam}{lead.provincie ? `, ${lead.provincie}` : ''}
                      </p>
                    )}
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[lead.status] || 'bg-slate-100 text-slate-600'}`}>
                    {lead.status}
                  </span>
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
}: {
  lead: Lead;
  onClose: () => void;
  onStatusChange: (s: string) => void;
  onNotesChange: (n: string) => void;
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

  const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
  };

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
        className="fixed inset-y-0 right-0 z-[60] w-full max-w-md overflow-y-auto bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white">
          <div className="h-[3px] bg-warmeleads-gradient" />
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{lead.naam_klant || 'Lead details'}</h2>
              <p className="text-xs text-slate-500">
                {BRANCH_LABELS[lead.branch] || lead.branch} &middot; {formatDate(lead.wervingsdatum)}
              </p>
            </div>
            <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

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
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Contactgegevens</h3>
            <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-4">
              {lead.telefoonnummer && (
                <a href={`tel:${lead.telefoonnummer}`} className="flex items-center gap-3 text-sm text-slate-700 hover:text-brand-purple">
                  <PhoneIcon className="h-4 w-4 text-slate-400" /> {lead.telefoonnummer}
                </a>
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
              <p>Aangemaakt: {formatDate(lead.created_at)}</p>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}
