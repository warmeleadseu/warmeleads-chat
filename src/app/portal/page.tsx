'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
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
  Cog6ToothIcon,
  BellIcon,
  BellSlashIcon,
  StarIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
  DocumentArrowDownIcon,
  TableCellsIcon,
  ShoppingCartIcon,
  DevicePhoneMobileIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { usePushNotifications, type PushState } from './usePushNotifications';

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

interface BranchField { key: string; label: string; field_type: string; options: string[]; is_required: boolean; sort_order: number; }
interface BranchConfig { slug: string; name: string; color: string; branch_fields: BranchField[]; }

const BRANCH_COLOR_MAP: Record<string, { light: string; text: string }> = {
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
  received_at?: string;
  created_at: string;
  bron: string;
  custom_fields?: Record<string, string>;
  [key: string]: unknown;
}

interface Stats {
  totalLeads: number;
  newThisWeek: number;
  contacted: number;
  sold: number;
  statusBreakdown?: Record<string, number>;
  branchBreakdown?: Record<string, number>;
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
  if (!d) return '-';
  return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateLong(d: string) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function PortalPage() {
  const { customer } = usePortal();

  const [stats, setStats] = useState<Stats>({ totalLeads: 0, newThisWeek: 0, contacted: 0, sold: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  const [batches, setBatches] = useState<{ active: any[]; completed: any[] }>({ active: [], completed: [] });
  const [batchesLoading, setBatchesLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [branchConfigs, setBranchConfigs] = useState<BranchConfig[]>([]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sort, setSort] = useState('created_at');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [notificationFrequency, setNotificationFrequency] = useState('instant');

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);
  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
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

  const fetchBranches = useCallback(async () => {
    const res = await portalFetch('/api/portal/branches');
    if (res.ok) { const d = await res.json(); setBranchConfigs(d.branches || []); }
  }, []);

  const fetchBatches = useCallback(async () => {
    setBatchesLoading(true);
    try {
      const res = await portalFetch('/api/portal/batches');
      if (res.ok) {
        const d = await res.json();
        setBatches({ active: d.active || [], completed: d.completed || [] });
      }
    } catch { /* ignore */ }
    setBatchesLoading(false);
  }, []);

  const fetchNotifPrefs = useCallback(async () => {
    try {
      const res = await portalFetch('/api/portal/notifications');
      if (res.ok) {
        const d = await res.json();
        setEmailNotifications(d.email_notifications ?? false);
        setNotificationFrequency(d.notification_frequency ?? 'instant');
      }
    } catch { /* ignore */ }
  }, []);

  const saveNotifPrefs = useCallback(async (enabled: boolean, freq: string) => {
    setEmailNotifications(enabled);
    setNotificationFrequency(freq);
    try {
      await portalFetch('/api/portal/notifications', {
        method: 'PUT',
        body: JSON.stringify({ email_notifications: enabled, notification_frequency: freq }),
      });
      showToast(enabled ? 'E-mailnotificaties ingeschakeld' : 'E-mailnotificaties uitgeschakeld');
    } catch {
      showToast('Fout bij opslaan voorkeuren');
    }
  }, [showToast]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchLeads(); }, [fetchLeads]);
  useEffect(() => { fetchBranches(); }, [fetchBranches]);
  useEffect(() => { fetchBatches(); }, [fetchBatches]);
  useEffect(() => { fetchNotifPrefs(); }, [fetchNotifPrefs]);

  const branchMap = useMemo(() => {
    const m: Record<string, BranchConfig> = {};
    branchConfigs.forEach(b => { m[b.slug] = b; });
    return m;
  }, [branchConfigs]);

  const getBranch = useCallback((slug: string) => {
    const b = branchMap[slug];
    const c = BRANCH_COLOR_MAP[b?.color || 'slate'] || BRANCH_COLOR_MAP.slate;
    return { name: b?.name || slug, color: b?.color || 'slate', light: c.light, text: c.text, fields: b?.branch_fields || [] };
  }, [branchMap]);

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

  const exportData = useCallback(async (format: 'csv' | 'xlsx') => {
    showToast(`${format.toUpperCase()} wordt gedownload...`);
    try {
      const params = new URLSearchParams();
      params.set('format', format);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (branchFilter !== 'all') params.set('branch', branchFilter);
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      const res = await portalFetch(`/api/portal/export?${params}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = format === 'xlsx' ? 'xlsx' : 'csv';
      a.download = `leads-${customer.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast('Export mislukt');
    }
  }, [statusFilter, branchFilter, dateFrom, dateTo, customer.name, showToast]);

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
            className={`fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-xl px-5 py-3 text-sm font-medium text-white shadow-xl ${
              toast.type === 'error' ? 'bg-red-600' : 'bg-slate-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'error' ? (
                <ExclamationTriangleIcon className="h-4 w-4 text-red-200" />
              ) : (
                <CheckCircleIcon className="h-4 w-4 text-emerald-400" />
              )}
              {toast.msg}
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

      {/* Batch Progress */}
      {batchesLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div className="h-5 w-24 animate-pulse rounded-full bg-slate-100" />
                <div className="h-4 w-8 animate-pulse rounded bg-slate-100" />
              </div>
              <div className="mb-2 h-2.5 animate-pulse rounded-full bg-slate-100" />
              <div className="h-3 w-32 animate-pulse rounded bg-slate-50" />
            </div>
          ))}
        </div>
      ) : (batches.active.length > 0 || batches.completed.length > 0) && (
        <div className="space-y-3">
          {batches.active.length > 0 && (
            <>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Actieve batches
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {batches.active.map((b: Record<string, any>) => {
                  const pct = b.batch_size > 0 ? Math.round((b.leads_delivered / b.batch_size) * 100) : 0;
                  return (
                    <div key={b.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
                      <div className="mb-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-brand-purple/10 px-2.5 py-0.5 text-[11px] font-semibold text-brand-purple">
                            {b.branch_name || b.branch}
                          </span>
                          {b.leads_per_week > 0 && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">max {b.leads_per_week}/week</span>
                          )}
                        </div>
                        <span className="text-sm font-bold text-slate-900">{pct}%</span>
                      </div>
                      <div className="mb-2.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-brand-purple to-brand-pink transition-all duration-700"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="font-medium">{b.leads_delivered} / {b.batch_size} leads</span>
                        {b.estimated_completion && (
                          <span className="text-slate-400">
                            Klaar ~{new Date(b.estimated_completion).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </div>
                      {(b.leads_per_day > 0 || b.this_week_count > 0) && (
                        <div className="mt-2 flex gap-3 border-t border-slate-50 pt-2 text-[11px] text-slate-400">
                          {b.leads_per_day > 0 && <span>~{b.leads_per_day.toFixed(1)} leads/dag</span>}
                          {b.this_week_count > 0 && (
                            <span className="font-medium text-brand-purple">Deze week: {b.this_week_count}</span>
                          )}
                        </div>
                      )}
                      {pct >= 80 && (
                        <Link
                          href={`/portal/bestellen?batch=${b.id}`}
                          className="mt-2.5 flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-purple to-brand-pink px-3 py-2 text-[12px] font-semibold text-white shadow-sm transition hover:shadow-md"
                        >
                          <ShoppingCartIcon className="h-3.5 w-3.5" />
                          Vervolg batch bestellen
                        </Link>
                      )}
                      {b.lead_filters && Array.isArray(b.lead_filters) && b.lead_filters.length > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-slate-50 pt-2">
                          <span className="text-[10px] text-slate-400">Filters:</span>
                          {b.lead_filters.map((f: Record<string, unknown>, i: number) => {
                            const vals = Array.isArray(f.values) ? f.values as string[] : [];
                            const count = vals.length || (f.value ? 1 : 0);
                            return (
                              <span key={i} className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                                {String(f.field)}: {count} {count === 1 ? 'waarde' : 'waarden'}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {batches.completed.length > 0 && (
            <details className="group rounded-xl border border-slate-200 bg-white shadow-sm">
              <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-xs font-medium text-slate-500 transition hover:text-slate-700">
                <span>{batches.completed.length} voltooide {batches.completed.length === 1 ? 'batch' : 'batches'}</span>
                <svg className="h-4 w-4 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="grid gap-2 border-t border-slate-100 p-3 sm:grid-cols-2">
                {batches.completed.map((b: Record<string, any>) => (
                  <div key={b.id} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-600">
                        {b.branch_name || b.branch} ✓
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {b.duration_days ? `${b.duration_days} dagen` : ''}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500">
                      {b.leads_delivered} / {b.batch_size} leads
                      {b.completed_at && (
                        <span className="text-slate-400"> · {new Date(b.completed_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      )}
                    </p>
                    <Link
                      href={`/portal/bestellen?batch=${b.id}`}
                      className="mt-2 inline-flex items-center gap-1 rounded-md bg-brand-purple/10 px-2.5 py-1 text-[11px] font-semibold text-brand-purple transition hover:bg-brand-purple/20"
                    >
                      <ShoppingCartIcon className="h-3 w-3" />
                      Opnieuw bestellen
                    </Link>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

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

      {/* Mini Charts */}
      {!statsLoading && stats.totalLeads > 0 && (
        <MiniCharts stats={stats} getBranch={getBranch} />
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportData('csv')}
            disabled={total === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            <span className="hidden sm:inline">CSV</span>
          </button>
          <button
            onClick={() => exportData('xlsx')}
            disabled={total === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
          >
            <TableCellsIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Excel</span>
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            title="Instellingen"
          >
            <Cog6ToothIcon className="h-4 w-4" />
          </button>
        </div>
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
                      <option key={b} value={b}>{getBranch(b).name}</option>
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
                          <p className="font-medium text-slate-900">{lead.naam_klant || '-'}</p>
                          {lead.telefoonnummer && (
                            <p className="text-xs text-slate-400">{lead.telefoonnummer}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{lead.plaatsnaam || '-'}</td>
                      <td className="px-4 py-3">
                        {(() => { const b = getBranch(lead.branch); return (
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${b.light} ${b.text}`}>{b.name}</span>
                        ); })()}
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
                      <td className="px-4 py-3 text-slate-500">{formatDate(lead.received_at || lead.wervingsdatum)}</td>
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
                    <p className="font-semibold text-slate-900">{lead.naam_klant || '-'}</p>
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
                  {(() => { const b = getBranch(lead.branch); return (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${b.light} ${b.text}`}>{b.name}</span>
                  ); })()}
                  <span className="flex items-center gap-1">
                    <CalendarDaysIcon className="h-3 w-3" />
                    {formatDate(lead.received_at || lead.wervingsdatum)}
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

      {/* Lead detail slide-over (portalled to body for correct fixed positioning) */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectedLead && (
            <LeadDetailPanel
              lead={selectedLead}
              branchConfig={branchMap[selectedLead.branch]}
              getBranch={getBranch}
              onClose={() => setSelectedLead(null)}
              onStatusChange={(s) => handleStatusUpdate(selectedLead, s)}
              onNotesChange={(n) => handleNotesUpdate(selectedLead, n)}
              showToast={showToast}
            />
          )}
        </AnimatePresence>,
        document.body,
      )}

      {/* Settings slide-over (portalled to body) */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showSettings && (
            <SettingsPanel
              emailNotifications={emailNotifications}
              notificationFrequency={notificationFrequency}
              onSave={saveNotifPrefs}
              onClose={() => setShowSettings(false)}
              showToast={showToast}
            />
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}

function LeadDetailPanel({
  lead,
  branchConfig,
  getBranch,
  onClose,
  onStatusChange,
  onNotesChange,
  showToast,
}: {
  lead: Lead;
  branchConfig?: BranchConfig;
  getBranch: (slug: string) => { name: string; light: string; text: string; fields: BranchField[] };
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

  const bInfo = getBranch(lead.branch);
  const branchFields = (branchConfig?.branch_fields || []).map(f => {
    const val = lead.custom_fields?.[f.key] || (lead as Record<string, unknown>)[f.key] as string || '';
    return { label: f.label, value: val };
  });

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
                {bInfo.name} &middot; {formatDateLong(lead.received_at || lead.wervingsdatum)}
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
                  {bInfo.name} details
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

            {/* Feedback */}
            <LeadFeedback leadId={lead.id} showToast={showToast} />

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
                <p>Aangemaakt: {formatDateLong(lead.created_at)}</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}

/* ─── Mini Charts ─────────────────────────────────────────── */
function MiniCharts({ stats, getBranch }: { stats: Stats & { statusBreakdown?: Record<string, number>; branchBreakdown?: Record<string, number> }; getBranch: (slug: string) => { name: string; light: string; text: string } }) {
  const statusData = stats.statusBreakdown || {};
  const branchData = stats.branchBreakdown || {};

  const statusColors: Record<string, string> = {
    nieuw: '#3B82F6',
    gecontacteerd: '#F59E0B',
    offerte: '#8B5CF6',
    verkocht: '#10B981',
    afgewezen: '#94A3B8',
  };

  const statusLabels: Record<string, string> = {
    nieuw: 'Nieuw',
    gecontacteerd: 'Gecontacteerd',
    offerte: 'Offerte',
    verkocht: 'Verkocht',
    afgewezen: 'Afgewezen',
  };

  const statusEntries = Object.entries(statusData).filter(([, v]) => v > 0);
  const total = statusEntries.reduce((s, [, v]) => s + v, 0) || 1;

  const branchEntries = Object.entries(branchData).filter(([, v]) => v > 0);
  const branchTotal = branchEntries.reduce((s, [, v]) => s + v, 0) || 1;

  if (statusEntries.length === 0 && branchEntries.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {statusEntries.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Status verdeling</h3>
          <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
            {statusEntries.map(([key, count]) => (
              <div
                key={key}
                style={{ width: `${(count / total) * 100}%`, backgroundColor: statusColors[key] || '#94A3B8' }}
                className="transition-all duration-500"
                title={`${statusLabels[key] || key}: ${count}`}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {statusEntries.map(([key, count]) => (
              <div key={key} className="flex items-center gap-1.5 text-xs">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: statusColors[key] || '#94A3B8' }} />
                <span className="text-slate-500">{statusLabels[key] || key}</span>
                <span className="font-semibold text-slate-700">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {branchEntries.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Branches</h3>
          <div className="space-y-2">
            {branchEntries.map(([key, count]) => {
              const b = getBranch(key);
              const pct = Math.round((count / branchTotal) * 100);
              return (
                <div key={key}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-slate-600">{b.name}</span>
                    <span className="font-semibold text-slate-700">{count} ({pct}%)</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-brand-purple to-brand-pink transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Lead Feedback ───────────────────────────────────────── */
const FEEDBACK_OPTIONS = [
  { value: 'goed_contact', label: 'Goed contact gehad', icon: HandThumbUpIcon, color: 'emerald' },
  { value: 'onbereikbaar', label: 'Onbereikbaar', icon: PhoneIcon, color: 'amber' },
  { value: 'niet_geinteresseerd', label: 'Niet geïnteresseerd', icon: HandThumbDownIcon, color: 'slate' },
  { value: 'fout_nummer', label: 'Fout nummer', icon: XMarkIcon, color: 'red' },
  { value: 'verkocht', label: 'Verkocht!', icon: StarIcon, color: 'purple' },
] as const;

function LeadFeedback({ leadId, showToast }: { leadId: string; showToast: (m: string) => void }) {
  const [rating, setRating] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setSaved(false);
    setComment('');
    setRating(null);
    portalFetch(`/api/portal/feedback?lead_id=${leadId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.feedback) {
          setRating(d.feedback.rating);
          setComment(d.feedback.comment || '');
          setSaved(true);
        }
      })
      .finally(() => setLoading(false));
  }, [leadId]);

  const submit = async (value: string) => {
    setRating(value);
    setSaved(true);
    try {
      const res = await portalFetch('/api/portal/feedback', {
        method: 'POST',
        body: JSON.stringify({ lead_id: leadId, rating: value, comment }),
      });
      if (res.ok) showToast('Feedback opgeslagen');
      else throw new Error();
    } catch {
      showToast('Fout bij opslaan feedback');
      setSaved(false);
    }
  };

  const saveComment = async () => {
    if (!rating) return;
    try {
      await portalFetch('/api/portal/feedback', {
        method: 'POST',
        body: JSON.stringify({ lead_id: leadId, rating, comment }),
      });
      showToast('Opmerking opgeslagen');
    } catch {
      showToast('Fout bij opslaan');
    }
  };

  if (loading) return <div className="h-16 animate-pulse rounded-xl bg-slate-50" />;

  const colorMap: Record<string, { bg: string; text: string; border: string; activeBg: string }> = {
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', activeBg: 'bg-emerald-100' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', activeBg: 'bg-amber-100' },
    slate: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', activeBg: 'bg-slate-100' },
    red: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200', activeBg: 'bg-red-100' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200', activeBg: 'bg-purple-100' },
  };

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Feedback</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {FEEDBACK_OPTIONS.map(opt => {
          const c = colorMap[opt.color];
          const active = rating === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => submit(opt.value)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                active ? `${c.activeBg} ${c.border} ${c.text}` : `${c.bg} border-transparent ${c.text} opacity-60 hover:opacity-100`
              }`}
            >
              <opt.icon className="h-3.5 w-3.5" />
              {opt.label}
            </button>
          );
        })}
      </div>
      {saved && (
        <div className="mt-2">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onBlur={saveComment}
            placeholder="Optionele opmerking..."
            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 outline-none focus:border-brand-purple/50"
          />
        </div>
      )}
    </div>
  );
}

/* ─── Push Toggle Component ───────────────────────────────── */
function PushToggleSection({ pushState, pushToggling, onToggle, showToast, lastError }: {
  pushState: PushState;
  pushToggling: boolean;
  onToggle: () => Promise<boolean>;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  lastError?: string | null;
}) {
  const handleToggle = async () => {
    const success = await onToggle();
    if (success) {
      showToast(pushState === 'enabled' ? 'Push notificaties uitgeschakeld' : 'Push notificaties ingeschakeld');
    } else if (pushState !== 'denied') {
      showToast(lastError || 'Kon push notificaties niet wijzigen', 'error');
    }
  };

  if (pushState === 'loading') return null;
  if (pushState === 'unsupported') return null;

  const isEnabled = pushState === 'enabled';
  const isDenied = pushState === 'denied';
  const isIosNotInstalled = pushState === 'ios-not-installed';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isEnabled ? (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-purple/10">
              <DevicePhoneMobileIcon className="h-5 w-5 text-brand-purple" />
            </div>
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
              <DevicePhoneMobileIcon className="h-5 w-5 text-slate-400" />
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-slate-900">Push notificaties</p>
            <p className="text-xs text-slate-500">
              {isEnabled && 'Actief op dit apparaat'}
              {pushState === 'disabled' && 'Ontvang direct een melding op uw telefoon'}
              {isDenied && 'Geblokkeerd in uw browser'}
              {isIosNotInstalled && 'Installeer eerst de app'}
            </p>
          </div>
        </div>
        {!isDenied && !isIosNotInstalled && (
          <button
            onClick={handleToggle}
            disabled={pushToggling}
            className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-50 ${isEnabled ? 'bg-brand-purple' : 'bg-slate-200'}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${isEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
          </button>
        )}
      </div>
      {isDenied && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3">
          <ExclamationTriangleIcon className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
          <p className="text-xs text-amber-700">
            Notificaties zijn geblokkeerd in uw browser. Ga naar uw browserinstellingen om dit te wijzigen.
          </p>
        </div>
      )}
      {isIosNotInstalled && (
        <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3">
          <DevicePhoneMobileIcon className="h-4 w-4 shrink-0 text-blue-500 mt-0.5" />
          <p className="text-xs text-blue-700">
            Installeer de app op uw startscherm om push notificaties te ontvangen.
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── Settings Panel ──────────────────────────────────────── */
function SettingsPanel({
  emailNotifications,
  notificationFrequency,
  onSave,
  onClose,
  showToast,
}: {
  emailNotifications: boolean;
  notificationFrequency: string;
  onSave: (enabled: boolean, freq: string) => void;
  onClose: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}) {
  const [enabled, setEnabled] = useState(emailNotifications);
  const [freq, setFreq] = useState(notificationFrequency);
  const push = usePushNotifications();

  useEffect(() => {
    setEnabled(emailNotifications);
    setFreq(notificationFrequency);
  }, [emailNotifications, notificationFrequency]);

  const handleToggle = () => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    onSave(newEnabled, freq);
  };

  const handleFreqChange = (newFreq: string) => {
    setFreq(newFreq);
    onSave(enabled, newFreq);
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
        className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-sm flex-col bg-white shadow-2xl"
      >
        <div className="h-[3px] bg-warmeleads-gradient" />
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">Instellingen</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">E-mailnotificaties</h3>
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {enabled ? (
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-purple/10">
                      <BellIcon className="h-5 w-5 text-brand-purple" />
                    </div>
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
                      <BellSlashIcon className="h-5 w-5 text-slate-400" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-slate-900">Nieuwe leads per e-mail</p>
                    <p className="text-xs text-slate-500">Ontvang een melding bij nieuwe leads</p>
                  </div>
                </div>
                <button
                  onClick={handleToggle}
                  className={`relative h-6 w-11 rounded-full transition-colors ${enabled ? 'bg-brand-purple' : 'bg-slate-200'}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                </button>
              </div>
              {enabled && (
                <div>
                  <p className="mb-2 text-xs text-slate-500">Frequentie</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'instant', label: 'Direct' },
                      { value: 'daily', label: 'Dagelijks' },
                      { value: 'weekly', label: 'Wekelijks' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => handleFreqChange(opt.value)}
                        className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
                          freq === opt.value
                            ? 'bg-brand-purple/10 text-brand-purple border border-brand-purple/30'
                            : 'bg-slate-50 text-slate-600 border border-transparent hover:bg-slate-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400">
                    {freq === 'instant' && 'U ontvangt direct een e-mail bij elke nieuwe lead.'}
                    {freq === 'daily' && 'U ontvangt elke ochtend een overzicht van nieuwe leads.'}
                    {freq === 'weekly' && 'U ontvangt elke maandag een overzicht van de afgelopen week.'}
                  </p>
                </div>
              )}
            </div>
          </div>
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Push notificaties</h3>
            <PushToggleSection
              pushState={push.state}
              pushToggling={push.toggling}
              onToggle={push.toggle}
              showToast={showToast}
              lastError={push.lastError}
            />
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs text-slate-400">
              Wilt u wijzigingen aanbrengen aan uw account? Neem contact op via{' '}
              <a href="mailto:info@warmeleads.eu" className="text-brand-purple hover:underline">info@warmeleads.eu</a>
            </p>
          </div>
        </div>
      </motion.div>
    </>
  );
}
