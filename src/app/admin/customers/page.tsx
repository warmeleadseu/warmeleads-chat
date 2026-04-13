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
import { useAdmin } from '../adminContext';

interface Customer {
  id: string; name: string; contact_person: string; email: string; phone: string;
  branches: string[]; is_active: boolean; portal_active: boolean; has_password?: boolean; portal_password?: string | null; notes: string; created_at: string;
  lead_count?: number;
  bulk_lead_count?: number;
  bulk_price_per_lead?: number | null;
  last_login_at?: string | null;
  login_count?: number;
  exclude_customers?: string[];
  account_manager_id?: string | null;
  kvk_nummer?: string | null;
  address?: string | null;
  vat_id?: string | null;
}

interface KvkResult {
  kvkNummer: string;
  vestigingsnummer: string;
  naam: string;
  type: string;
  actief: boolean;
  straatnaam: string;
  huisnummer: string;
  postcode: string;
  plaats: string;
}

interface KvkDetail {
  kvkNummer: string;
  naam: string;
  rsin: string;
  vestigingsnummer: string | null;
  adres: string;
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
  id: string; customer_id: string; label: string; lat: number | null; lng: number | null;
  radius_km: number; is_active: boolean; created_at: string;
  target_type: 'radius' | 'province'; provinces: string[];
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

interface AccountManager { id: string; name: string; role: string }

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [branchOptions, setBranchOptions] = useState<BranchOption[]>([]);
  const [accountManagers, setAccountManagers] = useState<AccountManager[]>([]);
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
  const [pricingFor, setPricingFor] = useState<Customer | null>(null);
  const [allBatches, setAllBatches] = useState<Batch[]>([]);
  const [search, setSearch] = useState('');
  const [activityFilter, setActivityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const [reminderSent, setReminderSent] = useState<Set<string>>(new Set());
  const [previewReminder, setPreviewReminder] = useState<Customer | null>(null);
  const [impersonating, setImpersonating] = useState<string | null>(null);

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

  useEffect(() => {
    adminFetch('/api/admin/users').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.users) setAccountManagers(d.users.filter((u: any) => u.is_active && u.is_account_manager));
    }).catch(() => {});
  }, []);

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

  const impersonateCustomer = async (customerId: string) => {
    setImpersonating(customerId);
    try {
      const res = await adminFetch('/api/admin/impersonate', {
        method: 'POST',
        body: JSON.stringify({ customer_id: customerId }),
      });
      if (!res.ok) { const d = await res.json(); alert(d.error || 'Impersonatie mislukt'); return; }
      const { token } = await res.json();
      window.open(`/portal?impersonate=${token}`, '_blank');
    } catch { alert('Er ging iets mis'); }
    setImpersonating(null);
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
                  {c.phone && <p className="mb-0.5 text-xs text-slate-500">{c.phone}</p>}
                  {c.account_manager_id && (() => {
                    const am = accountManagers.find(a => a.id === c.account_manager_id);
                    return am ? <p className="mb-0.5 text-xs text-amber-600 font-medium">AM: {am.name}</p> : null;
                  })()}
                  <div className="mb-2" />

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
                        <button
                          onClick={() => impersonateCustomer(c.id)}
                          disabled={impersonating === c.id}
                          className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
                        >
                          {impersonating === c.id ? (
                            <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <EyeIcon className="h-3.5 w-3.5" />
                          )}
                          Bekijk portaal
                        </button>
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

                {/* Lead exclusies (bidirectioneel) */}
                {(() => {
                  const direct = c.exclude_customers || [];
                  const reverse = customers.filter(
                    other => other.id !== c.id && (other.exclude_customers || []).includes(c.id)
                  ).map(o => o.id);
                  const allExIds = [...new Set([...direct, ...reverse])];
                  if (allExIds.length === 0) return null;
                  return (
                    <div className="border-t border-slate-100 px-5 py-3">
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-red-400">Lead exclusies</p>
                      <div className="flex flex-wrap gap-1">
                        {allExIds.map(exId => {
                          const exCust = customers.find(x => x.id === exId);
                          return (
                            <span key={exId} className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                              <LinkSlashIcon className="h-3 w-3" />
                              {exCust?.name || 'Onbekend'}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

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

                {/* Middle actions - Targets, Pricing, Batches & Lead Manager */}
                <div className="grid grid-cols-2 border-t border-slate-100 sm:grid-cols-4">
                  <button onClick={() => setTargetsFor(c)} className="flex items-center justify-center gap-1.5 border-b border-r border-slate-100 py-2.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-brand-purple sm:border-b-0">
                    <MapPinIcon className="h-3.5 w-3.5" /> Targets
                  </button>
                  <button onClick={() => setPricingFor(c)} className="flex items-center justify-center gap-1.5 border-b border-slate-100 py-2.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-amber-600 sm:border-b-0 sm:border-r">
                    <CurrencyEuroIcon className="h-3.5 w-3.5" /> Prijzen
                  </button>
                  <button onClick={() => setBatchesFor(c)} className="flex items-center justify-center gap-1.5 border-r border-slate-100 py-2.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-brand-purple">
                    <ChartBarIcon className="h-3.5 w-3.5" /> Batches
                  </button>
                  <button onClick={() => setLeadsFor(c)} className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-red-500">
                    <LinkSlashIcon className="h-3.5 w-3.5" /> Leads
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
            allCustomers={customers}
            accountManagers={accountManagers}
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
        {pricingFor && (
          <CustomerPricingPanel
            customer={pricingFor}
            branchOptions={branchOptions}
            onClose={() => setPricingFor(null)}
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
        <p style="color: rgba(255,255,255,0.7); margin: 14px 0 0; font-size: 13px; letter-spacing: 0.5px;">JOUW PERSOONLIJKE LEADPORTAAL</p>
      </div>
      <div style="margin: 0 20px; background: #ffffff; border-radius: 16px; padding: 36px 32px; position: relative; top: -8px;">
        <p style="color: #1A1A2E; font-size: 18px; font-weight: 700; line-height: 1.4; margin: 0 0 8px;">Hallo ${greeting},</p>
        <p style="color: #475569; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
          Je persoonlijke leadportaal staat klaar! Hier vind je al je leads overzichtelijk op een plek, kun je nieuwe batches bestellen en je account beheren.
        </p>
        ${customer.portal_password ? `
        <div style="background: linear-gradient(135deg, #FFF5F0 0%, #FFF0F5 100%); border: 1px solid #FFE0D0; border-radius: 14px; padding: 24px; margin: 0 0 28px;">
          <p style="color: #FF6B35; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 16px;">Je inloggegevens</p>
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
            Ga naar je portaal &rarr;
          </a>
        </div>
        <div style="border-top: 1px solid #f1f5f9; padding-top: 20px;">
          <p style="color: #94a3b8; font-size: 13px; line-height: 1.6; margin: 0; text-align: center;">
            <strong style="color: #64748b;">Tip:</strong> Installeer het portaal als app op je telefoon voor snelle toegang en pushnotificaties.
          </p>
        </div>
      </div>
      <div style="padding: 28px 32px; text-align: center;">
        <p style="color: rgba(255,255,255,0.3); font-size: 12px; margin: 0;">WarmeLeads &middot; Jouw partner in exclusieve leads</p>
      </div>
    </div>
  `;

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className="flex max-h-[85vh] w-full max-w-[640px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        >
          {/* Header */}
          <div className="shrink-0 border-b border-slate-100">
            <div className="h-[3px] bg-warmeleads-gradient" />
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">E-mail preview</h2>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                  <span>Naar: <span className="font-medium text-slate-700">{customer.email}</span></span>
                  <span>Onderwerp: <span className="font-medium text-slate-700">Je WarmeLeads portaal staat klaar!</span></span>
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
      </div>
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

function CustomerForm({ customer, branchOptions, allCustomers, accountManagers, onClose, onSaved }: { customer: Customer | null; branchOptions: BranchOption[]; allCustomers: Customer[]; accountManagers: AccountManager[]; onClose: () => void; onSaved: () => void }) {
  const { user: currentUser } = useAdmin();
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
    exclude_customers: customer?.exclude_customers || [] as string[],
    account_manager_id: customer?.account_manager_id || '',
    bulk_price_per_lead: customer?.bulk_price_per_lead != null ? String(customer.bulk_price_per_lead) : '',
    kvk_nummer: customer?.kvk_nummer || '',
    address: customer?.address || '',
    vat_id: customer?.vat_id || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [excludeSearch, setExcludeSearch] = useState('');
  const [excludeOpen, setExcludeOpen] = useState(false);
  const excludeRef = useRef<HTMLDivElement>(null);

  // KVK search state
  const [kvkQuery, setKvkQuery] = useState('');
  const [kvkResults, setKvkResults] = useState<KvkResult[]>([]);
  const [kvkSearching, setKvkSearching] = useState(false);
  const [kvkLoading, setKvkLoading] = useState(false);
  const [kvkLinked, setKvkLinked] = useState(!!customer?.kvk_nummer);
  const [kvkOpen, setKvkOpen] = useState(false);
  const [kvkError, setKvkError] = useState('');
  const kvkRef = useRef<HTMLDivElement>(null);
  const kvkAbort = useRef<AbortController | null>(null);
  const kvkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (excludeRef.current && !excludeRef.current.contains(e.target as Node)) {
        setExcludeOpen(false);
      }
      if (kvkRef.current && !kvkRef.current.contains(e.target as Node)) {
        setKvkOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      if (kvkTimer.current) clearTimeout(kvkTimer.current);
      if (kvkAbort.current) kvkAbort.current.abort();
    };
  }, []);

  const searchKvk = useCallback((q: string) => {
    if (kvkTimer.current) clearTimeout(kvkTimer.current);
    if (kvkAbort.current) kvkAbort.current.abort();
    setKvkError('');

    if (q.length < 2) {
      setKvkResults([]);
      setKvkOpen(false);
      setKvkSearching(false);
      return;
    }

    setKvkSearching(true);
    kvkTimer.current = setTimeout(async () => {
      const ctrl = new AbortController();
      kvkAbort.current = ctrl;
      try {
        const res = await adminFetch(`/api/admin/kvk?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (ctrl.signal.aborted) return;
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setKvkError(d.error || 'KVK zoeken mislukt');
          setKvkResults([]);
          setKvkOpen(false);
        } else {
          const data = await res.json();
          setKvkResults(data.resultaten || []);
          setKvkError('');
          setKvkOpen(true);
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          setKvkError('KVK zoeken niet beschikbaar');
          setKvkResults([]);
          setKvkOpen(false);
        }
      } finally {
        setKvkSearching(false);
      }
    }, 500);
  }, []);

  const selectKvkResult = useCallback(async (r: KvkResult) => {
    setKvkOpen(false);
    setKvkLoading(true);
    setKvkError('');

    const fmtPc = (pc: string) => { const raw = pc.replace(/\s/g, ''); return /^\d{4}[A-Za-z]{2}$/.test(raw) ? `${raw.slice(0, 4)} ${raw.slice(4).toUpperCase()}` : pc; };
    const searchAdres = [
      [r.straatnaam, r.huisnummer].filter(Boolean).join(' '),
      [r.postcode ? fmtPc(r.postcode) : '', r.plaats].filter(Boolean).join('  '),
    ].filter(Boolean).join('\n');

    try {
      const res = await adminFetch(`/api/admin/kvk?kvk=${r.kvkNummer}`);
      if (!res.ok) throw new Error('Detail ophalen mislukt');
      const detail: KvkDetail = await res.json();
      setForm(f => ({
        ...f,
        name: detail.naam || f.name,
        kvk_nummer: detail.kvkNummer,
        address: detail.adres || searchAdres || f.address,
      }));
      setKvkLinked(true);
      setKvkQuery('');
    } catch {
      setForm(f => ({
        ...f,
        name: r.naam || f.name,
        kvk_nummer: r.kvkNummer,
        address: searchAdres || f.address,
      }));
      setKvkLinked(true);
      setKvkQuery('');
      setKvkError('Detail ophalen mislukt, basisgegevens overgenomen');
    } finally {
      setKvkLoading(false);
    }
  }, []);

  const unlinkKvk = useCallback(() => {
    setKvkLinked(false);
    setForm(f => ({ ...f, kvk_nummer: '' }));
  }, []);

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
      const { password, bulk_price_per_lead: bulkStr, kvk_nummer, address: addr, vat_id: vat, ...rest } = form;
      const payload: Record<string, unknown> = { ...rest };
      if (password) payload.password = password;
      payload.bulk_price_per_lead = bulkStr ? parseFloat(bulkStr) : null;
      payload.kvk_nummer = kvk_nummer || null;
      payload.address = addr || null;
      payload.vat_id = vat || null;
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

          {/* KVK Zoeken */}
          <div ref={kvkRef} className="rounded-lg border border-purple-200 bg-purple-50/30 p-3">
            {kvkLinked && form.kvk_nummer ? (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircleIcon className="h-5 w-5 flex-shrink-0 text-emerald-500" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{form.name}</p>
                    <p className="text-[11px] text-slate-500">KVK {form.kvk_nummer}</p>
                  </div>
                </div>
                <button type="button" onClick={unlinkKvk}
                  className="rounded-md px-2 py-1 text-[11px] font-medium text-purple-600 hover:bg-purple-100 transition">
                  Ontkoppelen
                </button>
              </div>
            ) : (
              <>
                <p className="mb-1.5 text-xs font-medium text-purple-700">KVK Zoeken</p>
                <div className="relative">
                  <div className="relative">
                    <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-400" />
                    {kvkSearching && (
                      <ArrowPathIcon className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-purple-400" />
                    )}
                    <input
                      type="text"
                      value={kvkQuery}
                      onChange={e => { setKvkQuery(e.target.value); searchKvk(e.target.value); }}
                      onFocus={() => { if (kvkResults.length > 0) setKvkOpen(true); }}
                      placeholder="Zoek op bedrijfsnaam of KVK-nummer..."
                      className="w-full rounded-lg border border-purple-200 bg-white py-2 pl-8 pr-8 text-sm text-slate-900 outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/20"
                    />
                  </div>
                  {kvkOpen && !kvkLoading && (
                    <div className="absolute left-0 right-0 z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                      {kvkResults.length > 0 ? kvkResults.map(r => (
                        <button key={`${r.kvkNummer}-${r.vestigingsnummer}`} type="button"
                          onClick={() => selectKvkResult(r)}
                          className="flex w-full flex-col gap-0.5 border-b border-slate-50 px-3 py-2.5 text-left hover:bg-purple-50/50 last:border-0"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-slate-800">{r.naam}</span>
                            {r.type && (
                              <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                r.type === 'hoofdvestiging' ? 'bg-brand-purple/10 text-brand-purple' : 'bg-slate-100 text-slate-500'
                              }`}>
                                {r.type === 'hoofdvestiging' ? 'Hoofdvestiging' : r.type === 'nevenvestiging' ? 'Nevenvestiging' : r.type}
                              </span>
                            )}
                            {!r.actief && (
                              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">Uitgeschreven</span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500">
                            KVK {r.kvkNummer}{r.plaats ? ` · ${r.plaats}` : ''}{r.straatnaam ? ` · ${r.straatnaam} ${r.huisnummer}` : ''}
                          </span>
                        </button>
                      )) : (
                        <p className="px-3 py-2.5 text-xs text-slate-400">
                          Geen bedrijven gevonden voor &ldquo;{kvkQuery}&rdquo;
                        </p>
                      )}
                    </div>
                  )}
                </div>
                {kvkLoading && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-purple-600">
                    <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                    Bedrijfsgegevens ophalen...
                  </div>
                )}
                {kvkError && (
                  <p className="mt-1.5 text-[11px] text-red-500">{kvkError}</p>
                )}
              </>
            )}
          </div>

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
            <label className="mb-1 block text-xs font-medium text-slate-500">Adres</label>
            <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              placeholder={"Straatnaam 123\n1234 AB Plaats"}
              rows={2}
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm leading-relaxed text-slate-900 outline-none focus:border-brand-purple/50" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">KVK-nummer</label>
              <input value={form.kvk_nummer}
                onChange={kvkLinked ? undefined : e => setForm(f => ({ ...f, kvk_nummer: e.target.value }))}
                readOnly={kvkLinked}
                maxLength={8}
                inputMode="numeric"
                placeholder="12345678"
                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                  kvkLinked
                    ? 'border-purple-200 bg-purple-50/50 text-purple-700 cursor-not-allowed'
                    : 'border-slate-200 text-slate-900 focus:border-brand-purple/50'
                }`} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">BTW-nummer</label>
              <input value={form.vat_id} onChange={e => setForm(f => ({ ...f, vat_id: e.target.value }))}
                placeholder="NL123456789B01"
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
          {currentUser.role !== 'accountmanager' && accountManagers.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Accountmanager</label>
              <select
                value={form.account_manager_id}
                onChange={e => setForm(f => ({ ...f, account_manager_id: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
              >
                <option value="">Geen accountmanager</option>
                {accountManagers.map(am => (
                  <option key={am.id} value={am.id}>{am.name}</option>
                ))}
              </select>
            </div>
          )}
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
          {/* Lead exclusies */}
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
            <div className="mb-2">
              <p className="text-sm font-medium text-slate-700">Lead exclusies</p>
              <p className="text-[11px] text-slate-400">
                Leads die al zijn uitgedeeld aan onderstaande klanten worden niet aan deze klant toegewezen (en vice versa).
              </p>
            </div>
            {form.exclude_customers.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {form.exclude_customers.map(exId => {
                  const exCust = allCustomers.find(c => c.id === exId);
                  return (
                    <span key={exId} className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-semibold text-red-700">
                      <LinkSlashIcon className="h-3 w-3" />
                      {exCust?.name || 'Onbekend'}
                      <button type="button" onClick={() => setForm(f => ({ ...f, exclude_customers: f.exclude_customers.filter(id => id !== exId) }))}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-red-200">
                        <XMarkIcon className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            <div className="relative" ref={excludeRef}>
              <div className="relative">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={excludeSearch}
                  onChange={e => { setExcludeSearch(e.target.value); setExcludeOpen(true); }}
                  onFocus={() => setExcludeOpen(true)}
                  placeholder="Zoek klant om toe te voegen..."
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm text-slate-900 outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/20"
                />
              </div>
              {excludeOpen && (() => {
                const available = allCustomers
                  .filter(c => c.id !== customer?.id && !form.exclude_customers.includes(c.id))
                  .filter(c => !excludeSearch || c.name.toLowerCase().includes(excludeSearch.toLowerCase()));
                return (
                  <div className="absolute left-0 right-0 z-20 mt-1 max-h-44 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                    {available.length > 0 ? available.map(c => (
                      <button key={c.id} type="button"
                        onClick={() => {
                          setForm(f => ({ ...f, exclude_customers: [...f.exclude_customers, c.id] }));
                          setExcludeSearch('');
                          setExcludeOpen(false);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <LinkSlashIcon className="h-3.5 w-3.5 text-slate-400" />
                        <span>{c.name}</span>
                        {!c.is_active && <span className="text-[10px] text-slate-400">(inactief)</span>}
                      </button>
                    )) : (
                      <p className="px-3 py-2 text-xs text-slate-400">Geen klanten gevonden</p>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Notities</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
          </div>

          {/* Bulk pricing */}
          {isEdit && (customer?.bulk_lead_count ?? 0) > 0 && (
            <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-3">
              <div className="mb-2">
                <p className="text-sm font-medium text-slate-700">Bulk leads</p>
                <p className="text-[11px] text-slate-400">
                  Deze klant heeft {customer?.bulk_lead_count?.toLocaleString('nl-NL')} bulk-uitgedeelde leads (zonder batch). Stel een prijs per lead in om de omzet mee te tellen.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Prijs per bulk lead (&euro;)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.bulk_price_per_lead}
                  onChange={e => setForm(f => ({ ...f, bulk_price_per_lead: e.target.value }))}
                  placeholder="Bijv. 5.00"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400/50"
                />
                {form.bulk_price_per_lead && (
                  <p className="mt-1 text-[11px] text-sky-600">
                    Geschatte bulk omzet: &euro;{((customer?.bulk_lead_count || 0) * parseFloat(form.bulk_price_per_lead || '0')).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                )}
              </div>
            </div>
          )}
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

const PROVINCES_NL = ['Drenthe', 'Flevoland', 'Friesland', 'Gelderland', 'Groningen', 'Limburg', 'Noord-Brabant', 'Noord-Holland', 'Overijssel', 'Utrecht', 'Zeeland', 'Zuid-Holland'];
const PROVINCES_BE = ['Antwerpen', 'Brussels', 'Henegouwen', 'Luik', 'Luxemburg', 'Namen', 'Oost-Vlaanderen', 'Vlaams-Brabant', 'Waals-Brabant', 'West-Vlaanderen'];

function TargetsPanel({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState<false | 'radius' | 'province'>(false);
  const [saving, setSaving] = useState(false);

  // Radius form state
  const [cityQuery, setCityQuery] = useState('');
  const [cityResult, setCityResult] = useState<{ lat: number; lng: number; naam: string } | null>(null);
  const [citySearching, setCitySearching] = useState(false);
  const [cityError, setCityError] = useState('');
  const [newRadius, setNewRadius] = useState(25);
  const [newLabel, setNewLabel] = useState('');
  const searchTimer = useRef<NodeJS.Timeout | null>(null);

  // Province form state
  const [selectedProvinces, setSelectedProvinces] = useState<string[]>([]);
  const [provLabel, setProvLabel] = useState('');

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editRadius, setEditRadius] = useState(25);
  const [editCityQuery, setEditCityQuery] = useState('');
  const [editCityResult, setEditCityResult] = useState<{ lat: number; lng: number; naam: string } | null>(null);
  const [editCitySearching, setEditCitySearching] = useState(false);
  const [editCityError, setEditCityError] = useState('');
  const [editProvinces, setEditProvinces] = useState<string[]>([]);
  const editSearchTimer = useRef<NodeJS.Timeout | null>(null);

  const fetchTargets = useCallback(async () => {
    const res = await adminFetch(`/api/admin/targets?customer_id=${customer.id}`);
    if (res.ok) setTargets(await res.json());
    setLoading(false);
  }, [customer.id]);

  useEffect(() => { fetchTargets(); }, [fetchTargets]);

  const resetAddForm = () => {
    setShowAdd(false);
    setCityQuery(''); setCityResult(null); setCityError('');
    setNewLabel(''); setNewRadius(25);
    setSelectedProvinces([]); setProvLabel('');
  };

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

  const addRadiusTarget = async () => {
    if (!cityResult || !newLabel) return;
    setSaving(true);
    await adminFetch('/api/admin/targets', {
      method: 'POST',
      body: JSON.stringify({ customer_id: customer.id, label: newLabel, target_type: 'radius', lat: cityResult.lat, lng: cityResult.lng, radius_km: newRadius }),
    });
    setSaving(false);
    resetAddForm();
    fetchTargets();
  };

  const addProvinceTarget = async () => {
    if (selectedProvinces.length === 0) return;
    setSaving(true);
    const label = provLabel || selectedProvinces.join(', ');
    await adminFetch('/api/admin/targets', {
      method: 'POST',
      body: JSON.stringify({ customer_id: customer.id, label, target_type: 'province', provinces: selectedProvinces }),
    });
    setSaving(false);
    resetAddForm();
    fetchTargets();
  };

  const addPreset = async (preset: typeof COUNTRY_PRESETS[0]) => {
    setSaving(true);
    await adminFetch('/api/admin/targets', {
      method: 'POST',
      body: JSON.stringify({ customer_id: customer.id, label: preset.label, target_type: 'radius', lat: preset.lat, lng: preset.lng, radius_km: preset.radius }),
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

  const toggleProvince = (prov: string) => {
    setSelectedProvinces(prev => prev.includes(prov) ? prev.filter(p => p !== prov) : [...prev, prov]);
  };

  const startEdit = (t: Target) => {
    resetAddForm();
    setEditingId(t.id);
    setEditLabel(t.label);
    setEditRadius(t.radius_km);
    setEditCityQuery('');
    setEditCityResult(null);
    setEditCityError('');
    setEditProvinces([...(t.provinces || [])]);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditCityQuery('');
    setEditCityResult(null);
    setEditCityError('');
  };

  const searchEditCity = (q: string) => {
    setEditCityQuery(q);
    setEditCityResult(null);
    setEditCityError('');
    if (editSearchTimer.current) clearTimeout(editSearchTimer.current);
    if (q.trim().length < 2) return;
    editSearchTimer.current = setTimeout(async () => {
      setEditCitySearching(true);
      const res = await adminFetch(`/api/admin/city-lookup?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setEditCityResult(data);
        setEditLabel(data.naam);
      } else {
        setEditCityError('Plaats niet gevonden');
      }
      setEditCitySearching(false);
    }, 500);
  };

  const toggleEditProvince = (prov: string) => {
    setEditProvinces(prev => prev.includes(prov) ? prev.filter(p => p !== prov) : [...prev, prov]);
  };

  const saveEdit = async (t: Target) => {
    setSaving(true);
    const label = editLabel.trim() || (
      (t.target_type || 'radius') === 'province' ? editProvinces.join(', ') : t.label
    );
    const updates: Record<string, unknown> = { id: t.id, label };
    if ((t.target_type || 'radius') === 'radius') {
      updates.radius_km = editRadius;
      if (editCityResult) {
        updates.lat = editCityResult.lat;
        updates.lng = editCityResult.lng;
      }
    } else {
      updates.provinces = editProvinces;
    }
    await adminFetch('/api/admin/targets', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    setSaving(false);
    cancelEdit();
    fetchTargets();
  };

  const existingProvs = new Set(targets.filter(t => t.is_active).flatMap(t => t.provinces || []));

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

          {/* Add buttons / forms */}
          {showAdd === 'radius' ? (
            <div className="mb-5 rounded-xl border border-brand-purple/20 bg-brand-purple/5 p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Nieuw targetgebied (plaats + radius)</h3>
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
                <button onClick={resetAddForm}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50">Annuleren</button>
                <button onClick={addRadiusTarget} disabled={!cityResult || !newLabel || saving}
                  className="rounded-lg bg-button-gradient px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
                  {saving ? 'Opslaan...' : 'Toevoegen'}
                </button>
              </div>
            </div>
          ) : showAdd === 'province' ? (
            <div className="mb-5 rounded-xl border border-brand-purple/20 bg-brand-purple/5 p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Nieuw targetgebied (provincies)</h3>
              <div className="mb-3">
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Label (optioneel)</label>
                <input value={provLabel} onChange={e => setProvLabel(e.target.value)}
                  placeholder="Wordt automatisch gegenereerd"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
              </div>
              <div className="mb-3">
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Nederland</label>
                <div className="flex flex-wrap gap-1.5">
                  {PROVINCES_NL.map(p => {
                    const selected = selectedProvinces.includes(p);
                    const alreadyExists = existingProvs.has(p);
                    return (
                      <button key={p} onClick={() => toggleProvince(p)} disabled={alreadyExists}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                          alreadyExists
                            ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                            : selected
                              ? 'border-brand-purple bg-brand-purple/10 text-brand-purple'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-brand-purple/50'
                        }`}>
                        {p}
                        {alreadyExists && <span className="ml-1 text-[10px] text-slate-400">(actief)</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mb-3">
                <label className="mb-1.5 block text-xs font-medium text-slate-500">België</label>
                <div className="flex flex-wrap gap-1.5">
                  {PROVINCES_BE.map(p => {
                    const selected = selectedProvinces.includes(p);
                    const alreadyExists = existingProvs.has(p);
                    return (
                      <button key={p} onClick={() => toggleProvince(p)} disabled={alreadyExists}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                          alreadyExists
                            ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                            : selected
                              ? 'border-brand-purple bg-brand-purple/10 text-brand-purple'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-brand-purple/50'
                        }`}>
                        {p}
                        {alreadyExists && <span className="ml-1 text-[10px] text-slate-400">(actief)</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
              {selectedProvinces.length > 0 && (
                <p className="mb-3 text-xs text-brand-purple">
                  {selectedProvinces.length} {selectedProvinces.length === 1 ? 'provincie' : 'provincies'} geselecteerd: {selectedProvinces.join(', ')}
                </p>
              )}
              <div className="flex gap-2">
                <button onClick={resetAddForm}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50">Annuleren</button>
                <button onClick={addProvinceTarget} disabled={selectedProvinces.length === 0 || saving}
                  className="rounded-lg bg-button-gradient px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
                  {saving ? 'Opslaan...' : 'Toevoegen'}
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-5 flex gap-2">
              <button onClick={() => { cancelEdit(); setShowAdd('radius'); }} className="inline-flex items-center gap-1.5 rounded-lg bg-button-gradient px-3.5 py-2 text-sm font-bold text-white shadow-sm">
                <MapPinIcon className="h-4 w-4" /> Plaats + radius
              </button>
              <button onClick={() => { cancelEdit(); setShowAdd('province'); }} className="inline-flex items-center gap-1.5 rounded-lg border border-brand-purple/30 bg-brand-purple/5 px-3.5 py-2 text-sm font-bold text-brand-purple shadow-sm hover:bg-brand-purple/10">
                <PlusIcon className="h-4 w-4" /> Provincies
              </button>
            </div>
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
              <p className="text-xs text-slate-400">Voeg een plaats + radius of provincies toe om leads automatisch te matchen</p>
            </div>
          ) : (
            <div className="space-y-3">
              {targets.map(t => editingId === t.id ? (
                <div key={t.id} className="rounded-xl border border-brand-purple/30 bg-brand-purple/5 p-4">
                  {(t.target_type || 'radius') === 'radius' ? (
                    <>
                      <h3 className="mb-3 text-sm font-semibold text-slate-800">Targetgebied bewerken</h3>
                      <div className="mb-3">
                        <label className="mb-1 block text-xs font-medium text-slate-500">Zoek nieuwe plaats (optioneel)</label>
                        <div className="relative">
                          <input
                            value={editCityQuery}
                            onChange={e => searchEditCity(e.target.value)}
                            placeholder={`Huidige locatie: ${t.label}`}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-8 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
                          />
                          {editCitySearching && (
                            <div className="absolute right-2.5 top-2.5">
                              <ArrowPathIcon className="h-4 w-4 animate-spin text-slate-400" />
                            </div>
                          )}
                        </div>
                        {editCityError && <p className="mt-1 text-xs text-red-500">{editCityError}</p>}
                        {editCityResult && (
                          <p className="mt-1.5 text-xs text-emerald-600">
                            {editCityResult.naam} gevonden ({editCityResult.lat.toFixed(4)}, {editCityResult.lng.toFixed(4)})
                          </p>
                        )}
                        {!editCityResult && !editCityQuery && t.lat != null && t.lng != null && (
                          <p className="mt-1 text-[11px] text-slate-400">
                            Huidige coördinaten: {t.lat.toFixed(4)}, {t.lng.toFixed(4)}
                          </p>
                        )}
                      </div>
                      <div className="mb-3 grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-500">Label</label>
                          <input value={editLabel} onChange={e => setEditLabel(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-500">Radius (km)</label>
                          <input type="number" value={editRadius} onChange={e => setEditRadius(Number(e.target.value))} min={1} max={500}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <h3 className="mb-3 text-sm font-semibold text-slate-800">Provincies bewerken</h3>
                      <div className="mb-3">
                        <label className="mb-1.5 block text-xs font-medium text-slate-500">Label (optioneel)</label>
                        <input value={editLabel} onChange={e => setEditLabel(e.target.value)}
                          placeholder="Wordt automatisch gegenereerd"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
                      </div>
                      <div className="mb-3">
                        <label className="mb-1.5 block text-xs font-medium text-slate-500">Nederland</label>
                        <div className="flex flex-wrap gap-1.5">
                          {PROVINCES_NL.map(p => {
                            const selected = editProvinces.includes(p);
                            const usedByOther = targets.some(ot => ot.id !== t.id && ot.is_active && (ot.provinces || []).includes(p));
                            return (
                              <button key={p} onClick={() => toggleEditProvince(p)} disabled={usedByOther}
                                className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                                  usedByOther
                                    ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                                    : selected
                                      ? 'border-brand-purple bg-brand-purple/10 text-brand-purple'
                                      : 'border-slate-200 bg-white text-slate-600 hover:border-brand-purple/50'
                                }`}>
                                {p}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="mb-3">
                        <label className="mb-1.5 block text-xs font-medium text-slate-500">België</label>
                        <div className="flex flex-wrap gap-1.5">
                          {PROVINCES_BE.map(p => {
                            const selected = editProvinces.includes(p);
                            const usedByOther = targets.some(ot => ot.id !== t.id && ot.is_active && (ot.provinces || []).includes(p));
                            return (
                              <button key={p} onClick={() => toggleEditProvince(p)} disabled={usedByOther}
                                className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                                  usedByOther
                                    ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                                    : selected
                                      ? 'border-brand-purple bg-brand-purple/10 text-brand-purple'
                                      : 'border-slate-200 bg-white text-slate-600 hover:border-brand-purple/50'
                                }`}>
                                {p}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      {editProvinces.length > 0 && (
                        <p className="mb-3 text-xs text-brand-purple">
                          {editProvinces.length} {editProvinces.length === 1 ? 'provincie' : 'provincies'} geselecteerd
                        </p>
                      )}
                    </>
                  )}
                  <div className="flex gap-2">
                    <button onClick={cancelEdit}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50">Annuleren</button>
                    <button onClick={() => saveEdit(t)} disabled={!editLabel || saving || ((t.target_type || 'radius') === 'province' && editProvinces.length === 0)}
                      className="rounded-lg bg-button-gradient px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
                      {saving ? 'Opslaan...' : 'Opslaan'}
                    </button>
                  </div>
                </div>
              ) : (
                <div key={t.id} className={`rounded-xl border p-4 transition ${t.is_active ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <MapPinIcon className="h-4 w-4 shrink-0 text-brand-purple" />
                        <span className="font-semibold text-slate-800 truncate">{t.label}</span>
                      </div>
                      {(t.target_type || 'radius') === 'province' ? (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {(t.provinces || []).map(p => (
                            <span key={p} className="rounded-md bg-brand-purple/10 px-2 py-0.5 text-[11px] font-medium text-brand-purple">{p}</span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-0.5 text-xs text-slate-500">
                          Radius: <span className="font-medium">{t.radius_km} km</span>
                          {t.lat != null && t.lng != null && (
                            <>
                              <span className="mx-1.5 text-slate-300">|</span>
                              {t.lat.toFixed(3)}, {t.lng.toFixed(3)}
                            </>
                          )}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1 ml-2">
                      <button onClick={() => startEdit(t)}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-blue-50 hover:text-blue-500"
                        title="Bewerken">
                        <PencilSquareIcon className="h-3.5 w-3.5" />
                      </button>
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

/* ============================================================
   CUSTOMER PRICING PANEL
   ============================================================ */
interface PricingTierItem { min_leads: number; price_per_lead: number }
interface CustomerPricingEntry {
  id: string;
  customer_id: string;
  branch_slug: string;
  pricing_tiers: PricingTierItem[];
  nationwide_discount: number | null;
  notes: string | null;
}

function CustomerPricingPanel({ customer, branchOptions, onClose }: {
  customer: Customer; branchOptions: BranchOption[]; onClose: () => void;
}) {
  const [pricing, setPricing] = useState<CustomerPricingEntry[]>([]);
  const [branches, setBranches] = useState<{ slug: string; name: string; pricing_tiers: PricingTierItem[]; nationwide_discount: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editBranch, setEditBranch] = useState<string | null>(null);
  const [editTiers, setEditTiers] = useState<PricingTierItem[]>([]);
  const [editDiscount, setEditDiscount] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [newTierLeads, setNewTierLeads] = useState('');
  const [newTierPrice, setNewTierPrice] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    const [pRes, bRes] = await Promise.all([
      adminFetch(`/api/admin/customer-pricing?customer_id=${customer.id}`),
      adminFetch('/api/admin/branches'),
    ]);
    if (pRes.ok) { const d = await pRes.json(); setPricing(d.pricing || []); }
    if (bRes.ok) {
      const d = await bRes.json();
      setBranches((d.branches || []).filter((b: { is_active: boolean }) => b.is_active).map((b: { slug: string; name: string; pricing_tiers: PricingTierItem[]; nationwide_discount: number }) => ({
        slug: b.slug, name: b.name, pricing_tiers: b.pricing_tiers || [], nationwide_discount: Number(b.nationwide_discount) || 0,
      })));
    }
    setLoading(false);
  }, [customer.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const customerBranches = branches.filter(b => customer.branches.includes(b.slug));

  const startEdit = (branchSlug: string) => {
    const existing = pricing.find(p => p.branch_slug === branchSlug);
    setEditBranch(branchSlug);
    setEditTiers(existing?.pricing_tiers?.length ? [...existing.pricing_tiers].sort((a, b) => a.min_leads - b.min_leads) : []);
    setEditDiscount(existing?.nationwide_discount != null ? String(existing.nationwide_discount) : '');
    setEditNotes(existing?.notes || '');
    setNewTierLeads('');
    setNewTierPrice('');
  };

  const addTier = () => {
    const leads = parseInt(newTierLeads);
    const price = parseFloat(newTierPrice);
    if (!leads || leads <= 0 || isNaN(price) || price < 0) return;
    if (editTiers.some(t => t.min_leads === leads)) return;
    setEditTiers(prev => [...prev, { min_leads: leads, price_per_lead: price }].sort((a, b) => a.min_leads - b.min_leads));
    setNewTierLeads('');
    setNewTierPrice('');
  };

  const removeTier = (idx: number) => {
    setEditTiers(prev => prev.filter((_, i) => i !== idx));
  };

  const [saveError, setSaveError] = useState('');

  const savePricing = async () => {
    if (!editBranch) return;
    setSaving(true);
    setSaveError('');

    const finalTiers = [...editTiers];
    if (newTierLeads && newTierPrice) {
      const leads = parseInt(newTierLeads);
      const price = parseFloat(newTierPrice);
      if (leads > 0 && !isNaN(price) && price >= 0 && !finalTiers.some(t => t.min_leads === leads)) {
        finalTiers.push({ min_leads: leads, price_per_lead: price });
        finalTiers.sort((a, b) => a.min_leads - b.min_leads);
      }
    }

    try {
      const res = await adminFetch('/api/admin/customer-pricing', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: customer.id,
          branch_slug: editBranch,
          pricing_tiers: finalTiers,
          nationwide_discount: editDiscount ? parseFloat(editDiscount) : null,
          notes: editNotes || null,
        }),
      });
      if (res.ok) {
        setNewTierLeads('');
        setNewTierPrice('');
        await fetchData();
        setEditBranch(null);
      } else {
        const d = await res.json().catch(() => ({}));
        setSaveError(d.error || 'Opslaan mislukt');
      }
    } catch {
      setSaveError('Er ging iets mis bij het opslaan');
    }
    setSaving(false);
  };

  const deletePricing = async (id: string) => {
    if (!confirm('Klantspecifieke prijs verwijderen? De standaard brancheprijs wordt dan weer gebruikt.')) return;
    await adminFetch('/api/admin/customer-pricing', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
    });
    fetchData();
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-lg flex-col bg-white shadow-2xl">

        <div className="shrink-0 border-b border-slate-100">
          <div className="h-[3px] bg-warmeleads-gradient" />
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Klantprijzen</h2>
              <p className="mt-0.5 text-xs text-slate-500">{customer.name} &middot; Afwijkende staffelprijzen per branche</p>
            </div>
            <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><XMarkIcon className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="space-y-3">
              {[0, 1].map(i => <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}
            </div>
          ) : customerBranches.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center">
              <CurrencyEuroIcon className="mx-auto mb-2 h-8 w-8 text-slate-300" />
              <p className="text-sm text-slate-500">Geen branches gekoppeld aan deze klant</p>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs text-amber-700">
                  Stel hier afwijkende prijzen in per branche. Als er geen klantspecifieke prijs is ingesteld, gelden de standaard brancheprijzen.
                </p>
              </div>

              {customerBranches.map(b => {
                const cp = pricing.find(p => p.branch_slug === b.slug);
                const isEditing = editBranch === b.slug;
                const hasTiers = b.pricing_tiers && b.pricing_tiers.length > 0;

                return (
                  <div key={b.slug} className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="flex items-start justify-between bg-slate-50 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{b.name}</p>
                        {hasTiers && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {[...b.pricing_tiers].sort((a, b) => a.min_leads - b.min_leads).map((t, i) => (
                              <span key={i} className="rounded bg-slate-200/70 px-1.5 py-0.5 text-[10px] text-slate-500">
                                {t.min_leads}+ → €{Number(t.price_per_lead).toFixed(2)}
                              </span>
                            ))}
                            {Number(b.nationwide_discount) > 0 && (
                              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-600">
                                -€{b.nationwide_discount.toFixed(2)} landelijk
                              </span>
                            )}
                          </div>
                        )}
                        {!hasTiers && <p className="mt-0.5 text-[10px] text-slate-400 italic">Geen standaardstaffels ingesteld</p>}
                      </div>
                      {!isEditing && (
                        <button onClick={() => startEdit(b.slug)}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-purple hover:bg-brand-purple/5">
                          {cp ? 'Bewerken' : 'Instellen'}
                        </button>
                      )}
                    </div>

                    {cp && !isEditing && (
                      <div className="border-t border-slate-100 bg-white px-4 py-3">
                        <div className="mb-1 flex items-center gap-1.5">
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">KLANTSPECIFIEK</span>
                        </div>
                        {cp.pricing_tiers && cp.pricing_tiers.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {[...cp.pricing_tiers].sort((a, b) => a.min_leads - b.min_leads).map((t, i) => (
                              <span key={i} className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                                {t.min_leads}+ → €{Number(t.price_per_lead).toFixed(2)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-red-500 italic">Geen staffels ingesteld - klik Bewerken om toe te voegen</p>
                        )}
                        {cp.nationwide_discount != null && Number(cp.nationwide_discount) > 0 && (
                          <p className="mt-1 text-[10px] text-emerald-600">Landelijke korting: -€{Number(cp.nationwide_discount).toFixed(2)}</p>
                        )}
                        {cp.notes && <p className="mt-1 text-[10px] text-slate-400 italic">{cp.notes}</p>}
                        <button onClick={() => deletePricing(cp.id)} className="mt-2 text-[10px] text-red-500 hover:underline">
                          Klantprijs verwijderen
                        </button>
                      </div>
                    )}

                    {isEditing && (
                      <div className="border-t border-slate-100 bg-white p-4 space-y-3">
                        {saveError && (
                          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{saveError}</div>
                        )}
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-slate-500">Staffelprijzen</label>
                          {editTiers.length > 0 ? (
                            <div className="space-y-1.5 mb-2">
                              {editTiers.map((t, i) => (
                                <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                  <span className="flex-1 text-sm text-slate-700">
                                    Vanaf <span className="font-semibold">{t.min_leads}</span> leads
                                  </span>
                                  <span className="text-sm font-bold text-slate-900">€{Number(t.price_per_lead).toFixed(2)}</span>
                                  <button onClick={() => removeTier(i)} className="rounded p-1 text-slate-300 hover:text-red-500">
                                    <TrashIcon className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mb-2 text-xs text-slate-400 italic">Geen staffels (standaard brancheprijs)</p>
                          )}

                          <div className="flex items-end gap-2">
                            <div className="flex-1">
                              <label className="mb-0.5 block text-[10px] text-slate-400">Vanaf (leads)</label>
                              <input type="number" min="1" value={newTierLeads} onChange={e => setNewTierLeads(e.target.value)}
                                placeholder="bijv. 250"
                                onKeyDown={e => e.key === 'Enter' && addTier()}
                                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
                            </div>
                            <div className="flex-1">
                              <label className="mb-0.5 block text-[10px] text-slate-400">€ per lead</label>
                              <input type="number" min="0" step="0.50" value={newTierPrice} onChange={e => setNewTierPrice(e.target.value)}
                                placeholder="bijv. 20.50"
                                onKeyDown={e => e.key === 'Enter' && addTier()}
                                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
                            </div>
                            <button type="button" onClick={addTier} disabled={!newTierLeads || !newTierPrice}
                              className="rounded-lg bg-brand-purple px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40" title="Staffel toevoegen">
                              <PlusIcon className="h-4 w-4" />
                            </button>
                          </div>
                          {newTierLeads && newTierPrice && (
                            <p className="text-[10px] text-amber-600">Klik + of druk Enter om de staffel toe te voegen (wordt ook automatisch meegenomen bij opslaan)</p>
                          )}
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-500">Korting landelijk (€)</label>
                          <input type="number" min="0" step="0.50" value={editDiscount} onChange={e => setEditDiscount(e.target.value)}
                            placeholder="Standaard brancheprijs"
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-500">Notitie</label>
                          <input value={editNotes} onChange={e => setEditNotes(e.target.value)}
                            placeholder="Bijv. afspraak van 15-3-2026"
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
                        </div>

                        <div className="flex gap-2 pt-1">
                          <button onClick={() => setEditBranch(null)}
                            className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Annuleren</button>
                          <button onClick={savePricing} disabled={saving}
                            className="flex-1 rounded-lg bg-button-gradient py-2 text-sm font-bold text-white disabled:opacity-50">
                            {saving ? 'Opslaan...' : 'Opslaan'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </motion.div>
    </>
  );
}
