'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
  AdjustmentsHorizontalIcon,
  ChevronDownIcon,
  LinkSlashIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  EnvelopeIcon,
  ClockIcon,
  FunnelIcon,
  ChevronUpDownIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';

interface Customer {
  id: string; name: string; contact_person: string; email: string; phone: string;
  branches: string[]; is_active: boolean; portal_active: boolean; has_password?: boolean; portal_password?: string | null; notes: string; created_at: string;
  lead_count?: number;
  last_login_at?: string | null;
  login_count?: number;
}

function getActivityStatus(c: Customer): { label: string; color: string; dotColor: string; sort: number } {
  if (!c.portal_active || !c.has_password) return { label: 'Portaal niet actief', color: 'text-slate-400', dotColor: 'bg-slate-300', sort: 5 };
  if (!c.last_login_at || !c.login_count) return { label: 'Nooit ingelogd', color: 'text-red-500', dotColor: 'bg-red-400', sort: 4 };
  const diff = Date.now() - new Date(c.last_login_at).getTime();
  const hours = diff / (1000 * 60 * 60);
  const days = diff / (1000 * 60 * 60 * 24);
  if (hours < 1) return { label: 'Online', color: 'text-emerald-600', dotColor: 'bg-emerald-500', sort: 0 };
  if (days < 1) return { label: `${Math.floor(hours)}u geleden`, color: 'text-emerald-600', dotColor: 'bg-emerald-500', sort: 0 };
  if (days < 7) return { label: `${Math.floor(days)}d geleden`, color: 'text-emerald-600', dotColor: 'bg-emerald-500', sort: 1 };
  if (days < 30) return { label: `${Math.floor(days)}d geleden`, color: 'text-amber-600', dotColor: 'bg-amber-400', sort: 2 };
  return { label: `${Math.floor(days)}d geleden`, color: 'text-red-500', dotColor: 'bg-red-400', sort: 3 };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = diff / (1000 * 60 * 60 * 24);
  if (days < 1) return 'Vandaag';
  if (days < 7) return `${Math.floor(days)}d geleden`;
  if (days < 30) return `${Math.floor(days / 7)}w geleden`;
  return `${Math.floor(days / 30)}m geleden`;
}

interface BranchOption { slug: string; name: string; color: string; is_active: boolean; }

interface Target {
  id: string; customer_id: string; label: string; lat: number; lng: number;
  radius_km: number; is_active: boolean; created_at: string;
}

interface LeadFilter {
  field: string;
  operator: string;
  value: string;
  values?: string[];
}

interface Batch {
  id: string; customer_id: string; branch: string; batch_size: number;
  price_per_lead: number | null; total_price: number | null;
  leads_per_day: number | null; leads_per_week: number | null;
  leads_delivered: number; status: string; notes: string | null;
  lead_filters: LeadFilter[];
  created_at: string; completed_at: string | null;
}

interface BranchField {
  id: string; key: string; label: string; field_type: string; options: string[];
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
  const [leadsFor, setLeadsFor] = useState<Customer | null>(null);
  const [allBatches, setAllBatches] = useState<Batch[]>([]);
  const [search, setSearch] = useState('');
  const [activityFilter, setActivityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const [reminderSent, setReminderSent] = useState<Set<string>>(new Set());
  const [previewReminder, setPreviewReminder] = useState<Customer | null>(null);

  const portalUrl = typeof window !== 'undefined' ? `${window.location.origin}/portal` : 'https://www.warmeleads.eu/portal';

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const [custRes, batchRes] = await Promise.all([
      adminFetch('/api/admin/customers'),
      adminFetch('/api/admin/batches'),
    ]);
    if (custRes.ok) { const d = await custRes.json(); setCustomers(d.customers || []); }
    if (batchRes.ok) { const d = await batchRes.json(); setAllBatches(d || []); }
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

  const sendReminder = async (c: Customer) => {
    setSendingReminder(c.id);
    try {
      const res = await adminFetch('/api/admin/customers/reminder', {
        method: 'POST',
        body: JSON.stringify({ customer_id: c.id }),
      });
      if (res.ok) {
        setReminderSent(prev => new Set(prev).add(c.id));
        setPreviewReminder(null);
      } else {
        const d = await res.json();
        alert(d.error || 'Versturen mislukt');
      }
    } catch { alert('Er ging iets mis'); }
    setSendingReminder(null);
  };

  const portalUsers = customers.filter(c => c.portal_active && c.has_password);
  const activePortalUsers = portalUsers.filter(c => {
    if (!c.last_login_at) return false;
    return Date.now() - new Date(c.last_login_at).getTime() < 7 * 24 * 60 * 60 * 1000;
  });
  const neverLoggedIn = portalUsers.filter(c => !c.last_login_at || !c.login_count);
  const churning = portalUsers.filter(c => {
    if (!c.last_login_at) return false;
    return Date.now() - new Date(c.last_login_at).getTime() > 30 * 24 * 60 * 60 * 1000;
  });

  const filtered = useMemo(() => {
    let list = [...customers];

    if (search) {
      const s = search.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(s) ||
        (c.contact_person || '').toLowerCase().includes(s) ||
        (c.email || '').toLowerCase().includes(s)
      );
    }

    if (activityFilter === 'active') {
      list = list.filter(c => c.last_login_at && Date.now() - new Date(c.last_login_at).getTime() < 7 * 24 * 60 * 60 * 1000);
    } else if (activityFilter === 'never') {
      list = list.filter(c => c.portal_active && c.has_password && (!c.last_login_at || !c.login_count));
    } else if (activityFilter === 'inactive') {
      list = list.filter(c => c.last_login_at && Date.now() - new Date(c.last_login_at).getTime() > 30 * 24 * 60 * 60 * 1000);
    }

    list.sort((a, b) => {
      if (sortBy === 'last_login') {
        const aTime = a.last_login_at ? new Date(a.last_login_at).getTime() : 0;
        const bTime = b.last_login_at ? new Date(b.last_login_at).getTime() : 0;
        return bTime - aTime;
      }
      if (sortBy === 'login_count') {
        return (b.login_count || 0) - (a.login_count || 0);
      }
      if (sortBy === 'activity') {
        return getActivityStatus(a).sort - getActivityStatus(b).sort;
      }
      if (sortBy === 'created') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return a.name.localeCompare(b.name);
    });

    return list;
  }, [customers, search, activityFilter, sortBy]);

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

      {/* Activity KPIs */}
      {!loading && customers.length > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Actief (7d)</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{activePortalUsers.length}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">van {portalUsers.length} portaalgebruikers</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Nooit ingelogd</p>
            <p className="mt-1 text-2xl font-bold text-red-500">{neverLoggedIn.length}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">portaal gereed maar ongebruikt</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Dreigt af te haken</p>
            <p className="mt-1 text-2xl font-bold text-amber-600">{churning.length}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">&gt;30 dagen geen login</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Totaal klanten</p>
            <p className="mt-1 text-2xl font-bold text-brand-purple">{customers.length}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">{customers.filter(c => c.is_active).length} actief</p>
          </div>
        </div>
      )}

      {/* Search + filter + sort bar */}
      {!loading && customers.length > 0 && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-xs">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Zoek op naam, contact, e-mail..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/30" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
              <FunnelIcon className="h-4 w-4 text-slate-400" />
              <select value={activityFilter} onChange={e => setActivityFilter(e.target.value)}
                className="bg-transparent text-sm text-slate-700 outline-none">
                <option value="all">Alle klanten</option>
                <option value="active">Actief (7d)</option>
                <option value="never">Nooit ingelogd</option>
                <option value="inactive">Inactief (30d+)</option>
              </select>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
              <ChevronUpDownIcon className="h-4 w-4 text-slate-400" />
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                className="bg-transparent text-sm text-slate-700 outline-none">
                <option value="name">Naam</option>
                <option value="last_login">Laatst ingelogd</option>
                <option value="login_count">Aantal logins</option>
                <option value="activity">Activiteitsstatus</option>
                <option value="created">Aangemaakt</option>
              </select>
            </div>
            {(search || activityFilter !== 'all') && (
              <button onClick={() => { setSearch(''); setActivityFilter('all'); }}
                className="text-xs font-medium text-red-500 hover:text-red-600">Filters wissen</button>
            )}
          </div>
        </div>
      )}

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
          {filtered.length === 0 ? (
            <div className="col-span-full rounded-xl border border-dashed border-slate-300 bg-white py-12 text-center">
              <MagnifyingGlassIcon className="mx-auto mb-2 h-8 w-8 text-slate-300" />
              <p className="text-sm font-medium text-slate-500">Geen klanten gevonden</p>
              <p className="mt-0.5 text-xs text-slate-400">Pas je zoekterm of filters aan</p>
            </div>
          ) : filtered.map(c => {
            const portalReady = c.portal_active && c.has_password && c.email;
            const activity = getActivityStatus(c);
            const isNew = Date.now() - new Date(c.created_at).getTime() < 7 * 24 * 60 * 60 * 1000;
            const neverLogged = c.portal_active && c.has_password && (!c.last_login_at || !c.login_count);
            const isChurning = c.last_login_at && Date.now() - new Date(c.last_login_at).getTime() > 30 * 24 * 60 * 60 * 1000;
            return (
              <div key={c.id} className="rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
                <div className="p-5">
                  {/* Header */}
                  <div className="mb-3 flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900">{c.name}</h3>
                        {portalReady && (
                          <span className={`flex items-center gap-1 text-[11px] font-medium ${activity.color}`} title={c.last_login_at ? `Laatste login: ${new Date(c.last_login_at).toLocaleString('nl-NL')}` : 'Nooit ingelogd'}>
                            <span className={`inline-block h-1.5 w-1.5 rounded-full ${activity.dotColor} ${activity.sort === 0 ? 'animate-pulse' : ''}`} />
                            {activity.label}
                          </span>
                        )}
                      </div>
                      {c.contact_person && <p className="text-xs text-slate-500">{c.contact_person}</p>}
                    </div>
                    <div className="ml-2 flex shrink-0 flex-col items-end gap-1">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${c.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {c.is_active ? 'Actief' : 'Inactief'}
                      </span>
                      {isNew && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">Nieuwe klant</span>}
                      {!neverLogged && isChurning && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600">Dreigt af te haken</span>}
                    </div>
                  </div>

                  {/* Contact */}
                  {c.email && <p className="mb-0.5 text-xs text-slate-500">{c.email}</p>}
                  {c.phone && <p className="mb-2 text-xs text-slate-500">{c.phone}</p>}

                  {/* Branches + leads + login count */}
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
                    {(c.login_count || 0) > 0 && (
                      <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        <ClockIcon className="h-3 w-3" /> {c.login_count}x ingelogd
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
                      {neverLogged && c.email && (
                        <button
                          onClick={() => setPreviewReminder(c)}
                          disabled={reminderSent.has(c.id)}
                          className={`inline-flex min-h-[32px] items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                            reminderSent.has(c.id)
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                              : 'border-brand-purple/30 bg-brand-purple/5 text-brand-purple hover:bg-brand-purple/10'
                          }`}
                        >
                          {reminderSent.has(c.id) ? (
                            <CheckIcon className="h-3.5 w-3.5" />
                          ) : (
                            <EnvelopeIcon className="h-3.5 w-3.5" />
                          )}
                          {reminderSent.has(c.id) ? 'Verstuurd!' : 'Reminder'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Inline batch progress */}
                {(() => {
                  const custBatches = allBatches.filter(b => b.customer_id === c.id && b.status === 'active');
                  if (custBatches.length === 0) return null;
                  const colorMap: Record<string, string> = {
                    emerald: 'bg-emerald-500', sky: 'bg-sky-500', amber: 'bg-amber-500', purple: 'bg-purple-500',
                    rose: 'bg-rose-500', cyan: 'bg-cyan-500', lime: 'bg-lime-500', indigo: 'bg-indigo-500',
                    teal: 'bg-teal-500', slate: 'bg-slate-500',
                  };
                  return (
                    <div className="border-t border-slate-100 px-5 py-3">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Actieve batches</p>
                      <div className="space-y-2">
                        {custBatches.map(b => {
                          const pct = b.batch_size > 0 ? Math.min(100, Math.round((b.leads_delivered / b.batch_size) * 100)) : 0;
                          const bo = branchOptions.find(x => x.slug === b.branch);
                          const barColor = colorMap[bo?.color || 'slate'] || 'bg-slate-500';
                          return (
                            <div key={b.id}>
                              <div className="mb-0.5 flex items-center justify-between">
                                <span className="text-xs font-medium text-slate-600">{bo?.name || b.branch}</span>
                                <span className="text-[11px] font-semibold text-slate-500">{b.leads_delivered}/{b.batch_size} <span className="text-slate-400">({pct}%)</span></span>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                                <div className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? 'bg-blue-500' : barColor}`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Middle actions - Targets, Batches & Lead Manager */}
                <div className="flex items-center border-t border-slate-100">
                  <button onClick={() => setTargetsFor(c)} className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-brand-purple">
                    <MapPinIcon className="h-3.5 w-3.5" /> Targets
                  </button>
                  <div className="h-6 w-px bg-slate-100" />
                  <button onClick={() => setBatchesFor(c)} className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-brand-purple">
                    <CurrencyEuroIcon className="h-3.5 w-3.5" /> Batches
                  </button>
                  <div className="h-6 w-px bg-slate-100" />
                  <button onClick={() => setLeadsFor(c)} className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-red-500">
                    <LinkSlashIcon className="h-3.5 w-3.5" /> Leads beheren
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

      <AnimatePresence>
        {leadsFor && (
          <LeadManagerPanel
            customer={leadsFor}
            onClose={() => { setLeadsFor(null); fetch_(); }}
          />
        )}
      </AnimatePresence>

      {/* Reminder email preview modal (portalled to body for correct fixed positioning) */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {previewReminder && (
            <ReminderPreviewModal
              customer={previewReminder}
              portalUrl={portalUrl}
              sending={sendingReminder === previewReminder.id}
              onSend={() => sendReminder(previewReminder)}
              onClose={() => setPreviewReminder(null)}
            />
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}

/* ─── Reminder Preview Modal ──────────────────────────────── */
function ReminderPreviewModal({ customer, portalUrl, sending, onSend, onClose }: {
  customer: Customer; portalUrl: string; sending: boolean;
  onSend: () => void; onClose: () => void;
}) {
  const greeting = customer.contact_person || customer.name;
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://warmeleads.eu';
  const logoUrl = `${baseUrl}/logo-wit.png`;
  const emailHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; background: #1A1A2E;">
      <div style="background: linear-gradient(135deg, #3B2F75 0%, #E74C8C 50%, #FF6B35 100%); padding: 44px 32px 36px; text-align: center; border-radius: 16px 16px 0 0;">
        <img src="${logoUrl}" alt="WarmeLeads" width="160" style="max-width: 160px; height: auto;" />
        <p style="color: rgba(255,255,255,0.7); margin: 14px 0 0; font-size: 13px; letter-spacing: 0.5px;">UW PERSOONLIJKE LEADPORTAAL</p>
      </div>
      <div style="margin: 0 20px; background: #ffffff; border-radius: 16px; padding: 36px 32px; position: relative; top: -8px;">
        <p style="color: #1A1A2E; font-size: 18px; font-weight: 700; line-height: 1.4; margin: 0 0 8px;">Hallo ${greeting},</p>
        <p style="color: #475569; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
          Uw persoonlijke leadportaal staat klaar! Hier vindt u al uw leads overzichtelijk op een plek, kunt u nieuwe batches bestellen en uw account beheren.
        </p>
        ${customer.portal_password ? `
        <div style="background: linear-gradient(135deg, #FFF5F0 0%, #FFF0F5 100%); border: 1px solid #FFE0D0; border-radius: 14px; padding: 24px; margin: 0 0 28px;">
          <p style="color: #FF6B35; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 16px;">Uw inloggegevens</p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="color: #64748b; font-size: 13px; padding: 6px 0; width: 100px;">E-mail</td>
              <td style="color: #1A1A2E; font-size: 14px; font-weight: 600; padding: 6px 0;">${customer.email}</td>
            </tr>
            <tr>
              <td style="color: #64748b; font-size: 13px; padding: 6px 0; border-top: 1px solid #FFE0D0;">Wachtwoord</td>
              <td style="color: #1A1A2E; font-size: 14px; font-weight: 600; padding: 6px 0; border-top: 1px solid #FFE0D0; font-family: monospace;">${customer.portal_password}</td>
            </tr>
          </table>
        </div>
        ` : ''}
        <div style="text-align: center; margin: 0 0 28px;">
          <a href="${portalUrl}" style="display: inline-block; background: linear-gradient(135deg, #FF6B35 0%, #FF4757 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-weight: 700; font-size: 15px; letter-spacing: 0.3px;">
            Ga naar uw portaal &rarr;
          </a>
        </div>
        <div style="border-top: 1px solid #f1f5f9; padding-top: 20px;">
          <p style="color: #94a3b8; font-size: 13px; line-height: 1.6; margin: 0; text-align: center;">
            <strong style="color: #64748b;">Tip:</strong> Installeer het portaal als app op uw telefoon voor snelle toegang en pushnotificaties.
          </p>
        </div>
      </div>
      <div style="padding: 28px 32px; text-align: center;">
        <p style="color: rgba(255,255,255,0.3); font-size: 12px; margin: 0;">WarmeLeads &middot; Uw partner in exclusieve leads</p>
      </div>
    </div>
  `;

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed left-1/2 top-1/2 z-[60] flex max-h-[85vh] w-[calc(100%-2rem)] max-w-[640px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="shrink-0 border-b border-slate-100">
          <div className="h-[3px] bg-warmeleads-gradient" />
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">E-mail preview</h2>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                <span>Naar: <span className="font-medium text-slate-700">{customer.email}</span></span>
                <span>Onderwerp: <span className="font-medium text-slate-700">Uw WarmeLeads portaal staat klaar!</span></span>
              </div>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Email preview */}
        <div className="flex-1 overflow-y-auto bg-[#1A1A2E] p-4 sm:p-6">
          <div dangerouslySetInnerHTML={{ __html: emailHtml }} />
        </div>

        {/* Footer with send button */}
        <div className="shrink-0 border-t border-slate-100 bg-white px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="hidden text-xs text-slate-400 sm:block">
              Wordt exact zo verstuurd naar {customer.contact_person || customer.name}
            </p>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <button onClick={onClose}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 sm:flex-initial">
                Annuleren
              </button>
              <button onClick={onSend} disabled={sending}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-button-gradient px-5 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-50 sm:flex-initial">
                {sending ? (
                  <><ArrowPathIcon className="h-4 w-4 animate-spin" /> Versturen...</>
                ) : (
                  <><EnvelopeIcon className="h-4 w-4" /> Verstuur e-mail</>
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}

function PasswordField({ value, onChange, label, placeholder }: { value: string; onChange: (v: string) => void; label: string; placeholder: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-10 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
        />
        <button
          type="button"
          onClick={() => setVisible(v => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition hover:text-slate-600"
        >
          <EyeIcon className="h-4 w-4" />
        </button>
      </div>
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
          <PasswordField
            value={form.password}
            onChange={val => setForm(f => ({ ...f, password: val }))}
            label={`Portaalwachtwoord ${isEdit ? '(laat leeg om niet te wijzigen)' : '*'}`}
            placeholder={isEdit ? '••••••••' : 'Wachtwoord voor klantportaal'}
          />
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
const COUNTRY_PRESETS = [
  { key: 'heel-nederland', label: 'Heel Nederland', lat: 52.1326, lng: 5.2913, radius: 200 },
  { key: 'heel-belgie', label: 'Heel België', lat: 50.5039, lng: 4.4699, radius: 170 },
];

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

  const addPreset = async (preset: typeof COUNTRY_PRESETS[0]) => {
    setSaving(true);
    await adminFetch('/api/admin/targets', {
      method: 'POST',
      body: JSON.stringify({ customer_id: customer.id, label: preset.label, lat: preset.lat, lng: preset.lng, radius_km: preset.radius }),
    });
    setSaving(false);
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
          {/* Presets */}
          {!showAdd && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-medium text-slate-500">Snel toevoegen</p>
              <div className="flex flex-wrap gap-2">
                {COUNTRY_PRESETS.map(p => {
                  const alreadyAdded = targets.some(t => t.label === p.label);
                  return (
                    <button
                      key={p.key}
                      onClick={() => addPreset(p)}
                      disabled={saving || alreadyAdded}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                        alreadyAdded
                          ? 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-brand-purple hover:text-brand-purple'
                      }`}
                    >
                      <MapPinIcon className="h-3.5 w-3.5" />
                      {p.label}
                      {alreadyAdded && <CheckIcon className="h-3 w-3 text-emerald-500" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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
   BATCHES PANEL: LEAD FILTER BUILDER (multi-select per field)
   ============================================================ */

const STANDARD_FILTER_FIELDS: BranchField[] = [
  { id: '_quality_score', key: 'quality_score', label: 'Kwaliteitsscore (0-100)', field_type: 'number', options: [] },
  { id: '_phone_valid', key: 'phone_valid', label: 'Geldig telefoonnummer', field_type: 'select', options: ['true', 'false'] },
];

function FilterFieldValues({ branchSlug, fieldKey, selected, onChange }: {
  branchSlug: string; fieldKey: string; selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!branchSlug || !fieldKey) { setOptions([]); return; }
    setLoading(true);
    adminFetch(`/api/admin/leads/field-values?branch=${branchSlug}&field=${fieldKey}`)
      .then(r => r.ok ? r.json() : { values: [] })
      .then(d => setOptions(d.values || []))
      .finally(() => setLoading(false));
  }, [branchSlug, fieldKey]);

  const toggle = (val: string) => {
    if (selected.includes(val)) onChange(selected.filter(v => v !== val));
    else onChange([...selected, val]);
  };

  if (loading) {
    return (
      <div className="mt-2 space-y-1.5">
        {[0, 1, 2].map(i => <div key={i} className="h-6 w-full animate-pulse rounded bg-slate-100" />)}
      </div>
    );
  }

  if (options.length === 0) {
    return <p className="mt-2 text-[11px] text-slate-400">Geen waarden gevonden voor dit veld.</p>;
  }

  return (
    <div className="mt-2 max-h-48 space-y-0.5 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1.5">
      {options.map(opt => {
        const checked = selected.includes(opt);
        return (
          <label key={opt} className={`flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition ${checked ? 'bg-brand-purple/10 text-brand-purple font-medium' : 'text-slate-600 hover:bg-slate-50'}`}>
            <input type="checkbox" checked={checked} onChange={() => toggle(opt)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-brand-purple accent-brand-purple" />
            <span className="truncate">{opt}</span>
          </label>
        );
      })}
    </div>
  );
}

function FilterBuilder({ filters, onChange, branchSlug }: { filters: LeadFilter[]; onChange: (f: LeadFilter[]) => void; branchSlug: string }) {
  const [fields, setFields] = useState<BranchField[]>([]);
  const [open, setOpen] = useState(filters.length > 0);

  useEffect(() => {
    if (!branchSlug) { setFields([]); return; }
    adminFetch(`/api/admin/branches/fields?branch_slug=${branchSlug}`)
      .then(r => r.ok ? r.json() : { fields: [] })
      .then(d => setFields([...(d.fields || []), ...STANDARD_FILTER_FIELDS]));
  }, [branchSlug]);

  const addFilter = () => onChange([...filters, { field: '', operator: 'in', value: '', values: [] }]);
  const removeFilter = (i: number) => onChange(filters.filter((_, idx) => idx !== i));

  const setFilterField = (i: number, field: string) => {
    const next = [...filters];
    next[i] = { field, operator: 'in', value: '', values: [] };
    onChange(next);
  };

  const setFilterValues = (i: number, values: string[]) => {
    const next = [...filters];
    next[i] = { ...next[i], operator: 'in', values, value: values.join('||') };
    onChange(next);
  };

  const totalSelected = filters.reduce((sum, f) => sum + (f.values?.length || 0), 0);

  if (fields.length === 0 && branchSlug) return null;

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-brand-purple"
      >
        <AdjustmentsHorizontalIcon className="h-3.5 w-3.5" />
        Lead vereisten
        {totalSelected > 0 && <span className="rounded-full bg-brand-purple/10 px-1.5 py-0.5 text-[10px] font-bold text-brand-purple">{totalSelected}</span>}
        <ChevronDownIcon className={`h-3 w-3 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
          {filters.length === 0 && (
            <p className="text-[11px] text-slate-400">Geen filters. Alle leads die in het targetgebied vallen worden toegewezen.</p>
          )}
          {filters.map((f, i) => {
            const fieldDef = fields.find(fd => fd.key === f.field);
            return (
              <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <label className="mb-0.5 block text-[10px] font-medium text-slate-400">Veld</label>
                    <select value={f.field} onChange={e => setFilterField(i, e.target.value)}
                      className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-brand-purple/50">
                      <option value="">Kies veld...</option>
                      <optgroup label="Branche velden">
                        {fields.filter(fd => !fd.id.startsWith('_')).map(fd => (
                          <option key={fd.key} value={fd.key}>{fd.label}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Standaard velden">
                        {STANDARD_FILTER_FIELDS.map(fd => (
                          <option key={fd.key} value={fd.key}>{fd.label}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                  <button onClick={() => removeFilter(i)}
                    className="mt-4 shrink-0 rounded p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500">
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </div>

                {f.field && (
                  <>
                    <p className="mt-2 text-[10px] font-medium text-slate-400">
                      Selecteer toegestane waarden voor "{fieldDef?.label || f.field}"
                    </p>
                    <FilterFieldValues
                      branchSlug={branchSlug}
                      fieldKey={f.field}
                      selected={f.values || []}
                      onChange={vals => setFilterValues(i, vals)}
                    />
                    {(f.values?.length || 0) > 0 && (
                      <p className="mt-1.5 text-[10px] text-brand-purple">
                        {f.values!.length} {f.values!.length === 1 ? 'waarde' : 'waarden'} geselecteerd
                      </p>
                    )}
                  </>
                )}
              </div>
            );
          })}
          <button onClick={addFilter}
            className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-2.5 py-1.5 text-[11px] font-medium text-slate-500 transition hover:border-brand-purple/40 hover:text-brand-purple">
            <PlusIcon className="h-3 w-3" /> Veld filter toevoegen
          </button>
        </div>
      )}
    </div>
  );
}

function BatchesPanel({ customer, branchOptions, onClose }: { customer: Customer; branchOptions: BranchOption[]; onClose: () => void }) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<{ branch: string; batch_size: number; price_per_lead: string; leads_per_day: string; leads_per_week: string; lookback_days: string; notes: string; lead_filters: LeadFilter[] }>({ branch: '', batch_size: 100, price_per_lead: '', leads_per_day: '', leads_per_week: '', lookback_days: '3', notes: '', lead_filters: [] });
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
    try {
      const res = await adminFetch('/api/admin/batches', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: customer.id,
          branch: form.branch,
          batch_size: form.batch_size,
          price_per_lead: form.price_per_lead ? parseFloat(form.price_per_lead) : null,
          leads_per_day: form.leads_per_day ? parseInt(form.leads_per_day) : null,
          leads_per_week: form.leads_per_week ? parseInt(form.leads_per_week) : null,
          lookback_days: parseInt(form.lookback_days) || 0,
          notes: form.notes || null,
          lead_filters: form.lead_filters.filter(f => f.field && (f.values?.length || 0) > 0),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || 'Batch aanmaken mislukt');
        setSaving(false);
        return;
      }
      setShowAdd(false);
      setForm({ branch: '', batch_size: 100, price_per_lead: '', leads_per_day: '', leads_per_week: '', lookback_days: '3', notes: '', lead_filters: [] });
      fetchBatches();
    } catch {
      alert('Er ging iets mis');
    }
    setSaving(false);
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
                  <label className="mb-1 block text-xs font-medium text-slate-500">Prijs/lead</label>
                  <input type="number" step="0.01" value={form.price_per_lead} onChange={e => setForm(f => ({ ...f, price_per_lead: e.target.value }))}
                    placeholder="€" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
                </div>
              </div>
              <div className="mb-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Max per dag</label>
                  <input type="number" value={form.leads_per_day} onChange={e => setForm(f => ({ ...f, leads_per_day: e.target.value }))}
                    placeholder="Onbeperkt" min={1}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Max per week</label>
                  <input type="number" value={form.leads_per_week} onChange={e => setForm(f => ({ ...f, leads_per_week: e.target.value }))}
                    placeholder="Onbeperkt" min={1}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
                </div>
              </div>
              <div className="mb-3">
                <label className="mb-1 block text-xs font-medium text-slate-500">Lookback dagen</label>
                <div className="flex items-center gap-2">
                  <input type="number" value={form.lookback_days} onChange={e => setForm(f => ({ ...f, lookback_days: e.target.value }))}
                    min={0} max={30}
                    className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-2 text-center text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
                  <div className="flex gap-1">
                    {[0, 1, 3, 7].map(d => (
                      <button key={d} type="button" onClick={() => setForm(f => ({ ...f, lookback_days: String(d) }))}
                        className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${form.lookback_days === String(d) ? 'bg-brand-purple text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                        {d === 0 ? 'Geen' : `${d}d`}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="mt-1 text-[10px] text-slate-400">
                  {form.lookback_days === '0' ? 'Alleen nieuwe leads' : `Bestaande leads van ${form.lookback_days || 3} dag(en) toewijzen`}
                </p>
              </div>
              <div className="mb-3">
                <label className="mb-1 block text-xs font-medium text-slate-500">Notities</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
              </div>
              {form.branch && (
                <FilterBuilder
                  filters={form.lead_filters}
                  onChange={filters => setForm(f => ({ ...f, lead_filters: filters }))}
                  branchSlug={form.branch}
                />
              )}
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
                      {b.leads_per_day && (
                        <span className="font-medium text-brand-purple">{b.leads_per_day}/dag</span>
                      )}
                      {b.leads_per_week && (
                        <span className="font-medium text-brand-purple">{b.leads_per_week}/week</span>
                      )}
                      {b.price_per_lead && (
                        <span>€{Number(b.price_per_lead).toFixed(2)}/lead</span>
                      )}
                      {b.total_price && (
                        <span>Totaal: €{Number(b.total_price).toFixed(2)}</span>
                      )}
                      <span>{new Date(b.created_at).toLocaleDateString('nl-NL')}</span>
                      {b.notes && <span className="italic">{b.notes}</span>}
                    </div>

                    {/* Lead Filters */}
                    {b.lead_filters && b.lead_filters.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <AdjustmentsHorizontalIcon className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                        {b.lead_filters.map((f, i) => {
                          const count = f.values?.length || (f.value ? 1 : 0);
                          return (
                            <span key={i} className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                              {f.field}: {count} {count === 1 ? 'waarde' : 'waarden'}
                            </span>
                          );
                        })}
                      </div>
                    )}
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

/* ─── Lead Manager Panel ───────────────────────────────── */

interface AssignedLead {
  id: string;
  naam_klant: string;
  email: string;
  branch: string;
  postcode: string;
  plaatsnaam: string;
  status: string;
  created_at: string;
  assignment_id: string;
  batch_id: string | null;
  assigned_at: string;
}

function LeadManagerPanel({ customer, onClose }: {
  customer: Customer;
  onClose: () => void;
}) {
  const [leads, setLeads] = useState<AssignedLead[]>([]);
  const [batches, setBatches] = useState<{ id: string; branch: string; batch_size: number; leads_delivered: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [batchFilter, setBatchFilter] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const lastChecked = useRef<number | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch(`/api/admin/assignments?customer_id=${customer.id}`);
      if (res.ok) {
        const data = await res.json();
        const mapped: AssignedLead[] = (data || []).map((a: any) => ({
          id: a.lead_id,
          naam_klant: a.leads?.naam_klant || '',
          email: a.leads?.email || '',
          branch: a.leads?.branch || '',
          postcode: a.leads?.postcode || '',
          plaatsnaam: a.leads?.plaatsnaam || '',
          status: '',
          created_at: '',
          assignment_id: a.id,
          batch_id: a.batch_id,
          assigned_at: a.assigned_at,
        }));
        setLeads(mapped);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [customer.id]);

  const fetchBatches = useCallback(async () => {
    try {
      const res = await adminFetch(`/api/admin/batches?customer_id=${customer.id}`);
      if (res.ok) {
        const data = await res.json();
        setBatches((data || []).map((b: any) => ({
          id: b.id,
          branch: b.branch,
          batch_size: b.batch_size,
          leads_delivered: b.leads_delivered,
        })));
      }
    } catch { /* ignore */ }
  }, [customer.id]);

  useEffect(() => { fetchLeads(); fetchBatches(); }, [fetchLeads, fetchBatches]);

  const filtered = useMemo(() => {
    let list = leads;
    if (branchFilter !== 'all') list = list.filter(l => l.branch === branchFilter);
    if (batchFilter !== 'all') list = list.filter(l => l.batch_id === batchFilter);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(l =>
        l.naam_klant.toLowerCase().includes(s) ||
        l.email.toLowerCase().includes(s) ||
        l.postcode.toLowerCase().includes(s) ||
        l.plaatsnaam.toLowerCase().includes(s)
      );
    }
    return list;
  }, [leads, branchFilter, batchFilter, search]);

  const uniqueBranches = useMemo(() => [...new Set(leads.map(l => l.branch))].filter(Boolean), [leads]);
  const allFilteredSelected = filtered.length > 0 && filtered.every(l => selected.has(l.id));

  const toggleAll = () => {
    if (allFilteredSelected) {
      const filteredIds = new Set(filtered.map(l => l.id));
      setSelected(prev => { const next = new Set(prev); filteredIds.forEach(id => next.delete(id)); return next; });
    } else {
      setSelected(prev => { const next = new Set(prev); filtered.forEach(l => next.add(l.id)); return next; });
    }
  };

  const toggleOne = (leadId: string, index: number, shiftKey: boolean) => {
    if (shiftKey && lastChecked.current !== null) {
      const start = Math.min(lastChecked.current, index);
      const end = Math.max(lastChecked.current, index);
      const range = filtered.slice(start, end + 1).map(l => l.id);
      setSelected(prev => {
        const next = new Set(prev);
        const shouldSelect = !prev.has(leadId);
        range.forEach(id => shouldSelect ? next.add(id) : next.delete(id));
        return next;
      });
    } else {
      setSelected(prev => {
        const next = new Set(prev);
        next.has(leadId) ? next.delete(leadId) : next.add(leadId);
        return next;
      });
    }
    lastChecked.current = index;
  };

  const bulkUnassign = async () => {
    const count = selected.size;
    if (count === 0) return;

    const threshold = 50;
    const msg = count > threshold
      ? `Je staat op het punt ${count} leads los te koppelen van ${customer.name}. Dit kan niet ongedaan worden gemaakt. Typ "BEVESTIG" om door te gaan.`
      : `${count} lead${count > 1 ? 's' : ''} loskoppelen van ${customer.name}?`;

    if (count > threshold) {
      const input = prompt(msg);
      if (input !== 'BEVESTIG') return;
    } else {
      if (!confirm(msg)) return;
    }

    setDeleting(true);
    try {
      const res = await adminFetch('/api/admin/assignments/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: customer.id,
          lead_ids: Array.from(selected),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        showToast(`${data.deleted} lead${data.deleted !== 1 ? 's' : ''} losgekoppeld, ${data.batches_synced} batch${data.batches_synced !== 1 ? 'es' : ''} bijgewerkt`);
        setSelected(new Set());
        fetchLeads();
        fetchBatches();
      } else {
        const d = await res.json().catch(() => ({}));
        showToast(d.error || 'Loskoppelen mislukt', 'error');
      }
    } catch {
      showToast('Er ging iets mis', 'error');
    }
    setDeleting(false);
  };

  const unassignAll = async () => {
    if (filtered.length === 0) return;

    const count = filtered.length;
    const input = prompt(
      `ALLE ${count} zichtbare leads loskoppelen van ${customer.name}? Dit kan niet ongedaan worden gemaakt.\n\nTyp "BEVESTIG" om door te gaan.`
    );
    if (input !== 'BEVESTIG') return;

    setDeleting(true);
    try {
      const body: Record<string, unknown> = { customer_id: customer.id, all: true };
      const filters: Record<string, string> = {};
      if (branchFilter !== 'all') filters.branch = branchFilter;
      if (batchFilter !== 'all') filters.batch_id = batchFilter;
      if (search) filters.search = search;
      if (Object.keys(filters).length > 0) body.filters = filters;

      const res = await adminFetch('/api/admin/assignments/bulk-delete', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        showToast(`${data.deleted} lead${data.deleted !== 1 ? 's' : ''} losgekoppeld`);
        setSelected(new Set());
        fetchLeads();
        fetchBatches();
      } else {
        const d = await res.json().catch(() => ({}));
        showToast(d.error || 'Loskoppelen mislukt', 'error');
      }
    } catch {
      showToast('Er ging iets mis', 'error');
    }
    setDeleting(false);
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-2xl flex-col bg-white shadow-2xl">

        {/* Header */}
        <div className="shrink-0 border-b border-slate-100">
          <div className="h-[3px] bg-gradient-to-r from-red-500 to-amber-500" />
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Leads beheren</h2>
              <p className="mt-0.5 text-xs text-slate-500">{customer.name} &middot; {leads.length} leads gekoppeld</p>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="shrink-0 border-b border-slate-100 px-5 py-3 space-y-2">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Zoek op naam, e-mail, postcode, plaats..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-brand-purple/50 focus:bg-white" />
          </div>
          <div className="flex gap-2">
            <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 outline-none">
              <option value="all">Alle branches</option>
              {uniqueBranches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <select value={batchFilter} onChange={e => setBatchFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 outline-none">
              <option value="all">Alle batches</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>{b.branch} ({b.leads_delivered}/{b.batch_size})</option>
              ))}
            </select>
            <button onClick={fetchLeads} disabled={loading}
              className="ml-auto rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:bg-slate-50 disabled:opacity-50">
              <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Selection bar */}
        <AnimatePresence>
          {selected.size > 0 && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="shrink-0 overflow-hidden border-b border-red-100 bg-red-50">
              <div className="flex items-center justify-between px-5 py-2.5">
                <span className="text-sm font-medium text-red-700">{selected.size} lead{selected.size !== 1 ? 's' : ''} geselecteerd</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelected(new Set())}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-white">
                    Deselecteren
                  </button>
                  <button onClick={bulkUnassign} disabled={deleting}
                    className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-50">
                    {deleting ? <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" /> : <LinkSlashIcon className="h-3.5 w-3.5" />}
                    Loskoppelen
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Lead list */}
        <div className="flex-1 overflow-y-auto">
          {loading && leads.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-slate-400">
              <ArrowPathIcon className="mr-2 h-5 w-5 animate-spin" /> Laden...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-400">
              {leads.length === 0 ? 'Geen leads gekoppeld aan deze klant' : 'Geen leads gevonden met deze filters'}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm">
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-2.5 w-10">
                    <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-brand-purple focus:ring-brand-purple/30" />
                  </th>
                  <th className="px-3 py-2.5">Naam</th>
                  <th className="hidden px-3 py-2.5 sm:table-cell">E-mail</th>
                  <th className="px-3 py-2.5">Branche</th>
                  <th className="hidden px-3 py-2.5 sm:table-cell">Plaats</th>
                  <th className="px-3 py-2.5">Toegewezen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((lead, idx) => (
                  <tr key={lead.assignment_id}
                    className={`transition ${selected.has(lead.id) ? 'bg-red-50/50' : 'hover:bg-slate-50/50'}`}>
                    <td className="px-4 py-2.5">
                      <input type="checkbox" checked={selected.has(lead.id)}
                        onChange={(e) => toggleOne(lead.id, idx, (e.nativeEvent as MouseEvent).shiftKey)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-brand-purple focus:ring-brand-purple/30" />
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-slate-900 truncate max-w-[140px]">{lead.naam_klant || '-'}</p>
                    </td>
                    <td className="hidden px-3 py-2.5 sm:table-cell">
                      <span className="text-xs text-slate-500 truncate max-w-[160px] block">{lead.email || '-'}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-full bg-brand-purple/10 px-2 py-0.5 text-[10px] font-medium text-brand-purple">{lead.branch || '-'}</span>
                    </td>
                    <td className="hidden px-3 py-2.5 sm:table-cell text-xs text-slate-500">{lead.plaatsnaam || '-'}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-400">
                      {new Date(lead.assigned_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-100 px-5 py-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              {filtered.length} van {leads.length} leads zichtbaar
            </p>
            {filtered.length > 0 && (
              <button onClick={unassignAll} disabled={deleting}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-50">
                <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                Alle zichtbare loskoppelen ({filtered.length})
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-6 right-6 z-[100] flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium text-white shadow-lg ${
              toast.type === 'error' ? 'bg-red-600' : 'bg-slate-900'
            }`}>
            {toast.type === 'error' ? <ExclamationTriangleIcon className="h-4 w-4 text-red-200" /> : <CheckCircleIcon className="h-4 w-4 text-emerald-400" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
