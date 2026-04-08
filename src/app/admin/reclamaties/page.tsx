'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FlagIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  XMarkIcon,
  ArrowPathIcon,
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
  UserIcon,
  ChatBubbleLeftEllipsisIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';

interface Reclamation {
  id: string;
  customer_id: string;
  lead_id: string;
  reason: string;
  description: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  customers: { name: string; email: string } | null;
  leads: {
    naam_klant: string;
    telefoonnummer: string;
    email: string;
    postcode: string;
    plaatsnaam: string;
    provincie: string;
    branch: string;
  } | null;
}

const REASON_LABELS: Record<string, string> = {
  foutief_telefoonnummer: 'Foutief telefoonnummer',
  dubbele_lead: 'Dubbele lead binnen 30 dagen',
  buiten_doelgebied: 'Buiten afgesproken gebied',
};

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: typeof ClockIcon }> = {
  pending: { label: 'Openstaand', cls: 'bg-amber-50 text-amber-700', icon: ClockIcon },
  approved: { label: 'Goedgekeurd', cls: 'bg-emerald-50 text-emerald-700', icon: CheckCircleIcon },
  rejected: { label: 'Afgewezen', cls: 'bg-red-50 text-red-700', icon: XCircleIcon },
};

export default function AdminReclamatiesPage() {
  const [reclamations, setReclamations] = useState<Reclamation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [selected, setSelected] = useState<Reclamation | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [saving, setSaving] = useState<'approved' | 'rejected' | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchReclamations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/admin/reclamations');
      if (res.ok) {
        const data = await res.json();
        setReclamations(Array.isArray(data) ? data : []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchReclamations(); }, [fetchReclamations]);

  const filtered = useMemo(() => {
    let list = reclamations;
    if (statusFilter !== 'all') list = list.filter(r => r.status === statusFilter);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(r => {
        const custName = r.customers?.name?.toLowerCase() || '';
        const leadName = r.leads?.naam_klant?.toLowerCase() || '';
        const leadPhone = r.leads?.telefoonnummer || '';
        return custName.includes(s) || leadName.includes(s) || leadPhone.includes(s) || (r.reason || '').includes(s);
      });
    }
    return list;
  }, [reclamations, statusFilter, search]);

  const counts = useMemo(() => ({
    pending: reclamations.filter(r => r.status === 'pending').length,
    approved: reclamations.filter(r => r.status === 'approved').length,
    rejected: reclamations.filter(r => r.status === 'rejected').length,
  }), [reclamations]);

  const handleResolve = async (status: 'approved' | 'rejected') => {
    if (!selected) return;
    setSaving(status);
    try {
      const res = await adminFetch('/api/admin/reclamations', {
        method: 'PUT',
        body: JSON.stringify({ id: selected.id, status, admin_notes: adminNotes }),
      });
      if (res.ok) {
        const updated = await res.json();
        setReclamations(prev => prev.map(r => r.id === updated.id ? updated : r));
        setSelected(null);
        setAdminNotes('');
        if (status === 'approved') {
          const msg = updated.batch_reactivated
            ? 'Reclamatie goedgekeurd — +1 compensatie lead, batch geheractiveerd'
            : updated.batch_updated
              ? 'Reclamatie goedgekeurd — +1 compensatie lead toegevoegd aan batch'
              : 'Reclamatie goedgekeurd (geen batch gevonden)';
          showToast(msg);
        } else {
          showToast('Reclamatie afgewezen');
        }
      } else {
        const d = await res.json();
        showToast(d.error || 'Opslaan mislukt', 'error');
      }
    } catch {
      showToast('Er ging iets mis', 'error');
    }
    setSaving(null);
  };

  const openDetail = (r: Reclamation) => {
    setSelected(r);
    setAdminNotes(r.admin_notes || '');
  };

  useEffect(() => {
    document.body.style.overflow = selected ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [selected]);

  return (
    <div className="space-y-6">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-xl px-5 py-3 text-sm font-medium text-white shadow-xl max-w-[90vw] text-center ${
              toast.type === 'error' ? 'bg-red-600' : 'bg-slate-900'
            }`}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <FlagIcon className="h-7 w-7 text-brand-purple" />
            Reclamaties
          </h1>
          <p className="mt-1 text-sm text-slate-500">{reclamations.length} totaal &middot; {counts.pending} openstaand</p>
        </div>
        <button onClick={fetchReclamations} disabled={loading} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">
          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Vernieuwen
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { key: 'pending', label: 'Openstaand', color: 'border-amber-200 bg-amber-50', text: 'text-amber-700', icon: ClockIcon },
          { key: 'approved', label: 'Goedgekeurd', color: 'border-emerald-200 bg-emerald-50', text: 'text-emerald-700', icon: CheckCircleIcon },
          { key: 'rejected', label: 'Afgewezen', color: 'border-red-200 bg-red-50', text: 'text-red-700', icon: XCircleIcon },
        ].map(kpi => (
          <button
            key={kpi.key}
            onClick={() => setStatusFilter(statusFilter === kpi.key ? 'all' : kpi.key)}
            className={`rounded-xl border p-2.5 sm:p-3 text-left transition hover:shadow-sm ${
              statusFilter === kpi.key ? kpi.color : 'border-slate-200 bg-white'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className={`text-[10px] sm:text-xs font-medium ${statusFilter === kpi.key ? kpi.text : 'text-slate-500'}`}>{kpi.label}</p>
              <kpi.icon className={`hidden sm:block h-4 w-4 ${statusFilter === kpi.key ? kpi.text : 'text-slate-300'}`} />
            </div>
            <p className={`mt-1 text-xl sm:text-2xl font-bold ${statusFilter === kpi.key ? kpi.text : 'text-slate-900'}`}>
              {counts[kpi.key as keyof typeof counts]}
            </p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Zoek op klant, lead of telefoonnummer..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-brand-purple/50 focus:ring-2 focus:ring-brand-purple/20"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center">
          <FlagIcon className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-400">Geen reclamaties gevonden</p>
          <p className="mt-1 text-xs text-slate-300">
            {statusFilter !== 'all' ? 'Probeer een ander filter' : 'Er zijn nog geen reclamaties ingediend'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Datum</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Klant</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Lead</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Reden</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Actie</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(r => {
                  const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
                  return (
                    <tr key={r.id} className="transition hover:bg-slate-50/50 cursor-pointer" onClick={() => openDetail(r)}>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(r.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900 truncate max-w-[140px]">{r.customers?.name || '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-700 truncate max-w-[140px]">{r.leads?.naam_klant || '—'}</p>
                        <p className="text-xs text-slate-400">{r.leads?.telefoonnummer}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          {REASON_LABELS[r.reason] || r.reason}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${sc.cls}`}>
                          <sc.icon className="h-3 w-3" />
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.status === 'pending' ? (
                          <span className="text-xs font-medium text-brand-purple">Beoordelen &rarr;</span>
                        ) : (
                          <span className="text-xs text-slate-400">Bekijken &rarr;</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-2.5 md:hidden">
            {filtered.map(r => {
              const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
              return (
                <button
                  key={r.id}
                  onClick={() => openDetail(r)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${sc.cls}`}>
                          <sc.icon className="h-3 w-3" />
                          {sc.label}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                          {REASON_LABELS[r.reason] || r.reason}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-900">{r.customers?.name || '—'}</p>
                      <p className="text-xs text-slate-500">{r.leads?.naam_klant} &middot; {r.leads?.telefoonnummer}</p>
                    </div>
                    <p className="shrink-0 text-[10px] text-slate-400">
                      {new Date(r.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  {r.description && (
                    <p className="mt-2 line-clamp-2 text-xs text-slate-400">{r.description}</p>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Detail slide-over */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
              onClick={() => { setSelected(null); setAdminNotes(''); }}
            />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed inset-y-0 right-0 z-[60] flex w-full flex-col bg-white shadow-2xl sm:max-w-md"
            >
              <div className="shrink-0 border-b border-slate-100">
                <div className="h-[3px] bg-warmeleads-gradient" />
                <div className="flex items-center justify-between px-5 py-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      {selected.status === 'pending' ? 'Reclamatie beoordelen' : 'Reclamatie details'}
                    </h2>
                    <p className="text-xs text-slate-400">{selected.customers?.name}</p>
                  </div>
                  <button onClick={() => { setSelected(null); setAdminNotes(''); }} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600">
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
                {/* Status */}
                {(() => {
                  const sc = STATUS_CONFIG[selected.status] || STATUS_CONFIG.pending;
                  return (
                    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                      selected.status === 'pending' ? 'border-amber-200 bg-amber-50' :
                      selected.status === 'approved' ? 'border-emerald-200 bg-emerald-50' :
                      'border-red-200 bg-red-50'
                    }`}>
                      <sc.icon className={`h-4 w-4 ${
                        selected.status === 'pending' ? 'text-amber-600' :
                        selected.status === 'approved' ? 'text-emerald-600' :
                        'text-red-600'
                      }`} />
                      <span className={`text-sm font-medium ${
                        selected.status === 'pending' ? 'text-amber-700' :
                        selected.status === 'approved' ? 'text-emerald-700' :
                        'text-red-700'
                      }`}>{sc.label}</span>
                      {selected.resolved_at && (
                        <span className="ml-auto text-xs opacity-60">
                          {new Date(selected.resolved_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                  );
                })()}

                {/* Reclamatie details */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Reclamatie</h3>
                  <div>
                    <p className="text-xs text-slate-500">Reden</p>
                    <p className="text-sm font-medium text-slate-900">{REASON_LABELS[selected.reason] || selected.reason}</p>
                  </div>
                  {selected.description && (
                    <div>
                      <p className="text-xs text-slate-500">Toelichting klant</p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{selected.description}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-slate-500">Ingediend op</p>
                    <p className="text-sm text-slate-700">
                      {new Date(selected.created_at).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      {' om '}
                      {new Date(selected.created_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                {/* Lead info */}
                {selected.leads && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Lead informatie</h3>
                    <div className="space-y-2">
                      {[
                        { icon: UserIcon, label: selected.leads.naam_klant },
                        { icon: PhoneIcon, label: selected.leads.telefoonnummer },
                        { icon: EnvelopeIcon, label: selected.leads.email },
                        { icon: MapPinIcon, label: [selected.leads.postcode, selected.leads.plaatsnaam, selected.leads.provincie].filter(Boolean).join(', ') },
                      ].filter(item => item.label).map((item, i) => (
                        <div key={i} className="flex items-center gap-2.5">
                          <item.icon className="h-4 w-4 shrink-0 text-slate-400" />
                          <p className="text-sm text-slate-700">{item.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Klant info */}
                {selected.customers && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Klant</h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2.5">
                        <UserIcon className="h-4 w-4 shrink-0 text-slate-400" />
                        <p className="text-sm font-medium text-slate-700">{selected.customers.name}</p>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <EnvelopeIcon className="h-4 w-4 shrink-0 text-slate-400" />
                        <p className="text-sm text-slate-700">{selected.customers.email}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Admin notes */}
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                    <ChatBubbleLeftEllipsisIcon className="h-3.5 w-3.5" />
                    Admin notities
                  </label>
                  <textarea
                    value={adminNotes}
                    onChange={e => setAdminNotes(e.target.value)}
                    disabled={selected.status !== 'pending'}
                    placeholder={selected.status === 'pending' ? 'Optioneel: voeg een notitie toe...' : ''}
                    rows={3}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-purple/50 focus:ring-2 focus:ring-brand-purple/20 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
              </div>

              {/* Action buttons */}
              {selected.status === 'pending' && (
                <div className="shrink-0 border-t border-slate-100 px-5 py-4 space-y-3">
                  <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
                    <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                    <p className="text-xs text-blue-700">Bij goedkeuring wordt automatisch +1 compensatie lead toegevoegd aan de bijbehorende batch. Als de batch al voltooid is, wordt deze geheractiveerd.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleResolve('rejected')}
                      disabled={saving !== null}
                      className="flex items-center justify-center gap-2 rounded-lg border-2 border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                    >
                      {saving === 'rejected' ? (
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-red-300 border-t-red-600" />
                      ) : (
                        <XCircleIcon className="h-4 w-4" />
                      )}
                      Afwijzen
                    </button>
                    <button
                      onClick={() => handleResolve('approved')}
                      disabled={saving !== null}
                      className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {saving === 'approved' ? (
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-emerald-300 border-t-white" />
                      ) : (
                        <CheckCircleIcon className="h-4 w-4" />
                      )}
                      Goedkeuren
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
