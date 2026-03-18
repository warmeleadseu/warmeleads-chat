'use client';

import { useState, useEffect, useCallback } from 'react';
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
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';

interface Customer {
  id: string; name: string; contact_person: string; email: string; phone: string;
  branches: string[]; is_active: boolean; portal_active: boolean; has_password?: boolean; portal_password?: string | null; notes: string; created_at: string;
  lead_count?: number;
}

const BRANCHES = ['thuisbatterij', 'airco'];

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [resettingPw, setResettingPw] = useState<string | null>(null);
  const [newPw, setNewPw] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [togglingPortal, setTogglingPortal] = useState<string | null>(null);
  const [showPw, setShowPw] = useState<string | null>(null);

  const portalUrl = typeof window !== 'undefined' ? `${window.location.origin}/portal` : 'https://www.warmeleads.eu/portal';

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const res = await adminFetch('/api/admin/customers');
    if (res.ok) { const d = await res.json(); setCustomers(d.customers || []); }
    setLoading(false);
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

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
        <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-brand-purple" /></div>
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
                    <div>
                      <h3 className="font-semibold text-slate-900">{c.name}</h3>
                      {c.contact_person && <p className="text-xs text-slate-500">{c.contact_person}</p>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${c.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {c.is_active ? 'Actief' : 'Inactief'}
                      </span>
                    </div>
                  </div>

                  {/* Contact */}
                  {c.email && <p className="mb-0.5 text-xs text-slate-500">{c.email}</p>}
                  {c.phone && <p className="mb-2 text-xs text-slate-500">{c.phone}</p>}

                  {/* Branches + leads */}
                  <div className="mb-4 flex flex-wrap items-center gap-1.5">
                    {c.branches?.map(b => (
                      <span key={b} className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${b === 'thuisbatterij' ? 'bg-emerald-50 text-emerald-600' : 'bg-sky-50 text-sky-600'}`}>
                        {b}
                      </span>
                    ))}
                    {typeof c.lead_count === 'number' && (
                      <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        <UserGroupIcon className="h-3 w-3" /> {c.lead_count} leads
                      </span>
                    )}
                  </div>

                  {/* Portal section */}
                  <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {portalReady ? (
                          <ShieldCheckIcon className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <ShieldExclamationIcon className="h-4 w-4 text-amber-500" />
                        )}
                        <span className="text-xs font-semibold text-slate-700">Klantportaal</span>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        portalReady ? 'bg-emerald-100 text-emerald-700' : c.portal_active ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {portalReady ? 'Gereed' : c.portal_active ? 'Incompleet' : 'Uit'}
                      </span>
                    </div>

                    {/* Login info */}
                    <div className="mb-2.5 space-y-1 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">URL</span>
                        <span className="font-mono text-slate-600">{portalUrl.replace('https://', '')}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">E-mail</span>
                        <span className="font-medium text-slate-600">{c.email || <span className="italic text-amber-500">niet ingesteld</span>}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Wachtwoord</span>
                        {c.has_password ? (
                          <button
                            onClick={() => setShowPw(showPw === c.id ? null : c.id)}
                            className="inline-flex items-center gap-1 text-slate-600 hover:text-brand-purple"
                          >
                            <span className="font-medium">{showPw === c.id && c.portal_password ? c.portal_password : '••••••••'}</span>
                            <EyeIcon className="h-3 w-3 shrink-0 text-slate-400" />
                          </button>
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
                          className="mb-2.5 overflow-hidden"
                        >
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              value={newPw}
                              onChange={e => setNewPw(e.target.value)}
                              placeholder="Nieuw wachtwoord (min. 6 tekens)"
                              className="flex-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-brand-purple/50"
                              autoFocus
                            />
                            <button
                              onClick={() => resetPassword(c.id)}
                              disabled={pwSaving || newPw.length < 6}
                              className="rounded-md bg-brand-purple px-2.5 py-1.5 text-[11px] font-medium text-white disabled:opacity-50"
                            >
                              {pwSaving ? '...' : 'Opslaan'}
                            </button>
                            <button
                              onClick={() => { setResettingPw(null); setNewPw(''); }}
                              className="rounded-md px-1.5 py-1.5 text-slate-400 hover:text-slate-600"
                            >
                              <XMarkIcon className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Portal actions */}
                    <div className="flex flex-wrap gap-1">
                      <button
                        onClick={() => copyCredentials(c)}
                        disabled={!c.email}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                      >
                        {copied === c.id ? <CheckIcon className="h-3 w-3 text-emerald-500" /> : <ClipboardDocumentIcon className="h-3 w-3" />}
                        {copied === c.id ? 'Gekopieerd!' : 'Kopieer login'}
                      </button>
                      <button
                        onClick={() => { setResettingPw(resettingPw === c.id ? null : c.id); setNewPw(''); }}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 transition hover:bg-slate-50"
                      >
                        <KeyIcon className="h-3 w-3" />
                        {c.has_password ? 'Reset wachtwoord' : 'Stel wachtwoord in'}
                      </button>
                      <button
                        onClick={() => togglePortal(c)}
                        disabled={togglingPortal === c.id}
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition ${
                          c.portal_active
                            ? 'border-red-200 bg-white text-red-500 hover:bg-red-50'
                            : 'border-emerald-200 bg-white text-emerald-600 hover:bg-emerald-50'
                        } disabled:opacity-50`}
                      >
                        {togglingPortal === c.id ? (
                          <ArrowPathIcon className="h-3 w-3 animate-spin" />
                        ) : c.portal_active ? (
                          <ShieldExclamationIcon className="h-3 w-3" />
                        ) : (
                          <ShieldCheckIcon className="h-3 w-3" />
                        )}
                        {c.portal_active ? 'Portaal uit' : 'Portaal aan'}
                      </button>
                      {portalReady && (
                        <a
                          href="/portal"
                          target="_blank"
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-brand-purple transition hover:bg-brand-purple/5"
                        >
                          <ArrowTopRightOnSquareIcon className="h-3 w-3" />
                          Open portaal
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom actions */}
                <div className="flex items-center border-t border-slate-100">
                  <button onClick={() => setEditing(c)} className="flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-brand-purple">
                    <PencilSquareIcon className="h-3.5 w-3.5" /> Bewerken
                  </button>
                  <div className="h-8 w-px bg-slate-100" />
                  <a href={`/admin/leads?customer_id=${c.id}`} className="flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-brand-purple">
                    <EyeIcon className="h-3.5 w-3.5" /> Bekijk leads
                  </a>
                  <div className="h-8 w-px bg-slate-100" />
                  <button onClick={() => handleDelete(c.id, c.name)} className="flex items-center justify-center px-4 py-3 text-xs text-slate-400 transition hover:bg-red-50 hover:text-red-500">
                    <TrashIcon className="h-3.5 w-3.5" />
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
            onClose={() => { setEditing(null); setShowNew(false); }}
            onSaved={() => { setEditing(null); setShowNew(false); fetch_(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CustomerForm({ customer, onClose, onSaved }: { customer: Customer | null; onClose: () => void; onSaved: () => void }) {
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
            <div className="flex gap-2">
              {BRANCHES.map(b => (
                <button key={b} onClick={() => toggleBranch(b)} type="button"
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                    form.branches.includes(b) ? 'border-brand-purple bg-brand-purple/10 text-brand-purple' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {b}
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
