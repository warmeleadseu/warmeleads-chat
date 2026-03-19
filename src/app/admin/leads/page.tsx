'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpDownIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';

interface Customer { id: string; name: string; }
interface BranchField { id: string; key: string; label: string; field_type: string; options: string[]; is_required: boolean; sort_order: number; }
interface BranchConfig { id: string; slug: string; name: string; color: string; is_active: boolean; branch_fields: BranchField[]; }
interface Lead {
  id: string; branch: string; customer_id: string | null; customers?: { id: string; name: string } | null;
  naam_klant: string; email: string; telefoonnummer: string; postcode: string; huisnummer: string;
  plaatsnaam: string; provincie: string; wervingsdatum: string; status: string; notities: string; bron: string;
  custom_fields?: Record<string, string>;
  [key: string]: unknown;
  created_at: string; updated_at: string;
}

const STATUSES = ['nieuw', 'gecontacteerd', 'offerte', 'verkocht', 'afgewezen'] as const;
const STATUS_COLORS: Record<string, string> = {
  nieuw: 'bg-blue-100 text-blue-700',
  gecontacteerd: 'bg-amber-100 text-amber-700',
  offerte: 'bg-purple-100 text-purple-700',
  verkocht: 'bg-emerald-100 text-emerald-700',
  afgewezen: 'bg-red-100 text-red-700',
};
const PROVINCES_NL = ['Drenthe','Flevoland','Friesland','Gelderland','Groningen','Limburg','Noord-Brabant','Noord-Holland','Overijssel','Utrecht','Zeeland','Zuid-Holland'];
const PROVINCES_BE = ['Antwerpen','Brussels','Henegouwen','Luik','Luxemburg','Namen','Oost-Vlaanderen','Vlaams-Brabant','Waals-Brabant','West-Vlaanderen'];
const PROVINCES = [...PROVINCES_NL, ...PROVINCES_BE].sort();

const COMMON_LABELS: Record<string, string> = {
  naam_klant: 'Naam', email: 'E-mail', telefoonnummer: 'Telefoon', postcode: 'Postcode',
  huisnummer: 'Huisnr.', plaatsnaam: 'Plaats', provincie: 'Provincie', wervingsdatum: 'Datum',
  status: 'Status', notities: 'Notities', bron: 'Bron', branch: 'Branche',
};

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

function getLeadFieldValue(lead: Lead, key: string): string {
  if (lead.custom_fields && key in lead.custom_fields) return lead.custom_fields[key] || '';
  if (key in lead) return String(lead[key] ?? '');
  return '';
}

export default function LeadsCRMPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [branches, setBranches] = useState<BranchConfig[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [branch, setBranch] = useState('all');
  const [customerId, setCustomerId] = useState('all');
  const [status, setStatus] = useState('all');
  const [province, setProvince] = useState('all');
  const [source, setSource] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('');

  const fetchMeta = useCallback(async () => {
    const [custRes, branchRes] = await Promise.all([
      adminFetch('/api/admin/customers'),
      adminFetch('/api/admin/branches'),
    ]);
    if (custRes.ok) { const d = await custRes.json(); setCustomers(d.customers || []); }
    if (branchRes.ok) { const d = await branchRes.json(); setBranches(d.branches || []); }
  }, []);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (branch !== 'all') p.set('branch', branch);
    if (customerId !== 'all') p.set('customer_id', customerId);
    if (status !== 'all') p.set('status', status);
    if (province !== 'all') p.set('province', province);
    if (source !== 'all') p.set('source', source);
    if (dateFrom) p.set('date_from', dateFrom);
    if (dateTo) p.set('date_to', dateTo);
    if (search) p.set('search', search);
    p.set('page', String(page));
    p.set('per_page', String(perPage));
    p.set('sort_by', sortBy);
    p.set('sort_dir', sortDir);
    const res = await adminFetch(`/api/admin/leads?${p}`);
    if (res.ok) { const d = await res.json(); setLeads(d.leads || []); setTotal(d.total || 0); }
    setLoading(false);
  }, [branch, customerId, status, province, source, dateFrom, dateTo, search, page, perPage, sortBy, sortDir]);

  useEffect(() => { fetchMeta(); }, [fetchMeta]);
  useEffect(() => { fetchLeads(); }, [fetchLeads]);
  useEffect(() => { setPage(1); }, [branch, customerId, status, province, source, dateFrom, dateTo, search, perPage]);

  const branchMap = useMemo(() => {
    const m: Record<string, BranchConfig> = {};
    branches.forEach(b => { m[b.slug] = b; });
    return m;
  }, [branches]);

  const fieldLabels = useMemo(() => {
    const labels = { ...COMMON_LABELS };
    branches.forEach(b => b.branch_fields.forEach(f => { labels[f.key] = f.label; }));
    return labels;
  }, [branches]);

  const currentBranchFields = useMemo(() => {
    if (branch === 'all') return [];
    return branchMap[branch]?.branch_fields || [];
  }, [branch, branchMap]);

  const visibleCols = useMemo(() => {
    const base: string[] = ['naam_klant', 'email', 'telefoonnummer', 'postcode', 'plaatsnaam', 'status', 'wervingsdatum'];
    const extra = currentBranchFields.slice(0, 3).map(f => f.key);
    return [...base, ...extra];
  }, [currentBranchFields]);

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };
  const toggleSelect = (id: string) => setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleAll = () => { if (selected.size === leads.length) setSelected(new Set()); else setSelected(new Set(leads.map(l => l.id))); };

  const handleBulkStatus = async () => {
    if (!bulkStatus || selected.size === 0) return;
    await Promise.all(Array.from(selected).map(id => adminFetch('/api/admin/leads', { method: 'PUT', body: JSON.stringify({ id, status: bulkStatus }) })));
    setSelected(new Set()); setBulkStatus(''); fetchLeads();
  };
  const handleBulkDelete = async () => {
    if (selected.size === 0 || !confirm(`${selected.size} lead(s) verwijderen?`)) return;
    await adminFetch('/api/admin/leads', { method: 'DELETE', body: JSON.stringify({ ids: Array.from(selected) }) });
    setSelected(new Set()); fetchLeads();
  };

  const handleExport = () => {
    const bFields = currentBranchFields.map(f => f.key);
    const commonKeys = ['branch', 'naam_klant', 'email', 'telefoonnummer', 'postcode', 'huisnummer', 'plaatsnaam', 'provincie', 'wervingsdatum', 'status', 'notities', 'bron'];
    const cols = [...commonKeys, ...bFields, 'customer_name'];
    const header = cols.map(c => c === 'customer_name' ? 'Klant' : fieldLabels[c] || c).join(',');
    const rows = leads.map(l =>
      cols.map(c => {
        if (c === 'customer_name') return `"${(l.customers?.name || '').replace(/"/g, '""')}"`;
        const v = getLeadFieldValue(l, c);
        return `"${String(v).replace(/"/g, '""')}"`;
      }).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `leads-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleQuickStatus = async (id: string, newStatus: string) => {
    await adminFetch('/api/admin/leads', { method: 'PUT', body: JSON.stringify({ id, status: newStatus }) });
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l));
  };
  const handleDeleteSingle = async (id: string, name: string) => {
    if (!confirm(`Lead "${name}" verwijderen?`)) return;
    await adminFetch('/api/admin/leads', { method: 'DELETE', body: JSON.stringify({ ids: [id] }) });
    fetchLeads();
  };

  const [enriching, setEnriching] = useState(false);
  const [enrichResult, setEnrichResult] = useState<{ enriched: number; total: number } | null>(null);

  const handleEnrichAll = async () => {
    setEnriching(true);
    setEnrichResult(null);
    try {
      const res = await adminFetch('/api/admin/leads/enrich', { method: 'POST' });
      if (res.ok) {
        const d = await res.json();
        setEnrichResult(d);
        if (d.enriched > 0) fetchLeads();
      }
    } finally {
      setEnriching(false);
    }
  };

  const getBranchBadge = (slug: string) => {
    const b = branchMap[slug];
    const c = COLOR_MAP[b?.color || 'slate'] || COLOR_MAP.slate;
    return { name: b?.name || slug, light: c.light, text: c.text };
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Leads CRM</h1>
          <p className="mt-0.5 text-sm text-slate-500">{total} lead{total !== 1 ? 's' : ''} totaal</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleEnrichAll} disabled={enriching} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50">
            {enriching ? (
              <><span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-purple" /> Verrijken...</>
            ) : (
              <><MapPinIcon className="h-4 w-4" /> Adressen aanvullen</>
            )}
          </button>
          <button onClick={handleExport} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
            <ArrowDownTrayIcon className="h-4 w-4" /> Export CSV
          </button>
          <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-button-gradient px-3.5 py-2 text-sm font-bold text-white shadow-sm">
            <PlusIcon className="h-4 w-4" /> Nieuwe lead
          </button>
        </div>
      </div>

      <AnimatePresence>
        {enrichResult && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mb-4 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-sm text-emerald-700">
                {enrichResult.enriched > 0 ? (
                  <><strong>{enrichResult.enriched}</strong> van {enrichResult.total} leads verrijkt met plaatsnaam/provincie</>
                ) : enrichResult.total === 0 ? (
                  <>Alle leads hebben al een plaatsnaam en provincie</>
                ) : (
                  <>Geen adressen gevonden voor {enrichResult.total} leads (onbekende postcodes?)</>
                )}
              </p>
              <button onClick={() => setEnrichResult(null)} className="ml-3 text-emerald-400 hover:text-emerald-600"><XMarkIcon className="h-4 w-4" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <select value={branch} onChange={e => setBranch(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
          <option value="all">Alle branches</option>
          {branches.filter(b => b.is_active).map(b => <option key={b.slug} value={b.slug}>{b.name}</option>)}
        </select>
        <select value={customerId} onChange={e => setCustomerId(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
          <option value="all">Alle klanten</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
          <option value="all">Alle statussen</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <select value={province} onChange={e => setProvince(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
          <option value="all">Alle provincies</option>
          <optgroup label="Nederland">{PROVINCES_NL.map(p => <option key={p} value={p}>{p}</option>)}</optgroup>
          <optgroup label="België">{PROVINCES_BE.map(p => <option key={p} value={p}>{p}</option>)}</optgroup>
        </select>
        <select value={source} onChange={e => setSource(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
          <option value="all">Alle bronnen</option>
          <option value="handmatig">Handmatig</option>
          <option value="excel_import">Excel import</option>
          <option value="zapier">Zapier</option>
        </select>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:max-w-xs">
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700" />
      </div>

      <div className="relative mb-4">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Zoek op naam, email, telefoon of postcode..."
          className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-700 outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/30" />
      </div>

      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-brand-purple/20 bg-brand-purple/5 px-4 py-3">
              <span className="text-sm font-medium text-brand-purple">{selected.size} geselecteerd</span>
              <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm">
                <option value="">Status wijzigen...</option>
                {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
              {bulkStatus && <button onClick={handleBulkStatus} className="rounded-lg bg-brand-purple px-3 py-1.5 text-sm font-medium text-white">Toepassen</button>}
              <button onClick={handleBulkDelete} className="rounded-lg bg-red-500 px-3 py-1.5 text-sm font-medium text-white">Verwijderen</button>
              <button onClick={() => setSelected(new Set())} className="ml-auto text-sm text-slate-500 hover:text-slate-700">Deselecteren</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop Table */}
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                <th className="w-10 px-3 py-3"><input type="checkbox" checked={selected.size === leads.length && leads.length > 0} onChange={toggleAll} className="h-4 w-4 rounded border-slate-300" /></th>
                {branch === 'all' && (
                  <th className="cursor-pointer px-3 py-3 text-xs font-semibold text-slate-500 hover:text-slate-700" onClick={() => toggleSort('branch')}>
                    <span className="inline-flex items-center gap-1">Branche <ChevronUpDownIcon className="h-3 w-3" /></span>
                  </th>
                )}
                <th className="px-3 py-3 text-xs font-semibold text-slate-500">Klant</th>
                {visibleCols.map(col => (
                  <th key={col} className="cursor-pointer whitespace-nowrap px-3 py-3 text-xs font-semibold text-slate-500 hover:text-slate-700" onClick={() => toggleSort(col)}>
                    <span className="inline-flex items-center gap-1">
                      {fieldLabels[col] || col}
                      {sortBy === col && <span className="text-brand-purple">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                    </span>
                  </th>
                ))}
                <th className="w-20 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={99} className="px-3 py-12 text-center text-sm text-slate-400">Laden...</td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={99} className="px-3 py-12 text-center text-sm text-slate-400">Geen leads gevonden</td></tr>
              ) : leads.map(lead => {
                const badge = getBranchBadge(lead.branch);
                return (
                  <tr key={lead.id} className="border-b border-slate-50 transition hover:bg-slate-50/50">
                    <td className="px-3 py-2.5"><input type="checkbox" checked={selected.has(lead.id)} onChange={() => toggleSelect(lead.id)} className="h-4 w-4 rounded border-slate-300" /></td>
                    {branch === 'all' && (
                      <td className="px-3 py-2.5">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.light} ${badge.text}`}>{badge.name}</span>
                      </td>
                    )}
                    <td className="px-3 py-2.5 text-xs text-slate-500">
                      <div>{lead.customers?.name || '—'}</div>
                      {(lead as any).assignment_count > 0 && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-600" title={(lead as any).assigned_customers?.join(', ')}>
                          {(lead as any).assignment_count}x toegewezen
                        </span>
                      )}
                    </td>
                    {visibleCols.map(col => (
                      <td key={col} className="whitespace-nowrap px-3 py-2.5 text-sm text-slate-700">
                        {col === 'status' ? (
                          <select value={lead.status} onChange={e => handleQuickStatus(lead.id, e.target.value)}
                            className={`rounded-full border-0 px-2.5 py-0.5 text-[11px] font-medium ${STATUS_COLORS[lead.status] || 'bg-slate-100 text-slate-600'}`}>
                            {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                          </select>
                        ) : (
                          <span className="block max-w-[160px] truncate">{getLeadFieldValue(lead, col) || '—'}</span>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setEditLead(lead)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><PencilSquareIcon className="h-4 w-4" /></button>
                        <button onClick={() => handleDeleteSingle(lead.id, lead.naam_klant)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"><TrashIcon className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="space-y-2 md:hidden">
        {loading ? (
          <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-brand-purple" /></div>
        ) : leads.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white py-12 text-center shadow-sm"><p className="text-sm text-slate-400">Geen leads gevonden</p></div>
        ) : leads.map(lead => {
          const badge = getBranchBadge(lead.branch);
          return (
            <div key={lead.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{lead.naam_klant || '—'}</p>
                  <p className="text-xs text-slate-500">
                    {lead.customers?.name || '—'}
                    {(lead as any).assignment_count > 0 && (
                      <span className="ml-1 text-[10px] text-purple-500">({(lead as any).assignment_count}x)</span>
                    )}
                  </p>
                </div>
                <select value={lead.status} onChange={e => handleQuickStatus(lead.id, e.target.value)}
                  className={`ml-2 shrink-0 rounded-full border-0 px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[lead.status] || 'bg-slate-100 text-slate-600'}`}>
                  {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.light} ${badge.text}`}>{badge.name}</span>
                {lead.plaatsnaam && <span>{lead.plaatsnaam}</span>}
                {lead.telefoonnummer && <span>{lead.telefoonnummer}</span>}
                {lead.wervingsdatum && <span>{lead.wervingsdatum}</span>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setEditLead(lead)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50">
                  <PencilSquareIcon className="h-3.5 w-3.5" /> Bewerken
                </button>
                <button onClick={() => handleDeleteSingle(lead.id, lead.naam_klant)} className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-400 transition hover:bg-red-50 hover:text-red-500">
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm md:mt-0 md:rounded-t-none md:border-t-0 md:shadow-none">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <select value={perPage} onChange={e => setPerPage(Number(e.target.value))} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm">
              {[25, 50, 100].map(n => <option key={n} value={n}>{n}/p</option>)}
            </select>
            <span className="text-xs">Pagina {page}/{totalPages}</span>
          </div>
          <div className="flex gap-1">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-30"><ChevronLeftIcon className="h-4 w-4" /></button>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-30"><ChevronRightIcon className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {(editLead || showNew) && (
          <LeadFormPanel
            lead={editLead}
            customers={customers}
            branches={branches}
            defaultBranch={branch !== 'all' ? branch : branches[0]?.slug || 'thuisbatterij'}
            onClose={() => { setEditLead(null); setShowNew(false); }}
            onSaved={() => { setEditLead(null); setShowNew(false); fetchLeads(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function LeadFormPanel({
  lead, customers, branches, defaultBranch, onClose, onSaved,
}: {
  lead: Lead | null; customers: Customer[]; branches: BranchConfig[]; defaultBranch: string; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!lead;
  const [formBranch, setFormBranch] = useState(lead?.branch || defaultBranch);
  const [form, setForm] = useState<Record<string, string>>(() => {
    if (lead) {
      const base: Record<string, string> = {
        customer_id: lead.customer_id || '',
        naam_klant: lead.naam_klant || '', email: lead.email || '', telefoonnummer: lead.telefoonnummer || '',
        postcode: lead.postcode || '', huisnummer: lead.huisnummer || '', plaatsnaam: lead.plaatsnaam || '',
        provincie: lead.provincie || '', wervingsdatum: lead.wervingsdatum || '', status: lead.status || 'nieuw',
        notities: lead.notities || '', bron: lead.bron || 'handmatig',
      };
      if (lead.custom_fields) Object.assign(base, lead.custom_fields);
      const branchConfig = branches.find(b => b.slug === lead.branch);
      if (branchConfig) {
        branchConfig.branch_fields.forEach(f => {
          if (!(f.key in base)) base[f.key] = (lead as Record<string, unknown>)[f.key] as string || '';
        });
      }
      return base;
    }
    return {
      customer_id: '', naam_klant: '', email: '', telefoonnummer: '', postcode: '', huisnummer: '',
      plaatsnaam: '', provincie: '', wervingsdatum: new Date().toISOString().split('T')[0],
      status: 'nieuw', notities: '', bron: 'handmatig',
    };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [addressLoading, setAddressLoading] = useState(false);
  const addressTimer = useRef<NodeJS.Timeout | null>(null);

  const branchConfig = branches.find(b => b.slug === formBranch);
  const branchFields = branchConfig?.branch_fields || [];

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  const lookupAddress = useCallback((postcode: string, huisnummer: string) => {
    if (addressTimer.current) clearTimeout(addressTimer.current);
    const clean = postcode.replace(/\s+/g, '').toUpperCase();
    const isNL = /^\d{4}[A-Z]{2}$/.test(clean);
    const isBE = /^\d{4}$/.test(clean) && parseInt(clean) >= 1000;
    if ((!isNL && !isBE) || !huisnummer) return;
    setAddressLoading(true);
    addressTimer.current = setTimeout(async () => {
      try {
        const res = await adminFetch(`/api/admin/address?postcode=${encodeURIComponent(clean)}&huisnummer=${encodeURIComponent(huisnummer)}`);
        if (res.ok) {
          const d = await res.json();
          if (d.plaatsnaam) setForm(f => ({ ...f, plaatsnaam: f.plaatsnaam || d.plaatsnaam, provincie: f.provincie || d.provincie }));
        }
      } finally { setAddressLoading(false); }
    }, 400);
  }, []);

  const handlePostcodeChange = (val: string) => {
    set('postcode', val);
    lookupAddress(val, form.huisnummer);
  };

  const handleHuisnummerChange = (val: string) => {
    set('huisnummer', val);
    lookupAddress(form.postcode, val);
  };

  const save = async () => {
    if (!form.naam_klant) { setError('Naam is verplicht'); return; }
    setSaving(true); setError('');
    try {
      const commonKeys = ['customer_id', 'naam_klant', 'email', 'telefoonnummer', 'postcode', 'huisnummer', 'plaatsnaam', 'provincie', 'wervingsdatum', 'status', 'notities', 'bron'];
      const payload: Record<string, unknown> = { branch: formBranch };
      commonKeys.forEach(k => { payload[k] = form[k] || ''; });
      if (!payload.customer_id) payload.customer_id = null;

      const cf: Record<string, string> = {};
      branchFields.forEach(f => { if (form[f.key]) cf[f.key] = form[f.key]; });
      payload.custom_fields = cf;

      if (isEdit) payload.id = lead!.id;
      const res = await adminFetch('/api/admin/leads', { method: isEdit ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Opslaan mislukt'); }
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Er ging iets mis');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!lead || !confirm('Deze lead verwijderen?')) return;
    await adminFetch('/api/admin/leads', { method: 'DELETE', body: JSON.stringify({ ids: [lead.id] }) });
    onSaved();
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed inset-y-0 right-0 z-[60] w-full max-w-lg overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">{isEdit ? 'Lead bewerken' : 'Nieuwe lead'}</h2>
          <div className="flex items-center gap-2">
            {isEdit && <button onClick={handleDelete} className="rounded-lg p-2 text-red-400 hover:bg-red-50 hover:text-red-600"><TrashIcon className="h-5 w-5" /></button>}
            <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><XMarkIcon className="h-5 w-5" /></button>
          </div>
        </div>
        <div className="space-y-5 p-5">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Branche</label>
              <select value={formBranch} onChange={e => setFormBranch(e.target.value)} disabled={isEdit}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-50">
                {branches.filter(b => b.is_active).map(b => <option key={b.slug} value={b.slug}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Klant (bedrijf)</label>
              <select value={form.customer_id} onChange={e => set('customer_id', e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900">
                <option value="">— Selecteer —</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Contactgegevens</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-500">Naam klant *</label>
                <input value={form.naam_klant || ''} onChange={e => set('naam_klant', e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">E-mail</label>
                <input value={form.email || ''} onChange={e => set('email', e.target.value)} type="email"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Telefoon</label>
                <input value={form.telefoonnummer || ''} onChange={e => set('telefoonnummer', e.target.value)} type="tel"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Postcode</label>
                <input value={form.postcode || ''} onChange={e => handlePostcodeChange(e.target.value)} placeholder="1234AB"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Huisnr.</label>
                <input value={form.huisnummer || ''} onChange={e => handleHuisnummerChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
              </div>
              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  Plaats
                  {addressLoading && <span className="inline-block h-3 w-3 animate-spin rounded-full border-[2px] border-slate-200 border-t-brand-purple" />}
                </label>
                <input value={form.plaatsnaam || ''} onChange={e => set('plaatsnaam', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Provincie</label>
                <select value={form.provincie || ''} onChange={e => set('provincie', e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900">
                  <option value="">— Selecteer —</option>
                  <optgroup label="Nederland">{PROVINCES_NL.map(p => <option key={p} value={p}>{p}</option>)}</optgroup>
                  <optgroup label="België">{PROVINCES_BE.map(p => <option key={p} value={p}>{p}</option>)}</optgroup>
                </select>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Status & metadata</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
                <select value={form.status || 'nieuw'} onChange={e => set('status', e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900">
                  {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Datum</label>
                <input type="date" value={form.wervingsdatum || ''} onChange={e => set('wervingsdatum', e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
              </div>
            </div>
            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-slate-500">Notities</label>
              <textarea value={form.notities || ''} onChange={e => set('notities', e.target.value)} rows={3} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
            </div>
          </div>
          {branchFields.length > 0 && (
            <div className="border-t border-slate-100 pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{branchConfig?.name} details</p>
              <div className="grid grid-cols-2 gap-3">
                {branchFields.map(f => (
                  <div key={f.key}>
                    <label className="mb-1 block text-xs font-medium text-slate-500">{f.label}{f.is_required ? ' *' : ''}</label>
                    {f.field_type === 'textarea' ? (
                      <textarea value={form[f.key] || ''} onChange={e => set(f.key, e.target.value)} rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
                    ) : f.field_type === 'select' ? (
                      <select value={form[f.key] || ''} onChange={e => set(f.key, e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900">
                        <option value="">— Selecteer —</option>
                        {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : f.field_type === 'boolean' ? (
                      <select value={form[f.key] || ''} onChange={e => set(f.key, e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900">
                        <option value="">— Selecteer —</option>
                        <option value="Ja">Ja</option>
                        <option value="Nee">Nee</option>
                      </select>
                    ) : (
                      <input type={f.field_type === 'number' ? 'number' : 'text'} value={form[f.key] || ''} onChange={e => set(f.key, e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="sticky bottom-0 border-t border-slate-100 bg-white px-5 py-4">
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Annuleren</button>
            <button onClick={save} disabled={saving} className="flex-1 rounded-lg bg-button-gradient py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-60">
              {saving ? 'Opslaan...' : isEdit ? 'Bijwerken' : 'Aanmaken'}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
