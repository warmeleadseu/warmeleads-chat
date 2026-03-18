'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpDownIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';

interface Customer { id: string; name: string; }
interface Lead {
  id: string; branch: string; customer_id: string | null; customers?: { id: string; name: string } | null;
  naam_klant: string; email: string; telefoonnummer: string; postcode: string; huisnummer: string;
  plaatsnaam: string; provincie: string; wervingsdatum: string; status: string; notities: string; bron: string;
  zonnepanelen?: string; dynamisch_contract?: string; stroomverbruik?: string; budget?: string; reden_thuisbatterij?: string;
  type_airco?: string; koelen_verwarmen?: string; hoeveel_ruimtes?: string; zakelijk?: string; koop_of_huur?: string; boorwerkzaamheden_toegestaan?: string;
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
const PROVINCES = ['Drenthe','Flevoland','Friesland','Gelderland','Groningen','Limburg','Noord-Brabant','Noord-Holland','Overijssel','Utrecht','Zeeland','Zuid-Holland'];

const COMMON_FIELDS = ['naam_klant','email','telefoonnummer','postcode','huisnummer','plaatsnaam','provincie','wervingsdatum','status','notities','bron'] as const;
const THUISBATTERIJ_FIELDS = ['zonnepanelen','dynamisch_contract','stroomverbruik','budget','reden_thuisbatterij'] as const;
const AIRCO_FIELDS = ['type_airco','koelen_verwarmen','hoeveel_ruimtes','zakelijk','koop_of_huur','boorwerkzaamheden_toegestaan'] as const;

const FIELD_LABELS: Record<string, string> = {
  naam_klant: 'Naam', email: 'E-mail', telefoonnummer: 'Telefoon', postcode: 'Postcode',
  huisnummer: 'Huisnr.', plaatsnaam: 'Plaats', provincie: 'Provincie', wervingsdatum: 'Datum',
  status: 'Status', notities: 'Notities', bron: 'Bron', zonnepanelen: 'Zonnepanelen',
  dynamisch_contract: 'Dyn. contract', stroomverbruik: 'Stroomverbruik', budget: 'Budget',
  reden_thuisbatterij: 'Reden', type_airco: 'Type airco', koelen_verwarmen: 'Koelen/Verwarmen',
  hoeveel_ruimtes: 'Ruimtes', zakelijk: 'Zakelijk', koop_of_huur: 'Koop/Huur',
  boorwerkzaamheden_toegestaan: 'Boorwerk',
};

export default function LeadsCRMPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
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

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Modals
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('');

  const fetchCustomers = useCallback(async () => {
    const res = await adminFetch('/api/admin/customers');
    if (res.ok) { const d = await res.json(); setCustomers(d.customers || []); }
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
    if (res.ok) {
      const d = await res.json();
      setLeads(d.leads || []);
      setTotal(d.total || 0);
    }
    setLoading(false);
  }, [branch, customerId, status, province, source, dateFrom, dateTo, search, page, perPage, sortBy, sortDir]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);
  useEffect(() => { fetchLeads(); }, [fetchLeads]);
  useEffect(() => { setPage(1); }, [branch, customerId, status, province, source, dateFrom, dateTo, search, perPage]);

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };
  const toggleAll = () => {
    if (selected.size === leads.length) setSelected(new Set());
    else setSelected(new Set(leads.map(l => l.id)));
  };

  const handleBulkStatus = async () => {
    if (!bulkStatus || selected.size === 0) return;
    await Promise.all(
      Array.from(selected).map(id =>
        adminFetch('/api/admin/leads', { method: 'PUT', body: JSON.stringify({ id, status: bulkStatus }) })
      )
    );
    setSelected(new Set());
    setBulkStatus('');
    fetchLeads();
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0 || !confirm(`${selected.size} lead(s) verwijderen?`)) return;
    await adminFetch('/api/admin/leads', { method: 'DELETE', body: JSON.stringify({ ids: Array.from(selected) }) });
    setSelected(new Set());
    fetchLeads();
  };

  const handleExport = () => {
    const branchFields = branch === 'thuisbatterij' ? [...THUISBATTERIJ_FIELDS] : branch === 'airco' ? [...AIRCO_FIELDS] : [];
    const cols = ['branch', ...COMMON_FIELDS, ...branchFields, 'customer_name'];
    const header = cols.map(c => c === 'customer_name' ? 'Klant' : FIELD_LABELS[c] || c).join(',');
    const rows = leads.map(l =>
      cols.map(c => {
        if (c === 'customer_name') return `"${(l.customers?.name || '').replace(/"/g, '""')}"`;
        const v = (l as any)[c] ?? '';
        return `"${String(v).replace(/"/g, '""')}"`;
      }).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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

  const visibleCols = useMemo(() => {
    const base: string[] = ['naam_klant', 'email', 'telefoonnummer', 'postcode', 'plaatsnaam', 'status', 'wervingsdatum'];
    if (branch === 'thuisbatterij') base.push('zonnepanelen', 'budget', 'reden_thuisbatterij');
    else if (branch === 'airco') base.push('type_airco', 'koelen_verwarmen', 'hoeveel_ruimtes');
    return base;
  }, [branch]);

  const totalPages = Math.ceil(total / perPage);

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Leads CRM</h1>
          <p className="mt-0.5 text-sm text-slate-500">{total} lead{total !== 1 ? 's' : ''} totaal</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
            <ArrowDownTrayIcon className="h-4 w-4" /> Export CSV
          </button>
          <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-button-gradient px-3.5 py-2 text-sm font-bold text-white shadow-sm">
            <PlusIcon className="h-4 w-4" /> Nieuwe lead
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
        <select value={branch} onChange={e => setBranch(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          <option value="all">Alle branches</option>
          <option value="thuisbatterij">Thuisbatterij</option>
          <option value="airco">Airco</option>
        </select>
        <select value={customerId} onChange={e => setCustomerId(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          <option value="all">Alle klanten</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          <option value="all">Alle statussen</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <select value={province} onChange={e => setProvince(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          <option value="all">Alle provincies</option>
          {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={source} onChange={e => setSource(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          <option value="all">Alle bronnen</option>
          <option value="handmatig">Handmatig</option>
          <option value="excel_import">Excel import</option>
          <option value="zapier">Zapier</option>
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700" placeholder="Van" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700" placeholder="Tot" />
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Zoek op naam, email, telefoon of postcode..."
          className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-700 outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/30"
        />
      </div>

      {/* Bulk actions */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-brand-purple/20 bg-brand-purple/5 px-4 py-2.5">
              <span className="text-sm font-medium text-brand-purple">{selected.size} geselecteerd</span>
              <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)} className="rounded border border-slate-200 bg-white px-2 py-1 text-xs">
                <option value="">Status wijzigen...</option>
                {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
              {bulkStatus && (
                <button onClick={handleBulkStatus} className="rounded bg-brand-purple px-2.5 py-1 text-xs font-medium text-white">Toepassen</button>
              )}
              <button onClick={handleBulkDelete} className="rounded bg-red-500 px-2.5 py-1 text-xs font-medium text-white">Verwijderen</button>
              <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-slate-500 hover:text-slate-700">Deselecteren</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                <th className="w-10 px-3 py-3">
                  <input type="checkbox" checked={selected.size === leads.length && leads.length > 0} onChange={toggleAll} className="h-3.5 w-3.5 rounded border-slate-300" />
                </th>
                {branch === 'all' && (
                  <th className="cursor-pointer px-3 py-3 text-xs font-semibold text-slate-500 hover:text-slate-700" onClick={() => toggleSort('branch')}>
                    <span className="inline-flex items-center gap-1">Branche <ChevronUpDownIcon className="h-3 w-3" /></span>
                  </th>
                )}
                <th className="px-3 py-3 text-xs font-semibold text-slate-500">Klant</th>
                {visibleCols.map(col => (
                  <th key={col} className="cursor-pointer whitespace-nowrap px-3 py-3 text-xs font-semibold text-slate-500 hover:text-slate-700" onClick={() => toggleSort(col)}>
                    <span className="inline-flex items-center gap-1">
                      {FIELD_LABELS[col] || col}
                      {sortBy === col && <span className="text-brand-purple">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                    </span>
                  </th>
                ))}
                <th className="w-16 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={99} className="px-3 py-12 text-center text-sm text-slate-400">Laden...</td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={99} className="px-3 py-12 text-center text-sm text-slate-400">Geen leads gevonden</td></tr>
              ) : leads.map(lead => (
                <tr key={lead.id} className="border-b border-slate-50 transition hover:bg-slate-50/50">
                  <td className="px-3 py-2.5">
                    <input type="checkbox" checked={selected.has(lead.id)} onChange={() => toggleSelect(lead.id)} className="h-3.5 w-3.5 rounded border-slate-300" />
                  </td>
                  {branch === 'all' && (
                    <td className="px-3 py-2.5">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${lead.branch === 'thuisbatterij' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'}`}>
                        {lead.branch === 'thuisbatterij' ? 'Batterij' : 'Airco'}
                      </span>
                    </td>
                  )}
                  <td className="px-3 py-2.5 text-xs text-slate-500">{lead.customers?.name || '—'}</td>
                  {visibleCols.map(col => (
                    <td key={col} className="whitespace-nowrap px-3 py-2.5 text-sm text-slate-700">
                      {col === 'status' ? (
                        <select
                          value={lead.status}
                          onChange={e => handleQuickStatus(lead.id, e.target.value)}
                          className={`rounded-full border-0 px-2.5 py-0.5 text-[11px] font-medium ${STATUS_COLORS[lead.status] || 'bg-slate-100 text-slate-600'}`}
                        >
                          {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                        </select>
                      ) : (
                        <span className="max-w-[160px] truncate block">{(lead as any)[col] || '—'}</span>
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => setEditLead(lead)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Bewerken">
                        <PencilSquareIcon className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDeleteSingle(lead.id, lead.naam_klant)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500" title="Verwijderen">
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <select value={perPage} onChange={e => setPerPage(Number(e.target.value))} className="rounded border border-slate-200 bg-white px-2 py-1 text-xs">
                {[25, 50, 100].map(n => <option key={n} value={n}>{n} per pagina</option>)}
              </select>
              <span>Pagina {page} van {totalPages}</span>
            </div>
            <div className="flex gap-1">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30">
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30">
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit / New Lead Panel */}
      <AnimatePresence>
        {(editLead || showNew) && (
          <LeadFormPanel
            lead={editLead}
            customers={customers}
            defaultBranch={branch !== 'all' ? branch : 'thuisbatterij'}
            onClose={() => { setEditLead(null); setShowNew(false); }}
            onSaved={() => { setEditLead(null); setShowNew(false); fetchLeads(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function LeadFormPanel({
  lead, customers, defaultBranch, onClose, onSaved,
}: {
  lead: Lead | null; customers: Customer[]; defaultBranch: string; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!lead;
  const [form, setForm] = useState(() => {
    if (lead) return { ...lead, customer_id: lead.customer_id || '' };
    return {
      branch: defaultBranch, customer_id: '', naam_klant: '', email: '', telefoonnummer: '', postcode: '',
      huisnummer: '', plaatsnaam: '', provincie: '', wervingsdatum: new Date().toISOString().split('T')[0],
      status: 'nieuw', notities: '', bron: 'handmatig',
      zonnepanelen: '', dynamisch_contract: '', stroomverbruik: '', budget: '', reden_thuisbatterij: '',
      type_airco: '', koelen_verwarmen: '', hoeveel_ruimtes: '', zakelijk: '', koop_of_huur: '', boorwerkzaamheden_toegestaan: '',
    };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  const save = async () => {
    if (!form.naam_klant) { setError('Naam is verplicht'); return; }
    setSaving(true);
    setError('');
    try {
      const body = isEdit ? { id: lead!.id, ...form } : form;
      const res = await adminFetch('/api/admin/leads', {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Opslaan mislukt'); }
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!lead || !confirm('Deze lead verwijderen?')) return;
    await adminFetch('/api/admin/leads', { method: 'DELETE', body: JSON.stringify({ ids: [lead.id] }) });
    onSaved();
  };

  const branchFields = form.branch === 'thuisbatterij' ? THUISBATTERIJ_FIELDS : form.branch === 'airco' ? AIRCO_FIELDS : [];

  const Field = ({ label, field, type = 'text' }: { label: string; field: string; type?: string }) => (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
      {type === 'textarea' ? (
        <textarea value={(form as any)[field] || ''} onChange={e => set(field, e.target.value)} rows={3}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
      ) : (
        <input type={type} value={(form as any)[field] || ''} onChange={e => set(field, e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
      )}
    </div>
  );

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed inset-y-0 right-0 z-[60] w-full max-w-lg overflow-y-auto bg-white shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">{isEdit ? 'Lead bewerken' : 'Nieuwe lead'}</h2>
          <div className="flex items-center gap-2">
            {isEdit && (
              <button onClick={handleDelete} className="rounded-lg p-2 text-red-400 hover:bg-red-50 hover:text-red-600">
                <TrashIcon className="h-4.5 w-4.5" />
              </button>
            )}
            <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><XMarkIcon className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="space-y-5 p-5">
          {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-600">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Branche</label>
              <select value={form.branch} onChange={e => set('branch', e.target.value)} disabled={isEdit}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-50">
                <option value="thuisbatterij">Thuisbatterij</option>
                <option value="airco">Airco</option>
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
              <div className="col-span-2"><Field label="Naam klant *" field="naam_klant" /></div>
              <Field label="E-mail" field="email" type="email" />
              <Field label="Telefoon" field="telefoonnummer" type="tel" />
              <Field label="Postcode" field="postcode" />
              <Field label="Huisnummer" field="huisnummer" />
              <Field label="Plaatsnaam" field="plaatsnaam" />
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Provincie</label>
                <select value={form.provincie} onChange={e => set('provincie', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900">
                  <option value="">— Selecteer —</option>
                  {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Status & metadata</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
                <select value={form.status} onChange={e => set('status', e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900">
                  {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
              <Field label="Wervingsdatum" field="wervingsdatum" type="date" />
            </div>
            <div className="mt-3"><Field label="Notities" field="notities" type="textarea" /></div>
          </div>

          {branchFields.length > 0 && (
            <div className="border-t border-slate-100 pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                {form.branch === 'thuisbatterij' ? 'Thuisbatterij details' : 'Airco details'}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {branchFields.map(f => <Field key={f} label={FIELD_LABELS[f] || f} field={f} />)}
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
