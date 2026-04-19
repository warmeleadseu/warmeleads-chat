'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
  ShoppingCartIcon,
  DevicePhoneMobileIcon,
  ExclamationTriangleIcon,
  CreditCardIcon,
  ClipboardDocumentCheckIcon,
  FlagIcon,
  ChevronDownIcon,
  BoltIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { usePushNotifications, type PushState } from './usePushNotifications';
import ExportWizard, { type ExportFilters } from './ExportWizard';

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
  { value: 'geen_gehoor', label: 'Geen gehoor' },
  { value: 'offerte', label: 'Offerte' },
  { value: 'verkocht', label: 'Verkocht' },
  { value: 'afgewezen', label: 'Afgewezen' },
];

const STATUS_COLORS: Record<string, string> = {
  nieuw: 'bg-blue-100 text-blue-700',
  gecontacteerd: 'bg-amber-100 text-amber-700',
  geen_gehoor: 'bg-orange-100 text-orange-700',
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
  distance_km?: number | null;
  custom_fields?: Record<string, string>;
  [key: string]: unknown;
}

interface Stats {
  totalLeads: number;
  newThisWeek: number;
  contacted: number;
  sold: number;
  bulkLeads?: number;
  statusBreakdown?: Record<string, number>;
  branchBreakdown?: Record<string, number>;
}

interface Batch {
  id: string;
  branch?: string | null;
  branch_name?: string | null;
  batch_size: number;
  leads_delivered: number;
  leads_per_day?: number | null;
  is_paid?: boolean | null;
  total_price?: number | null;
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
              {['Naam', 'Plaats', 'Afstand', 'Branche', 'Status', 'Datum', 'Contact'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {[...Array(5)].map((_, i) => (
              <tr key={i}>
                <td className="px-4 py-3"><div className="space-y-1"><div className="h-4 w-28 animate-pulse rounded bg-slate-100" /><div className="h-3 w-20 animate-pulse rounded bg-slate-50" /></div></td>
                <td className="px-4 py-3"><div className="h-4 w-20 animate-pulse rounded bg-slate-100" /></td>
                <td className="px-4 py-3"><div className="h-4 w-14 animate-pulse rounded bg-slate-100" /></td>
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

function formatDistance(km: number | null | undefined): string {
  if (km == null || km <= 0) return '';
  return km < 10
    ? `${km.toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`
    : `${Math.round(km)} km`;
}

function formatDate(d: string) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateLong(d: string) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatCurrencyEUR(amount: number) {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function PortalPage() {
  const { customer } = usePortal();
  const searchParams = useSearchParams();

  const [stats, setStats] = useState<Stats>({ totalLeads: 0, newThisWeek: 0, contacted: 0, sold: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  const [batches, setBatches] = useState<{ active: Batch[]; completed: Batch[] }>({ active: [], completed: [] });
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
  const [leadSource, setLeadSource] = useState<'all' | 'fresh' | 'bulk'>('all');
  const [bulkCount, setBulkCount] = useState(0);

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showExportWizard, setShowExportWizard] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [notificationFrequency, setNotificationFrequency] = useState('instant');

  const [payingBatch, setPayingBatch] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);
  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeOffer, setWelcomeOffer] = useState<{ active: boolean; expiresAt: string | null }>({ active: false, expiresAt: null });
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [showOverviewPanel, setShowOverviewPanel] = useState(false);

  useEffect(() => {
    const paidParam = searchParams.get('paid');
    if (paidParam) {
      showToast('Betaling verwerkt! Je batch is nu actief.');
      window.history.replaceState({}, '', '/portal');
    }
    if (searchParams.get('welcome') === 'true') {
      setShowWelcome(true);
      window.history.replaceState({}, '', '/portal');
    }
  }, [searchParams, showToast]);

  useEffect(() => {
    portalFetch('/api/portal/welcome-offer')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setWelcomeOffer({ active: data.active, expiresAt: data.expires_at });
      })
      .catch(() => {});
  }, []);

  const showBranchFilter = customer.branches.length > 1;
  const conversionRate = stats.totalLeads > 0
    ? Math.round((stats.sold / stats.totalLeads) * 100)
    : 0;
  const hasUnpaidBatch = useMemo(
    () => batches.active.some((b) => b.is_paid === false),
    [batches.active],
  );
  const primaryBatch = useMemo(() => {
    if (batches.active.length === 0) return null;
    const unpaid = batches.active.find((b) => b.is_paid === false);
    if (unpaid) return unpaid;
    const sorted = [...batches.active].sort((a, b) => {
      const aSize = Number(a.batch_size);
      const bSize = Number(b.batch_size);
      const aPct = aSize > 0 ? Number(a.leads_delivered) / aSize : 0;
      const bPct = bSize > 0 ? Number(b.leads_delivered) / bSize : 0;
      return bPct - aPct;
    });
    return sorted[0];
  }, [batches.active]);
  const primaryBatchProgressPct = useMemo(() => {
    if (!primaryBatch) return 0;
    const size = Number(primaryBatch.batch_size);
    const delivered = Number(primaryBatch.leads_delivered);
    return size > 0 ? Math.min(100, Math.round((delivered / size) * 100)) : 0;
  }, [primaryBatch]);
  const primaryBatchIsUnpaid = primaryBatch ? primaryBatch.is_paid === false : false;
  const primaryBatchShouldUpsell = !!primaryBatch && !primaryBatchIsUnpaid && primaryBatchProgressPct >= 80;

  useEffect(() => {
    if (!showOverviewPanel) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showOverviewPanel]);

  const fetchStats = useCallback(async (silent = false) => {
    if (!silent) setStatsLoading(true);
    try {
      const res = await portalFetch('/api/portal/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      } else if (!silent) {
        showToast('Statistieken konden niet geladen worden', 'error');
      }
    } catch {
      if (!silent) showToast('Statistieken konden niet geladen worden', 'error');
    } finally {
      if (!silent) setStatsLoading(false);
    }
  }, [showToast]);

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
    if (leadSource !== 'all') params.set('lead_source', leadSource);

    try {
      const res = await portalFetch(`/api/portal/leads?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
        if (data.bulkCount !== undefined) setBulkCount(data.bulkCount);
      } else {
        showToast('Leads konden niet geladen worden', 'error');
      }
    } catch {
      showToast('Leads konden niet geladen worden', 'error');
    }
    setLoading(false);
  }, [page, sort, order, statusFilter, branchFilter, search, dateFrom, dateTo, leadSource, showToast]);

  const fetchBranches = useCallback(async () => {
    try {
      const res = await portalFetch('/api/portal/branches');
      if (res.ok) { const d = await res.json(); setBranchConfigs(d.branches || []); }
    } catch { /* non-critical */ }
  }, []);

  const fetchBatches = useCallback(async () => {
    setBatchesLoading(true);
    try {
      const res = await portalFetch('/api/portal/batches');
      if (res.ok) {
        const d = await res.json();
        setBatches({ active: d.active || [], completed: d.completed || [] });
      } else {
        showToast('Batches konden niet geladen worden', 'error');
      }
    } catch {
      showToast('Batches konden niet geladen worden', 'error');
    }
    setBatchesLoading(false);
  }, [showToast]);

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

    try {
      const res = await portalFetch('/api/portal/leads', {
        method: 'PUT',
        body: JSON.stringify({ id: lead.id, status: newStatus }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Status bijwerken mislukt');
      }
      showToast('Status bijgewerkt');
      fetchStats(true);
    } catch (err) {
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: oldStatus } : l));
      if (selectedLead?.id === lead.id) {
        setSelectedLead({ ...lead, status: oldStatus });
      }
      showToast(err instanceof Error ? err.message : 'Fout bij bijwerken status', 'error');
    }
  };

  const handleNotesUpdate = async (lead: Lead, newNotes: string) => {
    const oldNotes = lead.notities;

    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, notities: newNotes } : l));
    if (selectedLead?.id === lead.id) {
      setSelectedLead({ ...lead, notities: newNotes });
    }

    try {
      const res = await portalFetch('/api/portal/leads', {
        method: 'PUT',
        body: JSON.stringify({ id: lead.id, notities: newNotes }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Notities opslaan mislukt');
      }
      showToast('Notities opgeslagen');
    } catch (err) {
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, notities: oldNotes } : l));
      if (selectedLead?.id === lead.id) {
        setSelectedLead({ ...lead, notities: oldNotes });
      }
      showToast(err instanceof Error ? err.message : 'Fout bij opslaan notities', 'error');
    }
  };

  const exportFilters = useMemo<ExportFilters>(() => ({
    statusFilter,
    branchFilter,
    dateFrom,
    dateTo,
    leadSource,
    search,
  }), [statusFilter, branchFilter, dateFrom, dateTo, leadSource, search]);

  const branchFieldsForExport = useMemo(() => {
    const customerBranchSlugs = new Set(customer.branches);
    const fields: { key: string; label: string }[] = [];
    const seen = new Set<string>();
    branchConfigs
      .filter(b => customerBranchSlugs.has(b.slug))
      .forEach(b => {
        (b.branch_fields || []).forEach(f => {
          if (!seen.has(f.key)) {
            seen.add(f.key);
            fields.push({ key: f.key, label: f.label });
          }
        });
      });
    return fields;
  }, [branchConfigs, customer.branches]);

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

  const handlePayBatch = useCallback(async (batchId: string) => {
    setPayingBatch(batchId);
    try {
      const res = await portalFetch('/api/portal/pay-batch', {
        method: 'POST',
        body: JSON.stringify({ batch_id: batchId }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Betaling starten mislukt', 'error');
        return;
      }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch {
      showToast('Er is iets misgegaan', 'error');
    } finally {
      setPayingBatch(null);
    }
  }, [showToast]);

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

      {/* Welcome overlay for new signups */}
      <AnimatePresence>
        {showWelcome && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-brand-navy/80 backdrop-blur-md p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="welcome-dialog-title"
            onKeyDown={(e) => {
              if (e.key === 'Escape') setShowWelcome(false);
              if (e.key === 'Tab') {
                const dialog = e.currentTarget.querySelector<HTMLElement>('[data-welcome-panel]');
                if (!dialog) return;
                const focusable = dialog.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])');
                if (focusable.length === 0) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
              }
            }}
          >
            <motion.div
              data-welcome-panel
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 22, stiffness: 300 }}
              className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
              ref={(el) => { if (el) { const btn = el.querySelector<HTMLElement>('button'); btn?.focus(); } }}
            >
              <div className="h-1 bg-warmeleads-gradient" />
              <div className="p-6 text-center sm:p-8">
                <div className="mx-auto mb-4 text-5xl" aria-hidden="true">🎉</div>
                <h2 id="welcome-dialog-title" className="text-2xl font-bold text-slate-900">
                  Welkom bij WarmeLeads{customer.name ? `, ${customer.name}` : ''}!
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  {customer.demo_mode
                    ? 'Je account is aangemaakt! Je zit nu in demo modus met voorbeeldleads zodat je het portaal kunt ervaren.'
                    : 'Je account is succesvol aangemaakt. Ontdek je persoonlijke leadportaal.'}
                </p>

                {/* Incentive block */}
                <div className="mt-5 rounded-xl border-2 border-brand-purple/20 bg-gradient-to-br from-brand-purple/5 to-brand-pink/5 p-5">
                  <p className="text-xl font-bold text-brand-purple">20% welkomstkorting</p>
                  <p className="mt-1 text-sm text-slate-600">Op je eerste bestelling, automatisch toegepast</p>
                  {welcomeOffer.expiresAt && (
                    <p className="mt-1.5 text-xs font-semibold text-brand-orange">
                      Geldig tot {new Date(welcomeOffer.expiresAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  )}
                </div>

                {/* Quick start steps */}
                <div className="mt-5 space-y-2 text-left">
                  <div className="flex items-center gap-3 rounded-lg bg-emerald-50 p-3">
                    <CheckCircleIcon className="h-5 w-5 shrink-0 text-emerald-500" />
                    <span className="text-sm font-medium text-emerald-700">Account aangemaakt</span>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg bg-brand-purple/5 p-3 ring-2 ring-brand-purple/20">
                    <SparklesIcon className="h-5 w-5 shrink-0 text-brand-purple" />
                    <span className="text-sm font-medium text-brand-purple">
                      {customer.demo_mode ? 'Bekijk demo leads' : 'Bekijk je portaal'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                    <ShoppingCartIcon className="h-5 w-5 shrink-0 text-slate-400" />
                    <span className="text-sm text-slate-500">
                      {customer.demo_mode ? 'Bestel je eerste batch voor echte leads' : 'Bestel je eerste leads'}
                    </span>
                  </div>
                </div>

                {/* Buttons */}
                <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                  <button
                    onClick={() => setShowWelcome(false)}
                    className="flex-1 rounded-xl bg-brand-purple px-4 py-3 text-sm font-bold text-white transition hover:bg-brand-purple/90"
                  >
                    {customer.demo_mode ? 'Bekijk demo portaal' : 'Bekijk mijn portaal'}
                  </button>
                  <Link
                    href="/portal/bestellen"
                    onClick={() => setShowWelcome(false)}
                    className="flex-1 rounded-xl bg-button-gradient px-4 py-3 text-center text-sm font-bold text-white shadow-lg shadow-brand-orange/20 transition hover:shadow-brand-orange/30"
                  >
                    Direct bestellen
                  </Link>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Welcome offer banner */}
      {welcomeOffer.active && !welcomeDismissed && !showWelcome && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-purple/20 bg-gradient-to-r from-brand-purple/5 via-brand-pink/5 to-brand-orange/5 p-4"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎁</span>
            <div>
              <p className="text-sm font-bold text-slate-900">
                Je welkomstkorting van 20% is nog{' '}
                {welcomeOffer.expiresAt
                  ? `${Math.max(0, Math.ceil((new Date(welcomeOffer.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} dagen`
                  : ''}{' '}
                geldig
              </p>
              <p className="text-xs text-slate-500">Automatisch toegepast bij je eerste bestelling</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/portal/bestellen"
              className="rounded-lg bg-button-gradient px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:shadow-md"
            >
              Bestel nu
            </Link>
            <button
              onClick={() => setWelcomeDismissed(true)}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}

      {/* Welcome */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
          Welkom, {customer.contact_person || customer.name}
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Leadoverzicht voor {customer.name}
        </p>
      </div>

      <BatchConversionCard
        customerDemoMode={customer.demo_mode}
        batchesLoading={batchesLoading}
        primaryBatch={primaryBatch}
        progressPct={primaryBatchProgressPct}
        isUnpaid={primaryBatchIsUnpaid}
        shouldUpsell={primaryBatchShouldUpsell}
        payingBatch={payingBatch}
        onPayBatch={handlePayBatch}
        onOpenOverview={() => setShowOverviewPanel(true)}
      />

      <div className="overflow-x-auto hide-scrollbar">
        <div className="flex min-w-max snap-x snap-mandatory items-stretch gap-2 pb-0.5">
          <button
            onClick={viewNewLeads}
            className="inline-flex min-h-11 snap-start items-center gap-1.5 rounded-xl border border-blue-100 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
          >
            <SparklesIcon className="h-4 w-4" />
            {stats.newThisWeek} nieuw deze week
          </button>
          <button
            onClick={() => setShowOverviewPanel(true)}
            className="inline-flex min-h-11 snap-start items-center gap-1.5 rounded-xl border border-brand-purple/20 bg-brand-purple/5 px-3.5 py-2 text-xs font-semibold text-brand-purple transition hover:bg-brand-purple/10"
          >
            <ChartBarIcon className="h-4 w-4" />
            Conversie {conversionRate}%
          </button>
          <button
            onClick={() => setShowExportWizard(true)}
            disabled={total === 0}
            className="inline-flex min-h-11 snap-start items-center gap-1.5 rounded-xl border border-brand-purple/30 bg-brand-purple/5 px-3.5 py-2 text-xs font-semibold text-brand-purple transition hover:bg-brand-purple/10 disabled:opacity-40"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            Exporteer
          </button>
          <button
            onClick={() => setShowOverviewPanel(true)}
            className="inline-flex min-h-11 snap-start items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Overzicht
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <OverviewDetailPanel
        open={showOverviewPanel}
        onClose={() => setShowOverviewPanel(false)}
        customer={customer}
        batches={batches}
        batchesLoading={batchesLoading}
        stats={stats}
        statsLoading={statsLoading}
        conversionRate={conversionRate}
        hasUnpaidBatch={hasUnpaidBatch}
        onPayBatch={handlePayBatch}
        payingBatch={payingBatch}
        onViewNewLeads={viewNewLeads}
        getBranch={getBranch}
      />

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
            onClick={() => setShowExportWizard(true)}
            disabled={total === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-purple/30 bg-brand-purple/5 px-3 py-2 text-sm font-medium text-brand-purple transition hover:bg-brand-purple/10 disabled:opacity-40"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Exporteer</span>
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

      {/* Lead source tabs */}
      {(bulkCount > 0 || (stats.bulkLeads ?? 0) > 0) && (
        <div className="rounded-xl bg-slate-100 p-1">
          <div className="relative flex">
            {([
              { key: 'all' as const, label: 'Alle leads', count: stats.totalLeads, dot: null },
              { key: 'fresh' as const, label: 'Verse leads', count: Math.max(0, stats.totalLeads - (stats.bulkLeads || 0)), dot: 'bg-emerald-500' },
              { key: 'bulk' as const, label: 'Bulk leads', count: stats.bulkLeads || 0, dot: 'bg-indigo-500' },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => { setLeadSource(tab.key); setPage(1); }}
                className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  leadSource === tab.key ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.dot && <span className={`h-2 w-2 shrink-0 rounded-full ${tab.dot}`} />}
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.key === 'all' ? 'Alle' : tab.key === 'fresh' ? 'Vers' : 'Bulk'}</span>
                <span className={`rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${
                  leadSource === tab.key ? 'bg-slate-200 text-slate-700' : 'bg-transparent text-slate-400'
                }`}>
                  {tab.count.toLocaleString('nl-NL')}
                </span>
                {leadSource === tab.key && (
                  <motion.div
                    layoutId="leadSourcePill"
                    className="absolute inset-0 rounded-lg bg-white shadow-sm"
                    style={{ zIndex: -1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

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
                      { key: 'distance_km', label: 'Afstand' },
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
                      <td className="px-4 py-3 tabular-nums">
                        {formatDistance(lead.distance_km)
                          ? <span className="text-slate-500">{formatDistance(lead.distance_km)}</span>
                          : <span className="text-slate-300">&ndash;</span>}
                      </td>
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
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">{lead.naam_klant || '-'}</p>
                    {(lead.plaatsnaam || lead.postcode) && (
                      <p className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
                        <MapPinIcon className="h-3 w-3 shrink-0" />
                        <span className="truncate">{[lead.postcode, lead.huisnummer, lead.plaatsnaam].filter(Boolean).join(', ')}{lead.provincie ? ` (${lead.provincie})` : ''}</span>
                        {formatDistance(lead.distance_km) && (
                          <span className="shrink-0 text-slate-400">&middot; {formatDistance(lead.distance_km)}</span>
                        )}
                      </p>
                    )}
                  </div>
                  <select
                    value={lead.status}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => handleStatusUpdate(lead, e.target.value)}
                    className={`rounded-full border-0 px-2.5 py-1 text-[11px] font-medium outline-none ${STATUS_COLORS[lead.status] || 'bg-slate-100 text-slate-600'}`}
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
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-50 py-2.5 text-xs font-medium text-emerald-700 transition active:bg-emerald-100"
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
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-green-50 py-2.5 text-xs font-medium text-green-700 transition active:bg-green-100"
                    >
                      <WhatsAppIcon className="h-3.5 w-3.5" /> WhatsApp
                    </a>
                  )}
                  {lead.email && (
                    <a
                      href={`mailto:${lead.email}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-50 py-2.5 text-xs font-medium text-blue-700 transition active:bg-blue-100"
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
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
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

      {/* Export wizard */}
      <ExportWizard
        open={showExportWizard}
        onClose={() => setShowExportWizard(false)}
        filters={exportFilters}
        totalLeads={total}
        customerName={customer.name}
        branchFields={branchFieldsForExport}
      />

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

  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyField = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const copyContactInfo = () => {
    const lines = [
      lead.naam_klant,
      lead.telefoonnummer,
      lead.email,
      [lead.postcode, lead.huisnummer, lead.plaatsnaam, lead.provincie].filter(Boolean).join(', '),
    ].filter(Boolean);
    navigator.clipboard.writeText(lines.join('\n'));
    showToast('Alle contactgegevens gekopieerd');
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
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
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
                  className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <ClipboardDocumentIcon className="h-3.5 w-3.5" />
                  Kopieer alles
                </button>
              </div>
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50">
                {lead.telefoonnummer && (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <PhoneIcon className="h-4 w-4 shrink-0 text-slate-400" />
                    <a href={`tel:${lead.telefoonnummer}`} className="min-w-0 flex-1 truncate text-sm text-slate-700 hover:text-brand-purple">
                      {lead.telefoonnummer}
                    </a>
                    <div className="flex shrink-0 items-center gap-1">
                      <a href={whatsappUrl(lead.telefoonnummer)} target="_blank" rel="noopener noreferrer"
                        className="rounded-md bg-green-50 p-2 text-green-600 transition hover:bg-green-100" title="WhatsApp">
                        <WhatsAppIcon className="h-4 w-4" />
                      </a>
                      <button onClick={() => copyField(lead.telefoonnummer, 'tel')}
                        className={`rounded-md p-2 transition ${copiedField === 'tel' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600'}`}
                        title="Kopieer telefoonnummer">
                        {copiedField === 'tel' ? <ClipboardDocumentCheckIcon className="h-4 w-4" /> : <ClipboardDocumentIcon className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                )}
                {lead.email && (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <EnvelopeIcon className="h-4 w-4 shrink-0 text-slate-400" />
                    <a href={`mailto:${lead.email}`} className="min-w-0 flex-1 truncate text-sm text-slate-700 hover:text-brand-purple">
                      {lead.email}
                    </a>
                    <button onClick={() => copyField(lead.email, 'email')}
                      className={`shrink-0 rounded-md p-2 transition ${copiedField === 'email' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600'}`}
                      title="Kopieer e-mailadres">
                      {copiedField === 'email' ? <ClipboardDocumentCheckIcon className="h-4 w-4" /> : <ClipboardDocumentIcon className="h-4 w-4" />}
                    </button>
                  </div>
                )}
                {lead.naam_klant && (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <UserGroupIcon className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{lead.naam_klant}</span>
                    <button onClick={() => copyField(lead.naam_klant, 'naam')}
                      className={`shrink-0 rounded-md p-2 transition ${copiedField === 'naam' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600'}`}
                      title="Kopieer naam">
                      {copiedField === 'naam' ? <ClipboardDocumentCheckIcon className="h-4 w-4" /> : <ClipboardDocumentIcon className="h-4 w-4" />}
                    </button>
                  </div>
                )}
                {(lead.postcode || lead.plaatsnaam) && (() => {
                  const adres = [lead.postcode, lead.huisnummer, lead.plaatsnaam, lead.provincie].filter(Boolean).join(', ');
                  const dist = formatDistance(lead.distance_km);
                  return (
                    <div className="flex items-center gap-3 px-4 py-3">
                      <MapPinIcon className="h-4 w-4 shrink-0 text-slate-400" />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-slate-700">{adres}</span>
                        {dist && <span className="text-xs text-slate-400">{dist} van je targetplaats</span>}
                      </div>
                      <button onClick={() => copyField(adres, 'adres')}
                        className={`shrink-0 rounded-md p-2 transition ${copiedField === 'adres' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600'}`}
                        title="Kopieer adres">
                        {copiedField === 'adres' ? <ClipboardDocumentCheckIcon className="h-4 w-4" /> : <ClipboardDocumentIcon className="h-4 w-4" />}
                      </button>
                    </div>
                  );
                })()}
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
                    <div key={f.label} className="flex justify-between gap-3 text-sm">
                      <span className="shrink-0 text-slate-500">{f.label}</span>
                      <span className="min-w-0 break-words text-right font-medium text-slate-700">{f.value}</span>
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

            {/* Reclamatie */}
            <LeadReclamation leadId={lead.id} showToast={showToast} />

            {/* Notes */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Notities</label>
              <textarea
                value={notes}
                onChange={(e) => { setNotes(e.target.value); setNotesDirty(true); }}
                rows={4}
                placeholder="Voeg hier je notities toe..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-purple/50"
              />
              {notesDirty && (
                <button
                  onClick={saveNotes}
                  className="mt-2 rounded-lg bg-button-gradient px-4 py-2 text-sm font-bold text-white shadow-sm"
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

function BatchConversionCard({
  customerDemoMode,
  batchesLoading,
  primaryBatch,
  progressPct,
  isUnpaid,
  shouldUpsell,
  payingBatch,
  onPayBatch,
  onOpenOverview,
}: {
  customerDemoMode: boolean;
  batchesLoading: boolean;
  primaryBatch: Batch | null;
  progressPct: number;
  isUnpaid: boolean;
  shouldUpsell: boolean;
  payingBatch: string | null;
  onPayBatch: (batchId: string) => void;
  onOpenOverview: () => void;
}) {
  if (customerDemoMode) {
    return (
      <div className="rounded-xl border border-brand-purple/25 bg-gradient-to-r from-brand-purple/[0.06] via-brand-pink/[0.05] to-brand-orange/[0.05] p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1 rounded-full bg-brand-purple/10 px-2.5 py-1 text-[11px] font-semibold text-brand-purple">
              <SparklesIcon className="h-3.5 w-3.5" />
              Demo modus
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-900">Je test momenteel met demo leads</p>
            <p className="mt-0.5 text-xs text-slate-600">Bestel je eerste batch om direct echte leads te ontvangen.</p>
          </div>
          <Link
            href="/portal/bestellen"
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-button-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-orange/20 transition hover:brightness-105"
          >
            <ShoppingCartIcon className="h-4 w-4" />
            Bestel je eerste batch
          </Link>
        </div>
      </div>
    );
  }

  if (batchesLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="space-y-2.5">
          <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
          <div className="h-2.5 w-full animate-pulse rounded-full bg-slate-100" />
          <div className="h-10 w-full animate-pulse rounded-lg bg-slate-100 sm:w-56" />
        </div>
      </div>
    );
  }

  if (!primaryBatch) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Geen actieve batch</p>
            <p className="mt-0.5 text-xs text-slate-500">Start direct een nieuwe batch om instroom te activeren.</p>
          </div>
          <Link
            href="/portal/bestellen"
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-button-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-orange/20 transition hover:brightness-105"
          >
            <ShoppingCartIcon className="h-4 w-4" />
            Bestel je eerste batch
          </Link>
        </div>
      </div>
    );
  }

  const batchId = typeof primaryBatch.id === 'string' ? primaryBatch.id : null;
  const branchLabel = String(primaryBatch.branch_name || primaryBatch.branch || 'Batch');
  const delivered = Math.min(
    Number(primaryBatch.leads_delivered || 0),
    Number(primaryBatch.batch_size || 0),
  );
  const size = Number(primaryBatch.batch_size || 0);
  const amountInclBtw = Number(primaryBatch.total_price || 0) > 0
    ? Math.round(Number(primaryBatch.total_price || 0) * 1.21 * 100) / 100
    : null;
  const statusTone = isUnpaid
    ? 'border-red-200 bg-red-50/70'
    : shouldUpsell
      ? 'border-brand-purple/30 bg-brand-purple/[0.04]'
      : 'border-slate-200 bg-white';
  const progressTone = isUnpaid
    ? 'from-red-500 to-orange-500'
    : shouldUpsell
      ? 'from-brand-purple to-brand-pink'
      : 'from-brand-purple/70 to-brand-pink/70';

  return (
    <div className={`rounded-xl p-3 shadow-sm sm:p-4 ${statusTone}`}>
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1 rounded-full bg-slate-900/5 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
              <BoltIcon className="h-3.5 w-3.5" />
              {branchLabel}
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {isUnpaid ? 'Batch staat klaar voor betaling' : shouldUpsell ? 'Batch bijna afgerond' : 'Batch actief'}
            </p>
            <p className="mt-0.5 text-xs text-slate-600">
              {isUnpaid
                ? 'Na betaling start levering direct.'
                : shouldUpsell
                  ? 'Bijna klaar - voorkom een gat in je instroom.'
                  : 'Volg je voortgang en houd grip op je planning.'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-slate-500">Voortgang</p>
            <p className="text-base font-bold text-slate-900">{delivered} / {size}</p>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-slate-500">
            <span>{progressPct}% geleverd</span>
            {Number(primaryBatch.leads_per_day || 0) > 0 && (
              <span>Max {Number(primaryBatch.leads_per_day)} per dag</span>
            )}
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-200/70">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${progressTone}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {isUnpaid && batchId ? (
            <button
              onClick={() => onPayBatch(batchId)}
              disabled={payingBatch === batchId}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-red-300 bg-red-100 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-200 disabled:opacity-60"
            >
              <CreditCardIcon className="h-4 w-4" />
              {payingBatch === batchId
                ? 'Betaling openen...'
                : `Batch betalen${amountInclBtw ? ` - ${formatCurrencyEUR(amountInclBtw)} incl. btw` : ''}`}
            </button>
          ) : shouldUpsell ? (
            <Link
              href={batchId ? `/portal/bestellen?batch=${batchId}` : '/portal/bestellen'}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-button-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-orange/20 transition hover:brightness-105"
            >
              <ShoppingCartIcon className="h-4 w-4" />
              Nieuwe batch bestellen
            </Link>
          ) : (
            <button
              onClick={onOpenOverview}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <ClockIcon className="h-4 w-4" />
              Bekijk batchdetails
            </button>
          )}
          <button
            onClick={onOpenOverview}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white/80 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-white"
          >
            Overzicht
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function OverviewDetailPanel({
  open,
  onClose,
  customer,
  batches,
  batchesLoading,
  stats,
  statsLoading,
  conversionRate,
  hasUnpaidBatch,
  onPayBatch,
  payingBatch,
  onViewNewLeads,
  getBranch,
}: {
  open: boolean;
  onClose: () => void;
  customer: { demo_mode: boolean };
  batches: { active: Batch[]; completed: Batch[] };
  batchesLoading: boolean;
  stats: Stats;
  statsLoading: boolean;
  conversionRate: number;
  hasUnpaidBatch: boolean;
  onPayBatch: (batchId: string) => void;
  payingBatch: string | null;
  onViewNewLeads: () => void;
  getBranch: (slug: string) => { name: string; light: string; text: string };
}) {
  const topActiveBatch = batches.active[0];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/35 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            className="fixed inset-x-0 bottom-0 z-[80] max-h-[84vh] overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl md:inset-y-0 md:right-0 md:left-auto md:max-h-full md:w-[560px] md:rounded-none md:rounded-l-2xl"
          >
        <div className="border-b border-slate-100 px-4 py-3 md:px-5">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-200 md:hidden" />
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Overzicht</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="Sluiten"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-4 overflow-y-auto p-4 md:p-5">
          {customer.demo_mode && (
            <div className="rounded-xl border border-dashed border-brand-purple/30 bg-brand-purple/[0.03] p-4">
              <p className="text-sm font-semibold text-slate-800">Demo modus actief</p>
              <p className="mt-1 text-xs text-slate-500">Je bekijkt demo leads. Bestel je eerste batch voor echte leads.</p>
              <Link
                href="/portal/bestellen"
                onClick={onClose}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-button-gradient px-3 py-2 text-xs font-semibold text-white"
              >
                <SparklesIcon className="h-3.5 w-3.5" />
                Bestel je eerste batch
              </Link>
            </div>
          )}

          {!customer.demo_mode && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              {batchesLoading ? (
                <div className="space-y-2">
                  <div className="h-4 w-28 animate-pulse rounded bg-slate-100" />
                  <div className="h-2.5 w-full animate-pulse rounded bg-slate-100" />
                  <div className="h-3 w-40 animate-pulse rounded bg-slate-50" />
                </div>
              ) : topActiveBatch ? (
                <>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="rounded-full bg-brand-purple/10 px-2.5 py-0.5 text-[11px] font-semibold text-brand-purple">
                      {String(topActiveBatch.branch_name || topActiveBatch.branch || 'Batch')}
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      {Math.min(
                        Number(topActiveBatch.leads_delivered || 0),
                        Number(topActiveBatch.batch_size || 0),
                      )} / {Number(topActiveBatch.batch_size || 0)}
                    </span>
                  </div>
                  <div className="mb-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-purple to-brand-pink"
                      style={{
                        width: `${Number(topActiveBatch.batch_size || 0) > 0
                          ? Math.min(100, Math.round((Number(topActiveBatch.leads_delivered || 0) / Number(topActiveBatch.batch_size || 1)) * 100))
                          : 0}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    {Number(topActiveBatch.leads_per_day || 0) > 0 ? `Max ${Number(topActiveBatch.leads_per_day)} per dag` : 'Geen daglimiet'}
                  </p>
                  {topActiveBatch.is_paid === false && typeof topActiveBatch.id === 'string' && (
                    <button
                      onClick={() => onPayBatch(topActiveBatch.id as string)}
                      disabled={payingBatch === topActiveBatch.id}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                    >
                      {payingBatch === topActiveBatch.id ? 'Laden...' : 'Batch betalen'}
                    </button>
                  )}
                </>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-slate-800">Geen actieve batch</p>
                  <p className="mt-1 text-xs text-slate-500">Bestel een batch om nieuwe leads te ontvangen.</p>
                  <Link
                    href="/portal/bestellen"
                    onClick={onClose}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-button-gradient px-3 py-2 text-xs font-semibold text-white"
                  >
                    <ShoppingCartIcon className="h-3.5 w-3.5" />
                    Naar bestellen
                  </Link>
                </div>
              )}
            </div>
          )}

          {statsLoading ? (
            <StatsSkeleton />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Totaal leads', value: stats.totalLeads, icon: UserGroupIcon, color: 'text-brand-purple', bg: 'bg-brand-purple/10' },
                  { label: 'Nieuw deze week', value: stats.newThisWeek, icon: SparklesIcon, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Gecontacteerd', value: stats.contacted, icon: ArrowTrendingUpIcon, color: 'text-amber-600', bg: 'bg-amber-50' },
                  { label: 'Verkocht', value: stats.sold, icon: CheckCircleIcon, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                ].map(stat => (
                  <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${stat.bg}`}>
                      <stat.icon className={`h-4 w-4 ${stat.color}`} />
                    </div>
                    <p className="mt-2 text-xl font-bold text-slate-900">{stat.value}</p>
                    <p className="text-[11px] text-slate-500">{stat.label}</p>
                  </div>
                ))}
              </div>

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
                          className="h-full rounded-full bg-gradient-to-r from-brand-purple to-brand-pink"
                          style={{ width: `${Math.min(conversionRate, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-slate-900">{conversionRate}%</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    onViewNewLeads();
                    onClose();
                  }}
                  className="flex items-center gap-3 rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 text-left shadow-sm transition hover:shadow-md sm:flex-1"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                    <SparklesIcon className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {stats.newThisWeek} nieuwe {stats.newThisWeek === 1 ? 'lead' : 'leads'}
                    </p>
                    <p className="text-xs text-slate-500">Klik om te bekijken</p>
                  </div>
                </button>
              </div>

              {stats.totalLeads > 0 && <MiniCharts stats={stats} getBranch={getBranch} />}
            </>
          )}

          {hasUnpaidBatch && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs text-red-700">
              Je hebt minimaal één onbetaalde batch. Betaal deze om levering te hervatten.
            </div>
          )}
        </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ─── Mini Charts ─────────────────────────────────────────── */
function MiniCharts({ stats, getBranch }: { stats: Stats & { statusBreakdown?: Record<string, number>; branchBreakdown?: Record<string, number> }; getBranch: (slug: string) => { name: string; light: string; text: string } }) {
  const statusData = stats.statusBreakdown || {};
  const branchData = stats.branchBreakdown || {};

  const statusColors: Record<string, string> = {
    nieuw: '#3B82F6',
    gecontacteerd: '#F59E0B',
    geen_gehoor: '#F97316',
    offerte: '#8B5CF6',
    verkocht: '#10B981',
    afgewezen: '#94A3B8',
  };

  const statusLabels: Record<string, string> = {
    nieuw: 'Nieuw',
    gecontacteerd: 'Gecontacteerd',
    geen_gehoor: 'Geen gehoor',
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
    const prevRating = rating;
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
      setRating(prevRating);
      setSaved(!!prevRating);
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

/* ─── Lead Reclamation ─────────────────────────────────────── */
const RECLAMATION_REASONS = [
  { value: 'foutief_telefoonnummer', label: 'Foutief telefoonnummer' },
  { value: 'dubbele_lead', label: 'Dubbele lead binnen 30 dagen' },
  { value: 'buiten_doelgebied', label: 'Buiten mijn afgesproken gebied' },
] as const;

const RECLAMATION_STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending: { label: 'In behandeling', cls: 'bg-amber-50 text-amber-700' },
  approved: { label: 'Goedgekeurd', cls: 'bg-emerald-50 text-emerald-700' },
  rejected: { label: 'Afgewezen', cls: 'bg-red-50 text-red-600' },
};

function LeadReclamation({ leadId, showToast }: { leadId: string; showToast: (m: string) => void }) {
  const [existing, setExisting] = useState<{ id: string; reason: string; description?: string; status: string; created_at: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    setOpen(false);
    setReason('');
    setDescription('');
    portalFetch(`/api/portal/reclamations?lead_id=${leadId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.reclamation) setExisting(d.reclamation); else setExisting(null); })
      .finally(() => setLoading(false));
  }, [leadId]);

  const submit = async () => {
    if (!reason) { showToast('Selecteer een reden'); return; }
    setSubmitting(true);
    try {
      const res = await portalFetch('/api/portal/reclamations', {
        method: 'POST',
        body: JSON.stringify({ lead_id: leadId, reason, description: description || undefined }),
      });
      if (res.ok) {
        const d = await res.json();
        setExisting(d.reclamation);
        setOpen(false);
        showToast('Reclamatie ingediend');
      } else {
        const d = await res.json().catch(() => ({}));
        showToast(d.error || 'Reclamatie indienen mislukt');
      }
    } catch {
      showToast('Er ging iets mis');
    }
    setSubmitting(false);
  };

  if (loading) return null;

  if (existing) {
    const st = RECLAMATION_STATUS_MAP[existing.status] || RECLAMATION_STATUS_MAP.pending;
    const reasonLabel = RECLAMATION_REASONS.find(r => r.value === existing.reason)?.label || existing.reason;
    return (
      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <FlagIcon className="h-3.5 w-3.5" /> Reclamatie
          </h3>
          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${st.cls}`}>{st.label}</span>
        </div>
        <p className="text-sm text-slate-600">{reasonLabel}</p>
        {existing.description && <p className="mt-1 text-xs text-slate-400">{existing.description}</p>}
        <p className="mt-2 text-[10px] text-slate-400">
          Ingediend op {new Date(existing.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>
    );
  }

  return (
    <div>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 px-4 py-3 text-xs font-medium text-slate-400 transition hover:border-red-300 hover:bg-red-50 hover:text-red-500"
        >
          <FlagIcon className="h-4 w-4" />
          Reclamatie indienen
        </button>
      ) : (
        <div className="rounded-xl border border-red-100 bg-red-50/50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold text-red-700">
              <FlagIcon className="h-3.5 w-3.5" /> Reclamatie indienen
            </h3>
            <button onClick={() => setOpen(false)} className="rounded p-0.5 text-slate-400 hover:text-slate-600">
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Reden</label>
              <div className="relative">
                <select value={reason} onChange={(e) => setReason(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-red-200 bg-white px-3 py-2 pr-8 text-sm text-slate-700 outline-none focus:border-red-300 focus:ring-1 focus:ring-red-200">
                  <option value="">Selecteer een reden...</option>
                  {RECLAMATION_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Toelichting <span className="text-slate-300">(optioneel)</span></label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                placeholder="Omschrijf kort het probleem..."
                className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-red-300 focus:ring-1 focus:ring-red-200" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setOpen(false)}
                className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
                Annuleren
              </button>
              <button onClick={submit} disabled={submitting || !reason}
                className="flex-1 rounded-lg bg-red-600 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50">
                {submitting ? 'Indienen...' : 'Indienen'}
              </button>
            </div>
            <p className="text-[10px] leading-relaxed text-slate-400">
              Reclamaties worden binnen 2 werkdagen beoordeeld. Bij goedkeuring wordt de lead niet in rekening gebracht.
            </p>
          </div>
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
    const wasEnabled = pushState === 'enabled';
    const success = await onToggle();
    if (success) {
      showToast(wasEnabled ? 'Push notificaties uitgeschakeld' : 'Push notificaties ingeschakeld');
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
              {pushState === 'disabled' && 'Ontvang direct een melding op je telefoon'}
              {isDenied && 'Geblokkeerd in je browser'}
              {isIosNotInstalled && 'Installeer eerst de app'}
            </p>
          </div>
        </div>
        {!isDenied && !isIosNotInstalled && (
          <button
            type="button"
            onClick={handleToggle}
            disabled={pushToggling}
            role="switch"
            aria-checked={isEnabled}
            className={`relative inline-flex h-[26px] w-[48px] shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/50 focus-visible:ring-offset-2 disabled:opacity-50 ${isEnabled ? 'bg-brand-purple' : 'bg-slate-300'}`}
          >
            <span className={`pointer-events-none inline-block h-[22px] w-[22px] transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isEnabled ? 'translate-x-[24px]' : 'translate-x-[2px]'}`} />
          </button>
        )}
      </div>
      {isDenied && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3">
          <ExclamationTriangleIcon className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
          <p className="text-xs text-amber-700">
            Notificaties zijn geblokkeerd in je browser. Ga naar je browserinstellingen om dit te wijzigen.
          </p>
        </div>
      )}
      {isIosNotInstalled && (
        <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3">
          <DevicePhoneMobileIcon className="h-4 w-4 shrink-0 text-blue-500 mt-0.5" />
          <p className="text-xs text-blue-700">
            Installeer de app op je startscherm om push notificaties te ontvangen.
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
                  type="button"
                  onClick={handleToggle}
                  role="switch"
                  aria-checked={enabled}
                  className={`relative inline-flex h-[26px] w-[48px] shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/50 focus-visible:ring-offset-2 ${enabled ? 'bg-brand-purple' : 'bg-slate-300'}`}
                >
                  <span className={`pointer-events-none inline-block h-[22px] w-[22px] transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${enabled ? 'translate-x-[24px]' : 'translate-x-[2px]'}`} />
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
                    {freq === 'instant' && 'Je ontvangt direct een e-mail bij elke nieuwe lead.'}
                    {freq === 'daily' && 'Je ontvangt elke ochtend een overzicht van nieuwe leads.'}
                    {freq === 'weekly' && 'Je ontvangt elke maandag een overzicht van de afgelopen week.'}
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
              Wil je wijzigingen aanbrengen aan je account? Neem contact op via{' '}
              <a href="mailto:info@warmeleads.eu" className="text-brand-purple hover:underline">info@warmeleads.eu</a>
            </p>
          </div>
        </div>
      </motion.div>
    </>
  );
}
