'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  BuildingOfficeIcon,
  EyeIcon,
  UserGroupIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  ArrowTopRightOnSquareIcon,
  KeyIcon,
  ShieldCheckIcon,
  ShieldExclamationIcon,
  ArrowPathIcon,
  MapPinIcon,
  CurrencyEuroIcon,
  ChartBarIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';

interface Customer {
  id: string; name: string; contact_person: string; email: string; phone: string;
  branches: string[]; is_active: boolean; portal_active: boolean; has_password?: boolean; portal_password?: string | null; notes: string; created_at: string;
  lead_count?: number;
  company_name?: string;
}

interface BranchOption { slug: string; name: string; color: string; is_active: boolean; }

interface Target {
  id: string; customer_id: string; label: string; lat: number; lng: number;
  radius_km: number; is_active: boolean; created_at: string;
}

interface Batch {
  id: string; customer_id: string; branch: string; batch_size: number;
  price_per_lead: number | null; total_price: number | null;
  leads_delivered: number; status: string; notes: string | null;
  created_at: string; completed_at: string | null;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [branchOptions, setBranchOptions] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [resettingPw, setResettingPw] = useState<string | null>(null);
  const [newPw, setNewPw] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [togglingPortal, setTogglingPortal] = useState<string | null>(null);
  const [showPw, setShowPw] = useState<string | null>(null);
  const [targetsFor, setTargetsFor] = useState<Customer | null>(null);
  const [batchesFor, setBatchesFor] = useState<Customer | null>(null);

  const portalUrl = typeof window !== 'undefined' ? `${window.location.origin}/portal` : 'https://www.warmeleads.eu/portal';

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const res = await adminFetch('/api/admin/customers');
    if (res.ok) { const d = await res.json(); setCustomers(d.customers || []); }
    setLoading(false);
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  const fetchBranches = useCallback(async () => {
    const res = await adminFetch('/api/admin/branches');
    if (res.ok) { const d = await res.json(); setBranchOptions((d.branches || []).map((b: any) => ({ slug: b.slug, name: b.name, color: b.color, is_active: b.is_active }))); }
  }, []);
  useEffect(() => { fetchBranches(); }, [fetchBranches]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`${name} verwijderen? Leads van deze klant worden niet verwijderd.`)) return;
    await adminFetch('/api/admin/customers', { method: 'DELETE', body: JSON.stringify({ id }) });
    fetch_();
  };

  const copyCredentials = (c: Customer) => {
    const text = `Portaal login voor ${c.name}:\nURL: ${portalUrl}\nE-mail: ${c.email}\n\n(Wachtwoord is eerder door jullie gedeeld)`;
    navigator.clipboard.writeText(text);
    setCopied(c.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const resetPassword = async (customerId: string) => {
    if (!newPw || newPw.length < 6) return;
    setPwSaving(true);
    await adminFetch('/api/admin/customers', {
      method: 'PUT',
      body: JSON.stringify({ id: customerId, password: newPw }),
    });
    setPwSaving(false);
    setResettingPw(null);
    setNewPw('');
    fetch_();
  };

  const togglePortal = async (c: Customer) => {
    setTogglingPortal(c.id);
    await adminFetch('/api/admin/customers', {
      method: 'PUT',
      body: JSON.stringify({ id: c.id, portal_active: !c.portal_active }),
    });
    setTogglingPortal(null);
    fetch_();
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Klanten</h1>
          <p className="mt-0.5 text-sm text-slate-500">Bedrijven waarvoor we leads genereren</p>
        </div>
        <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-button-gradient px-3.5 py-2 text-sm font-bold text-white shadow-sm">
          <PlusIcon className="h-4 w-4" /> Nieuwe klant
        </button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <div className="h-5 w-32 animate-pulse rounded bg-slate-100" />
                  <div className="mt-1.5 h-3 w-20 animate-pulse rounded bg-slate-50" />
                </div>
                <div className="h-5 w-14 animate-pulse rounded-full bg-slate-100" />
              </div>
              <div className="mb-4 space-y-1">
                <div className="h-3 w-40 animate-pulse rounded bg-slate-50" />
                <div className="h-3 w-28 animate-pulse rounded bg-slate-50" />
              </div>
              <div className="h-36 w-full animate-pulse rounded-lg bg-slate-100" />
            </div>
          ))}
        </div>
      ) : customers.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center shadow-sm">
          <BuildingOfficeIcon className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm text-slate-500">Nog geen klanten. Voeg je eerste klant toe.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {customers.map(c => {
            const portalReady = c.portal_active && c.has_password && c.email;
            return (
              <div key={c.id} className="rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
                <div className="p-5">
                  {/* Header */}
                  <div className="mb-3 flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-slate-900">{c.name}</h3>
                      {c.contact_person && <p className="text-xs text-slate-500">{c.contact_person}</p>}
                    </div>
                    <span className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${c.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {c.is_active ? 'Actief' : 'Inactief'}
                    </span>
                  </div>

                  {/* Contact */}
                  {c.email && <p className="mb-0.5 text-xs text-slate-500">{c.email}</p>}
                  {c.phone && <p className="mb-2 text-xs text-slate-500">{c.phone}</p>}

                  {/* Branches + leads */}
                  <div className="mb-4 flex flex-wrap items-center gap-1.5">
                    {c.branches?.map(bSlug => {
                      const bo = branchOptions.find(x => x.slug === bSlug);
                      const colorMap: Record<string, string> = {
                        emerald: 'bg-emerald-50 text-emerald-600', sky: 'bg-sky-50 text-sky-600', amber: 'bg-amber-50 text-amber-600',
                        purple: 'bg-purple-50 text-purple-600', rose: 'bg-rose-50 text-rose-600', cyan: 'bg-cyan-50 text-cyan-600',
                        lime: 'bg-lime-50 text-lime-600', indigo: 'bg-indigo-50 text-indigo-600', teal: 'bg-teal-50 text-teal-600',
                        slate: 'bg-slate-50 text-slate-600',
                      };
                      return (
                        <span key={bSlug} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${colorMap[bo?.color || 'slate'] || colorMap.slate}`}>
                          {bo?.name || bSlug}
                        </span>
                      );
                    })}
                    {typeof c.lead_count === 'number' && (
                      <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        <UserGroupIcon className="h-3 w-3" /> {c.lead_count} leads
                      </span>
                    )}
                  </div>

                  {/* Portal section */}
                  <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3.5">
                    <div className="mb-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {portalReady ? (
                          <ShieldCheckIcon className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <ShieldExclamationIcon className="h-4 w-4 text-amber-500" />
                        )}
                        <span className="text-xs font-semibold text-slate-700">Klantportaal</span>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        portalReady ? 'bg-emerald-100 text-emerald-700' : c.portal_active ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {portalReady ? 'Gereed' : c.portal_active ? 'Incompleet' : 'Uit'}
                      </span>
                    </div>

                    {/* Login info */}
                    <div className="mb-3 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-400">URL</span>
                        <span className="truncate font-mono text-slate-600">{portalUrl.replace('https://', '')}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-400">E-mail</span>
                        <span className="truncate font-medium text-slate-600">{c.email || <span className="italic text-amber-500">niet ingesteld</span>}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-400">Wachtwoord</span>
                        {c.has_password ? (
                          c.portal_password ? (
                            <button
                              onClick={() => setShowPw(showPw === c.id ? null : c.id)}
                              className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-slate-600 transition hover:bg-white hover:text-brand-purple"
                            >
                              <span className="font-medium">{showPw === c.id ? c.portal_password : '••••••••'}</span>
                              <EyeIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400">reset om te zien</span>
                          )
                        ) : (
                          <span className="italic text-amber-500">niet ingesteld</span>
                        )}
                      </div>
                    </div>

                    {/* Password reset inline */}
                    <AnimatePresence>
                      {resettingPw === c.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="mb-3 overflow-hidden"
                        >
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              value={newPw}
                              onChange={e => setNewPw(e.target.value)}
                              placeholder="Nieuw wachtwoord (min. 6)"
                              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
                              autoFocus
                            />
                            <button
                              onClick={() => resetPassword(c.id)}
                              disabled={pwSaving || newPw.length < 6}
                              className="rounded-lg bg-brand-purple px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                            >
                              {pwSaving ? '...' : 'Opslaan'}
                            </button>
                            <button
                              onClick={() => { setResettingPw(null); setNewPw(''); }}
                              className="rounded-lg px-2 py-2 text-slate-400 hover:text-slate-600"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Portal actions */}
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => copyCredentials(c)}
                        disabled={!c.email}
                        className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                      >
                        {copied === c.id ? <CheckIcon className="h-3.5 w-3.5 text-emerald-500" /> : <ClipboardDocumentIcon className="h-3.5 w-3.5" />}
                        {copied === c.id ? 'Gekopieerd!' : 'Kopieer'}
                      </button>
                      <button
                        onClick={() => { setResettingPw(resettingPw === c.id ? null : c.id); setNewPw(''); }}
                        className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                      >
                        <KeyIcon className="h-3.5 w-3.5" />
                        {c.has_password ? 'Reset ww' : 'Stel ww in'}
                      </button>
                      <button
                        onClick={() => togglePortal(c)}
                        disabled={togglingPortal === c.id}
                        className={`inline-flex min-h-[32px] items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                          c.portal_active
                            ? 'border-red-200 bg-white text-red-500 hover:bg-red-50'
                            : 'border-emerald-200 bg-white text-emerald-600 hover:bg-emerald-50'
                        } disabled:opacity-50`}
                      >
                        {togglingPortal === c.id ? (
                          <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                        ) : c.portal_active ? (
                          <ShieldExclamationIcon className="h-3.5 w-3.5" />
                        ) : (
                          <ShieldCheckIcon className="h-3.5 w-3.5" />
                        )}
                        {c.portal_active ? 'Uit' : 'Aan'}
                      </button>
                      {portalReady && (
                        <a
                          href="/portal"
                          target="_blank"
                          className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-brand-purple transition hover:bg-brand-purple/5"
                        >
                          <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                          Open
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Middle actions - Targets & Batches */}
                <div className="flex items-center border-t border-slate-100">
                  <button onClick={() => setTargetsFor(c)} className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-brand-purple">
                    <MapPinIcon className="h-3.5 w-3.5" /> Targetgebieden
                  </button>
                  <div className="h-6 w-px bg-slate-100" />
                  <button onClick={() => setBatchesFor(c)} className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-brand-purple">
                    <CurrencyEuroIcon className="h-3.5 w-3.5" /> Batches
                  </button>
                </div>

                {/* Bottom actions */}
                <div className="flex items-center border-t border-slate-100">
                  <button onClick={() => setEditing(c)} className="flex flex-1 items-center justify-center gap-1.5 py-3.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-brand-purple">
                    <PencilSquareIcon className="h-4 w-4" /> Bewerken
                  </button>
                  <div className="h-8 w-px bg-slate-100" />
                  <a href={`/admin/leads?customer_id=${c.id}`} className="flex flex-1 items-center justify-center gap-1.5 py-3.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-brand-purple">
                    <EyeIcon className="h-4 w-4" /> Leads
                  </a>
                  <div className="h-8 w-px bg-slate-100" />
                  <button onClick={() => handleDelete(c.id, c.name)} className="flex items-center justify-center px-5 py-3.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500">
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {(editing || showNew) && (
          <CustomerForm
            customer={editing}
            branchOptions={branchOptions}
            onClose={() => { setEditing(null); setShowNew(false); }}
            onSaved={() => { setEditing(null); setShowNew(false); fetch_(); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {targetsFor && (
          <TargetsPanel
            customer={targetsFor}
            onClose={() => setTargetsFor(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {batchesFor && (
          <BatchesPanel
            customer={batchesFor}
            branchOptions={branchOptions}
            onClose={() => setBatchesFor(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CustomerForm({ customer, branchOptions, onClose, onSaved }: { customer: Customer | null; branchOptions: BranchOption[]; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!customer;
  const [form, setForm] = useState({
    name: customer?.name || '',
    contact_person: customer?.contact_person || '',
    email: customer?.email || '',
    phone: customer?.phone || '',
    branches: customer?.branches || [],
    is_active: customer?.is_active ?? true,
    portal_active: customer?.portal_active ?? true,
    notes: customer?.notes || '',
    password: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleBranch = (b: string) => {
    setForm(f => ({
      ...f,
      branches: f.branches.includes(b) ? f.branches.filter(x => x !== b) : [...f.branches, b],
    }));
  };

  const save = async () => {
    if (!form.name) { setError('Bedrijfsnaam is verplicht'); return; }
    if (!isEdit && !form.password) { setError('Stel een portaalwachtwoord in voor de klant'); return; }
    setSaving(true);
    setError('');
    try {
      const { password, ...rest } = form;
      const payload: Record<string, unknown> = { ...rest };
      if (password) payload.password = password;
      const body = isEdit ? { id: customer!.id, ...payload } : payload;
      const res = await adminFetch('/api/admin/customers', {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Er ging iets mis');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed inset-y-0 right-0 z-[60] w-full max-w-md overflow-y-auto bg-white shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">{isEdit ? 'Klant bewerken' : 'Nieuwe klant'}</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><XMarkIcon className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4 p-5">
          {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-600">{error}</div>}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Bedrijfsnaam *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Contactpersoon</label>
            <input value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">E-mail</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Telefoon</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Branches</label>
            <div className="flex flex-wrap gap-2">
              {branchOptions.filter(bo => bo.is_active).map(bo => (
                <button key={bo.slug} onClick={() => toggleBranch(bo.slug)} type="button"
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                    form.branches.includes(bo.slug) ? 'border-brand-purple bg-brand-purple/10 text-brand-purple' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {bo.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Portaalwachtwoord {isEdit ? '(laat leeg om niet te wijzigen)' : '*'}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder={isEdit ? '••••••••' : 'Wachtwoord voor klantportaal'}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="active" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded border-slate-300" />
              <label htmlFor="active" className="text-sm text-slate-700">Actief</label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="portal" checked={form.portal_active} onChange={e => setForm(f => ({ ...f, portal_active: e.target.checked }))} className="rounded border-slate-300" />
              <label htmlFor="portal" className="text-sm text-slate-700">Portaal actief</label>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Notities</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
          </div>
        </div>

        <div className="sticky bottom-0 border-t border-slate-100 bg-white px-5 py-4">
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Annuleren</button>
            <button onClick={save} disabled={saving} className="flex-1 rounded-lg bg-button-gradient py-2.5 text-sm font-bold text-white disabled:opacity-60">
              {saving ? 'Opslaan...' : isEdit ? 'Bijwerken' : 'Aanmaken'}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

/* ============================================================
   TARGETS PANEL
   ============================================================ */
function TargetsPanel({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [cityQuery, setCityQuery] = useState('');
  const [cityResult, setCityResult] = useState<{ lat: number; lng: number; naam: string } | null>(null);
  const [citySearching, setCitySearching] = useState(false);
  const [cityError, setCityError] = useState('');
  const [newRadius, setNewRadius] = useState(25);
  const [newLabel, setNewLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const searchTimer = useRef<NodeJS.Timeout | null>(null);

  const fetchTargets = useCallback(async () => {
    const res = await adminFetch(`/api/admin/targets?customer_id=${customer.id}`);
    if (res.ok) setTargets(await res.json());
    setLoading(false);
  }, [customer.id]);

  useEffect(() => { fetchTargets(); }, [fetchTargets]);

  const searchCity = (q: string) => {
    setCityQuery(q);
    setCityResult(null);
    setCityError('');
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.trim().length < 2) return;
    searchTimer.current = setTimeout(async () => {
      setCitySearching(true);
      const res = await adminFetch(`/api/admin/city-lookup?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setCityResult(data);
        setNewLabel(data.naam);
      } else {
        setCityError('Plaats niet gevonden');
      }
      setCitySearching(false);
    }, 500);
  };

  const addTarget = async () => {
    if (!cityResult || !newLabel) return;
    setSaving(true);
    await adminFetch('/api/admin/targets', {
      method: 'POST',
      body: JSON.stringify({ customer_id: customer.id, label: newLabel, lat: cityResult.lat, lng: cityResult.lng, radius_km: newRadius }),
    });
    setSaving(false);
    setShowAdd(false);
    setCityQuery('');
    setCityResult(null);
    setNewLabel('');
    setNewRadius(25);
    fetchTargets();
  };

  const removeTarget = async (id: string) => {
    if (!confirm('Dit targetgebied verwijderen?')) return;
    await adminFetch(`/api/admin/targets?id=${id}`, { method: 'DELETE' });
    fetchTargets();
  };

  const toggleActive = async (t: Target) => {
    await adminFetch('/api/admin/targets', {
      method: 'PUT',
      body: JSON.stringify({ id: t.id, is_active: !t.is_active }),
    });
    fetchTargets();
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-lg flex-col bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Targetgebieden</h2>
            <p className="text-xs text-slate-500">{customer.name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><XMarkIcon className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* Add form */}
          {showAdd ? (
            <div className="mb-5 rounded-xl border border-brand-purple/20 bg-brand-purple/5 p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Nieuw targetgebied</h3>
              <div className="mb-3">
                <label className="mb-1 block text-xs font-medium text-slate-500">Zoek plaats</label>
                <div className="relative">
                  <input
                    value={cityQuery}
                    onChange={e => searchCity(e.target.value)}
                    placeholder="Bijv. Amsterdam, Rotterdam..."
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-8 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
                    autoFocus
                  />
                  {citySearching && (
                    <div className="absolute right-2.5 top-2.5">
                      <ArrowPathIcon className="h-4 w-4 animate-spin text-slate-400" />
                    </div>
                  )}
                </div>
                {cityError && <p className="mt-1 text-xs text-red-500">{cityError}</p>}
                {cityResult && (
                  <p className="mt-1.5 text-xs text-emerald-600">
                    {cityResult.naam} gevonden ({cityResult.lat.toFixed(4)}, {cityResult.lng.toFixed(4)})
                  </p>
                )}
              </div>
              <div className="mb-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Label</label>
                  <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Radius (km)</label>
                  <input type="number" value={newRadius} onChange={e => setNewRadius(Number(e.target.value))} min={1} max={200}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setShowAdd(false); setCityQuery(''); setCityResult(null); }}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50">Annuleren</button>
                <button onClick={addTarget} disabled={!cityResult || !newLabel || saving}
                  className="rounded-lg bg-button-gradient px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
                  {saving ? 'Opslaan...' : 'Toevoegen'}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAdd(true)} className="mb-5 inline-flex items-center gap-1.5 rounded-lg bg-button-gradient px-3.5 py-2 text-sm font-bold text-white shadow-sm">
              <PlusIcon className="h-4 w-4" /> Targetgebied toevoegen
            </button>
          )}

          {/* List */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}
            </div>
          ) : targets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center">
              <MapPinIcon className="mx-auto mb-2 h-8 w-8 text-slate-300" />
              <p className="text-sm text-slate-500">Nog geen targetgebieden ingesteld</p>
              <p className="text-xs text-slate-400">Voeg een plaats + radius toe om leads automatisch te matchen</p>
            </div>
          ) : (
            <div className="space-y-3">
              {targets.map(t => (
                <div key={t.id} className={`rounded-xl border p-4 transition ${t.is_active ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <MapPinIcon className="h-4 w-4 text-brand-purple" />
                        <span className="font-semibold text-slate-800">{t.label}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Radius: <span className="font-medium">{t.radius_km} km</span>
                        <span className="mx-1.5 text-slate-300">|</span>
                        {t.lat.toFixed(3)}, {t.lng.toFixed(3)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => toggleActive(t)}
                        className={`rounded-lg px-2 py-1 text-[11px] font-medium transition ${t.is_active ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                        {t.is_active ? 'Actief' : 'Inactief'}
                      </button>
                      <button onClick={() => removeTarget(t.id)}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500">
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}

/* ============================================================
   BATCHES PANEL
   ============================================================ */
function BatchesPanel({ customer, branchOptions, onClose }: { customer: Customer; branchOptions: BranchOption[]; onClose: () => void }) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ branch: '', batch_size: 100, price_per_lead: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const fetchBatches = useCallback(async () => {
    const res = await adminFetch(`/api/admin/batches?customer_id=${customer.id}`);
    if (res.ok) setBatches(await res.json());
    setLoading(false);
  }, [customer.id]);

  useEffect(() => { fetchBatches(); }, [fetchBatches]);

  const addBatch = async () => {
    if (!form.branch || !form.batch_size) return;
    setSaving(true);
    await adminFetch('/api/admin/batches', {
      method: 'POST',
      body: JSON.stringify({
        customer_id: customer.id,
        branch: form.branch,
        batch_size: form.batch_size,
        price_per_lead: form.price_per_lead ? parseFloat(form.price_per_lead) : null,
        notes: form.notes || null,
      }),
    });
    setSaving(false);
    setShowAdd(false);
    setForm({ branch: '', batch_size: 100, price_per_lead: '', notes: '' });
    fetchBatches();
  };

  const toggleBatchStatus = async (b: Batch) => {
    const newStatus = b.status === 'active' ? 'paused' : 'active';
    await adminFetch('/api/admin/batches', {
      method: 'PUT',
      body: JSON.stringify({ id: b.id, status: newStatus, completed_at: null }),
    });
    fetchBatches();
  };

  const removeBatch = async (id: string) => {
    if (!confirm('Deze batch verwijderen?')) return;
    await adminFetch(`/api/admin/batches?id=${id}`, { method: 'DELETE' });
    fetchBatches();
  };

  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600', sky: 'bg-sky-50 text-sky-600', amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600', rose: 'bg-rose-50 text-rose-600', cyan: 'bg-cyan-50 text-cyan-600',
    lime: 'bg-lime-50 text-lime-600', indigo: 'bg-indigo-50 text-indigo-600', teal: 'bg-teal-50 text-teal-600',
    slate: 'bg-slate-50 text-slate-600',
  };

  const statusColors: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700',
    paused: 'bg-amber-100 text-amber-700',
    completed: 'bg-blue-100 text-blue-700',
  };

  const statusLabels: Record<string, string> = {
    active: 'Actief',
    paused: 'Gepauzeerd',
    completed: 'Voltooid',
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-lg flex-col bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Lead batches</h2>
            <p className="text-xs text-slate-500">{customer.name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><XMarkIcon className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {showAdd ? (
            <div className="mb-5 rounded-xl border border-brand-purple/20 bg-brand-purple/5 p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Nieuwe batch</h3>
              <div className="mb-3">
                <label className="mb-1 block text-xs font-medium text-slate-500">Branche *</label>
                <select value={form.branch} onChange={e => setForm(f => ({ ...f, branch: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50">
                  <option value="">Kies branche...</option>
                  {branchOptions.filter(b => b.is_active).map(b => (
                    <option key={b.slug} value={b.slug}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div className="mb-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Batch grootte *</label>
                  <input type="number" value={form.batch_size} onChange={e => setForm(f => ({ ...f, batch_size: Number(e.target.value) }))} min={1}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Prijs per lead</label>
                  <input type="number" step="0.01" value={form.price_per_lead} onChange={e => setForm(f => ({ ...f, price_per_lead: e.target.value }))}
                    placeholder="€" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
                </div>
              </div>
              <div className="mb-3">
                <label className="mb-1 block text-xs font-medium text-slate-500">Notities</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowAdd(false)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50">Annuleren</button>
                <button onClick={addBatch} disabled={!form.branch || !form.batch_size || saving}
                  className="rounded-lg bg-button-gradient px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
                  {saving ? 'Opslaan...' : 'Toevoegen'}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAdd(true)} className="mb-5 inline-flex items-center gap-1.5 rounded-lg bg-button-gradient px-3.5 py-2 text-sm font-bold text-white shadow-sm">
              <PlusIcon className="h-4 w-4" /> Nieuwe batch
            </button>
          )}

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100" />)}
            </div>
          ) : batches.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center">
              <ChartBarIcon className="mx-auto mb-2 h-8 w-8 text-slate-300" />
              <p className="text-sm text-slate-500">Nog geen batches</p>
              <p className="text-xs text-slate-400">Maak een batch aan om leads automatisch te distribueren</p>
            </div>
          ) : (
            <div className="space-y-3">
              {batches.map(b => {
                const pct = b.batch_size > 0 ? Math.min(100, Math.round((b.leads_delivered / b.batch_size) * 100)) : 0;
                const bo = branchOptions.find(x => x.slug === b.branch);
                return (
                  <div key={b.id} className={`rounded-xl border p-4 transition ${b.status === 'completed' ? 'border-blue-100 bg-blue-50/30' : b.status === 'paused' ? 'border-amber-100 bg-amber-50/20' : 'border-slate-200 bg-white'}`}>
                    <div className="mb-2 flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${colorMap[bo?.color || 'slate'] || colorMap.slate}`}>
                          {bo?.name || b.branch}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColors[b.status] || statusColors.active}`}>
                          {statusLabels[b.status] || b.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {b.status !== 'completed' && (
                          <button onClick={() => toggleBatchStatus(b)}
                            className="rounded-lg px-2 py-1 text-[11px] font-medium text-slate-500 transition hover:bg-slate-100">
                            {b.status === 'active' ? 'Pauzeer' : 'Heractiveer'}
                          </button>
                        )}
                        <button onClick={() => removeBatch(b.id)}
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500">
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mb-2">
                      <div className="mb-1 flex items-baseline justify-between">
                        <span className="text-sm font-bold text-slate-800">{b.leads_delivered} / {b.batch_size}</span>
                        <span className="text-xs font-medium text-slate-500">{pct}%</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            pct >= 100 ? 'bg-blue-500' : pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-brand-purple'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* Details */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      {b.price_per_lead && (
                        <span>€{Number(b.price_per_lead).toFixed(2)}/lead</span>
                      )}
                      {b.total_price && (
                        <span>Totaal: €{Number(b.total_price).toFixed(2)}</span>
                      )}
                      <span>{new Date(b.created_at).toLocaleDateString('nl-NL')}</span>
                      {b.notes && <span className="italic">{b.notes}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}
