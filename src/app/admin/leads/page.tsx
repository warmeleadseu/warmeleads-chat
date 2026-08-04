'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpDownIcon,
  MapPinIcon,
  ExclamationTriangleIcon,
  CheckIcon,
  ChevronDownIcon,
  ArrowUturnLeftIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';
import {
  PROVINCES_ALL,
  LEAD_PROVINCE_OPTIONS_NL,
  LEAD_PROVINCE_OPTIONS_BE,
} from '@/data/provinces';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { parsePostcodeRanges } from '@/lib/postcodeRanges';
import { DISTANCE_PRESETS_KM } from '@/lib/portalLeadGeoFilters';

/* ── Multi-select dropdown ─────────────────────────────────── */

interface MultiSelectOption { value: string; label: string; }
interface MultiSelectGroup { label: string; options: MultiSelectOption[]; }

function MultiSelect({
  label,
  allLabel,
  options,
  groups,
  selected,
  onChange,
  searchable = false,
  counts,
}: {
  label: string;
  allLabel: string;
  options?: MultiSelectOption[];
  groups?: MultiSelectGroup[];
  selected: string[];
  onChange: (v: string[]) => void;
  searchable?: boolean;
  counts?: Record<string, number>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const allOptions = useMemo(() => {
    if (groups) return groups.flatMap(g => g.options);
    return options || [];
  }, [options, groups]);

  const allValues = useMemo(() => allOptions.map(o => o.value), [allOptions]);
  const isAll = selected.length === 0;

  const filtered = useMemo(() => {
    if (!search) return null;
    const q = search.toLowerCase();
    return allOptions.filter(o => o.label.toLowerCase().includes(q));
  }, [search, allOptions]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch(''); }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open && searchable) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open, searchable]);

  const toggle = (val: string) => {
    if (selected.includes(val)) {
      const next = selected.filter(v => v !== val);
      onChange(next);
    } else {
      const next = [...selected, val];
      if (next.length === allValues.length) onChange([]);
      else onChange(next);
    }
  };

  const selectAll = () => onChange([]);
  const deselectAll = () => onChange([allValues[0]]);

  const selectedCount = useMemo(() => {
    if (!counts || selected.length === 0) return null;
    return selected.reduce((s, v) => s + (counts[v] || 0), 0);
  }, [counts, selected]);

  const triggerLabel = useMemo(() => {
    if (isAll) return allLabel;
    if (selected.length === 1) {
      const opt = allOptions.find(o => o.value === selected[0]);
      const lbl = opt?.label || selected[0];
      return selectedCount !== null ? `${lbl} (${selectedCount})` : lbl;
    }
    return selectedCount !== null
      ? `${selected.length} ${label} (${selectedCount})`
      : `${selected.length} ${label}`;
  }, [isAll, selected, allLabel, label, allOptions, selectedCount]);

  const hasSelection = !isAll;

  const totalFacetCount = useMemo(() => {
    if (!counts) return 0;
    return Object.values(counts).reduce((s, n) => s + n, 0);
  }, [counts]);

  const renderCheckbox = (opt: MultiSelectOption) => {
    const checked = isAll || selected.includes(opt.value);
    const count = counts?.[opt.value];
    const hasCount = count !== undefined;
    const zeroCount = hasCount && count === 0;
    return (
      <button
        key={opt.value}
        type="button"
        onClick={() => toggle(opt.value)}
        className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition hover:bg-slate-50 ${zeroCount ? 'opacity-40' : ''}`}
      >
        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${checked ? 'border-brand-purple bg-brand-purple text-white' : 'border-slate-300 bg-white'}`}>
          {checked && <CheckIcon className="h-3 w-3" />}
        </span>
        <span className="min-w-0 flex-1 truncate text-slate-700">{opt.label}</span>
        {hasCount && (
          <span className={`tabular-nums text-xs ${zeroCount ? 'text-slate-300' : 'text-slate-400'}`}>{count.toLocaleString('nl-NL')}</span>
        )}
      </button>
    );
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex w-full items-center justify-between gap-1 rounded-lg border px-3 py-2 text-sm transition ${hasSelection ? 'border-brand-purple/40 bg-brand-purple/5 text-brand-purple font-medium' : 'border-slate-200 bg-white text-slate-700'}`}
      >
        <span className="min-w-0 flex-1 truncate text-left">{triggerLabel}</span>
        <ChevronDownIcon className={`h-3.5 w-3.5 shrink-0 transition ${open ? 'rotate-180' : ''} ${hasSelection ? 'text-brand-purple' : 'text-slate-400'}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full z-50 mt-1 w-[min(16rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
          >
            {searchable && (
              <div className="border-b border-slate-100 p-2">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={searchRef}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Zoeken..."
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-1.5 pl-8 pr-3 text-sm text-slate-700 outline-none focus:border-brand-purple/50 focus:bg-white"
                  />
                </div>
              </div>
            )}

            <div className="border-b border-slate-100 px-3 py-1.5">
              <div className="flex items-center justify-between">
                <button type="button" onClick={selectAll} className={`text-xs font-medium transition ${isAll ? 'text-brand-purple' : 'text-slate-400 hover:text-slate-600'}`}>
                  Alles
                </button>
                {hasSelection && (
                  <button type="button" onClick={selectAll} className="text-xs text-slate-400 hover:text-slate-600">
                    Reset
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto py-1">
              {filtered ? (
                filtered.length === 0 ? (
                  <p className="px-3 py-3 text-center text-xs text-slate-400">Geen resultaten</p>
                ) : (
                  filtered.map(opt => renderCheckbox(opt))
                )
              ) : groups ? (
                groups.map(g => (
                  <div key={g.label}>
                    <p className="px-3 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{g.label}</p>
                    {g.options.map(opt => renderCheckbox(opt))}
                  </div>
                ))
              ) : (
                allOptions.map(opt => renderCheckbox(opt))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Facet breakdown bar ───────────────────────────────────── */

const FACET_COLORS = [
  { bg: 'bg-blue-500', dot: 'bg-blue-500', text: 'text-blue-700', light: 'bg-blue-50' },
  { bg: 'bg-emerald-500', dot: 'bg-emerald-500', text: 'text-emerald-700', light: 'bg-emerald-50' },
  { bg: 'bg-amber-500', dot: 'bg-amber-500', text: 'text-amber-700', light: 'bg-amber-50' },
  { bg: 'bg-purple-500', dot: 'bg-purple-500', text: 'text-purple-700', light: 'bg-purple-50' },
  { bg: 'bg-rose-500', dot: 'bg-rose-500', text: 'text-rose-700', light: 'bg-rose-50' },
  { bg: 'bg-cyan-500', dot: 'bg-cyan-500', text: 'text-cyan-700', light: 'bg-cyan-50' },
  { bg: 'bg-indigo-500', dot: 'bg-indigo-500', text: 'text-indigo-700', light: 'bg-indigo-50' },
  { bg: 'bg-orange-500', dot: 'bg-orange-500', text: 'text-orange-700', light: 'bg-orange-50' },
  { bg: 'bg-teal-500', dot: 'bg-teal-500', text: 'text-teal-700', light: 'bg-teal-50' },
  { bg: 'bg-pink-500', dot: 'bg-pink-500', text: 'text-pink-700', light: 'bg-pink-50' },
  { bg: 'bg-lime-500', dot: 'bg-lime-500', text: 'text-lime-700', light: 'bg-lime-50' },
  { bg: 'bg-violet-500', dot: 'bg-violet-500', text: 'text-violet-700', light: 'bg-violet-50' },
];

function FacetBreakdown({
  title,
  counts,
  options,
  selected,
}: {
  title: string;
  counts: Record<string, number>;
  options: { value: string; label: string }[];
  selected: string[];
}) {
  const items = useMemo(() => {
    const vals = selected.length > 0 ? selected : Object.keys(counts);
    return vals
      .map(v => {
        const opt = options.find(o => o.value === v);
        return { value: v, label: opt?.label || v, count: counts[v] || 0 };
      })
      .filter(item => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [counts, options, selected]);

  const total = useMemo(() => items.reduce((s, i) => s + i.count, 0), [items]);

  if (items.length < 2 || total === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500">{title}</p>
        <p className="text-xs tabular-nums text-slate-400">{total.toLocaleString('nl-NL')} totaal</p>
      </div>

      <div className="mb-2.5 flex h-5 overflow-hidden rounded-full bg-slate-100">
        {items.map((item, i) => {
          const pct = (item.count / total) * 100;
          const color = FACET_COLORS[i % FACET_COLORS.length];
          return (
            <div
              key={item.value}
              className={`${color.bg} flex items-center justify-center transition-all duration-500 first:rounded-l-full last:rounded-r-full`}
              style={{ width: `${Math.max(pct, 1.5)}%` }}
              title={`${item.label}: ${item.count.toLocaleString('nl-NL')} (${pct.toFixed(1)}%)`}
            >
              {pct > 10 && (
                <span className="truncate px-1.5 text-[10px] font-semibold text-white">{item.count.toLocaleString('nl-NL')}</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {items.map((item, i) => {
          const pct = ((item.count / total) * 100).toFixed(1);
          const color = FACET_COLORS[i % FACET_COLORS.length];
          return (
            <div key={item.value} className="flex items-center gap-1.5 text-xs">
              <span className={`h-2 w-2 shrink-0 rounded-full ${color.dot}`} />
              <span className="text-slate-600">{item.label}</span>
              <span className="font-semibold tabular-nums text-slate-900">{item.count.toLocaleString('nl-NL')}</span>
              <span className="tabular-nums text-slate-400">({pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface Customer { id: string; name: string; }
interface BranchField { id: string; key: string; label: string; field_type: string; options: string[]; is_required: boolean; sort_order: number; }
interface BranchConfig { id: string; slug: string; name: string; color: string; is_active: boolean; branch_fields: BranchField[]; }
interface Lead {
  id: string; branch: string; customer_id: string | null; customers?: { id: string; name: string } | null;
  naam_klant: string; email: string; telefoonnummer: string; postcode: string; huisnummer: string;
  plaatsnaam: string; provincie: string; wervingsdatum: string | null; wervingsdatum_unknown?: boolean; status: string; notities: string; bron: string;
  phone_valid?: boolean;
  lead_cost?: number | string | null;
  bulk_export_count?: number;
  meta_campaign_id?: string | null;
  meta_adset_id?: string | null;
  meta_ad_id?: string | null;
  custom_fields?: Record<string, string>;
  [key: string]: unknown;
  created_at: string; updated_at: string;
}

interface LeadExport {
  id: string;
  admin_name: string;
  customer_name: string | null;
  lead_count: number;
  added_to_portal: boolean;
  format: string;
  created_at: string;
  lead_ids?: string[];
}

const STATUSES = ['nieuw', 'gecontacteerd', 'geen_gehoor', 'offerte', 'afspraak', 'verkocht', 'afgewezen'] as const;
const STATUS_LABELS: Record<string, string> = {
  nieuw: 'Nieuw', gecontacteerd: 'Gecontacteerd', geen_gehoor: 'Geen gehoor',
  offerte: 'Offerte', afspraak: 'Afspraak', verkocht: 'Verkocht', afgewezen: 'Afgewezen',
};
const statusLabel = (s: string) => STATUS_LABELS[s] || s;
const STATUS_COLORS: Record<string, string> = {
  nieuw: 'bg-blue-100 text-blue-700',
  gecontacteerd: 'bg-amber-100 text-amber-700',
  geen_gehoor: 'bg-orange-100 text-orange-700',
  offerte: 'bg-purple-100 text-purple-700',
  afspraak: 'bg-indigo-100 text-indigo-700',
  verkocht: 'bg-emerald-100 text-emerald-700',
  afgewezen: 'bg-red-100 text-red-700',
};

const PROVINCES = PROVINCES_ALL;

const COMMON_LABELS: Record<string, string> = {
  naam_klant: 'Naam', email: 'E-mail', telefoonnummer: 'Telefoon', postcode: 'Postcode',
  huisnummer: 'Huisnr.', plaatsnaam: 'Plaats', provincie: 'Provincie', wervingsdatum: 'Datum',
  status: 'Status', notities: 'Notities', bron: 'Bron', branch: 'Branche', lead_cost: 'CPL',
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
  const searchParams = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [branches, setBranches] = useState<BranchConfig[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [validatingPhones, setValidatingPhones] = useState(false);
  const [phoneValidationResult, setPhoneValidationResult] = useState<{ validated: number; invalid: number } | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const [selBranches, setSelBranches] = useState<string[]>([]);
  const [selCustomers, setSelCustomers] = useState<string[]>([]);
  const [selStatuses, setSelStatuses] = useState<string[]>([]);
  const [selProvinces, setSelProvinces] = useState<string[]>([]);
  const [selSources, setSelSources] = useState<string[]>([]);
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [phoneFilter, setPhoneFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  // Bij datum-range filter: standaard ook leads met onbekende wervingsdatum
  // (bv. excel-import zonder datum-kolom) meenemen, anders verdwijnen ze.
  const [includeUnknownDate, setIncludeUnknownDate] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [sortBy, setSortBy] = useState('wervingsdatum');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [bulkFilter, setBulkFilter] = useState('all');
  const [postcodeRanges, setPostcodeRanges] = useState('');
  const [plaatsFilter, setPlaatsFilter] = useState('');
  /** Straal in km rondom plaatsnaam; leeg = alleen plaatsnaam-match */
  const [plaatsRadiusKm, setPlaatsRadiusKm] = useState<number | null>(null);
  const [plaatsRadiusLabel, setPlaatsRadiusLabel] = useState<string | null>(null);

  const [facets, setFacets] = useState<Record<string, Record<string, number>>>({});

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportModalKey, setExportModalKey] = useState(0);
  const [exportPresetCustomerId, setExportPresetCustomerId] = useState('');
  const [exportPresetBulkBatchId, setExportPresetBulkBatchId] = useState('');
  const [exportHistory, setExportHistory] = useState<LeadExport[]>([]);
  const [showExportHistory, setShowExportHistory] = useState(false);
  const [undoingExportId, setUndoingExportId] = useState<string | null>(null);

  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [bulkAssignModalKey, setBulkAssignModalKey] = useState(0);
  const [bulkAssignInitialScope, setBulkAssignInitialScope] = useState<'selected' | 'all_filtered'>('selected');
  const [bulkAssignFeedback, setBulkAssignFeedback] = useState<
    | { kind: 'success'; assigned: number; skipped: number; blocked: number; total: number; customerName: string }
    | { kind: 'error'; message: string }
    | null
  >(null);

  const fetchMeta = useCallback(async () => {
    const [custRes, branchRes] = await Promise.all([
      adminFetch('/api/admin/customers/options'),
      adminFetch('/api/admin/branches'),
    ]);
    if (custRes.ok) { const d = await custRes.json(); setCustomers(d.customers || []); }
    if (branchRes.ok) { const d = await branchRes.json(); setBranches(d.branches || []); }
  }, []);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (selBranches.length > 0) p.set('branch', selBranches.join(','));
    if (selCustomers.length > 0) p.set('customer_id', selCustomers.join(','));
    if (selStatuses.length > 0) p.set('status', selStatuses.join(','));
    if (selProvinces.length > 0) p.set('province', selProvinces.join(','));
    if (selSources.length > 0) p.set('source', selSources.join(','));
    if (assignmentFilter !== 'all') p.set('assignment', assignmentFilter);
    if (phoneFilter !== 'all') p.set('phone_valid', phoneFilter);
    if (bulkFilter !== 'all') p.set('bulk_status', bulkFilter);
    if (dateFrom) p.set('date_from', dateFrom);
    if (dateTo) p.set('date_to', dateTo);
    if ((dateFrom || dateTo) && !includeUnknownDate) p.set('include_unknown_date', 'false');
    if (search) p.set('search', search);
    if (plaatsFilter.trim()) p.set('plaats', plaatsFilter.trim());
    if (plaatsFilter.trim() && plaatsRadiusKm != null) p.set('plaats_radius_km', String(plaatsRadiusKm));
    if (postcodeRanges.trim()) p.set('postcode_ranges', postcodeRanges.trim());
    p.set('page', String(page));
    p.set('per_page', String(perPage));
    p.set('sort_by', sortBy);
    p.set('sort_dir', sortDir);
    try {
      const res = await adminFetch(`/api/admin/leads?${p}`);
      if (res.ok) {
        const d = await res.json();
        setLeads(d.leads || []);
        setTotal(d.total || 0);
        setPlaatsRadiusLabel(typeof d.plaats_radius_label === 'string' ? d.plaats_radius_label : null);
        setLoadError('');
      } else {
        const d = await res.json().catch(() => ({}));
        setPlaatsRadiusLabel(null);
        setLoadError(d.error || 'Leads laden mislukt. Probeer het opnieuw.');
      }
    } catch {
      setPlaatsRadiusLabel(null);
      setLoadError('Netwerkfout bij het laden van leads.');
    } finally {
      setLoading(false);
    }
  }, [selBranches, selCustomers, selStatuses, selProvinces, selSources, assignmentFilter, phoneFilter, bulkFilter, dateFrom, dateTo, includeUnknownDate, search, plaatsFilter, plaatsRadiusKm, postcodeRanges, page, perPage, sortBy, sortDir]);

  const fetchFacets = useCallback(async () => {
    const p = new URLSearchParams();
    if (selBranches.length > 0) p.set('branch', selBranches.join(','));
    if (selCustomers.length > 0) p.set('customer_id', selCustomers.join(','));
    if (selStatuses.length > 0) p.set('status', selStatuses.join(','));
    if (selProvinces.length > 0) p.set('province', selProvinces.join(','));
    if (selSources.length > 0) p.set('source', selSources.join(','));
    if (assignmentFilter !== 'all') p.set('assignment', assignmentFilter);
    if (phoneFilter !== 'all') p.set('phone_valid', phoneFilter);
    if (bulkFilter !== 'all') p.set('bulk_status', bulkFilter);
    if (dateFrom) p.set('date_from', dateFrom);
    if (dateTo) p.set('date_to', dateTo);
    if ((dateFrom || dateTo) && !includeUnknownDate) p.set('include_unknown_date', 'false');
    if (search) p.set('search', search);
    // Facets RPC heeft geen straal-geo; bij straal alleen plaatsnaam weglaten
    // zodat facet-counts niet vals beperkt worden tot exacte plaatsnaam.
    if (plaatsFilter.trim() && plaatsRadiusKm == null) p.set('plaats', plaatsFilter.trim());
    if (postcodeRanges.trim()) p.set('postcode_ranges', postcodeRanges.trim());
    const res = await adminFetch(`/api/admin/leads/facets?${p}`);
    if (res.ok) { const d = await res.json(); setFacets(d.facets || {}); }
  }, [selBranches, selCustomers, selStatuses, selProvinces, selSources, assignmentFilter, phoneFilter, bulkFilter, dateFrom, dateTo, includeUnknownDate, search, plaatsFilter, plaatsRadiusKm, postcodeRanges]);

  const fetchExportHistory = useCallback(async () => {
    const res = await adminFetch('/api/admin/leads/export');
    if (res.ok) { const d = await res.json(); setExportHistory(d.exports || []); }
  }, []);

  const handleUndoExport = useCallback(async (exportId: string) => {
    if (!confirm('Weet je zeker dat je deze export ongedaan wilt maken? Bulk-aantallen worden teruggedraaid en portaal-koppelingen verwijderd.')) return;
    setUndoingExportId(exportId);
    try {
      const res = await adminFetch(`/api/admin/leads/export?id=${exportId}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || 'Ongedaan maken mislukt');
        return;
      }
      fetchExportHistory();
      fetchLeads();
    } finally {
      setUndoingExportId(null);
    }
  }, [fetchExportHistory, fetchLeads]);

  useEffect(() => { fetchMeta(); fetchExportHistory(); }, [fetchMeta, fetchExportHistory]);
  useEffect(() => { fetchLeads(); }, [fetchLeads]);
  useEffect(() => { fetchFacets(); }, [fetchFacets]);
  useEffect(() => { setPage(1); }, [selBranches, selCustomers, selStatuses, selProvinces, selSources, assignmentFilter, phoneFilter, bulkFilter, dateFrom, dateTo, includeUnknownDate, search, plaatsFilter, plaatsRadiusKm, postcodeRanges, perPage]);

  useEffect(() => {
    const c = searchParams.get('customer');
    if (!c) return;
    setExportPresetCustomerId(c);
    setExportPresetBulkBatchId(searchParams.get('bulk_batch') || '');
    setExportModalKey(k => k + 1);
    setShowExportModal(true);
  }, [searchParams]);

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
    if (selBranches.length !== 1) return [];
    return branchMap[selBranches[0]]?.branch_fields || [];
  }, [selBranches, branchMap]);

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
    const ids = Array.from(selected);
    const results = await Promise.all(
      ids.map(id =>
        adminFetch('/api/admin/leads', { method: 'PUT', body: JSON.stringify({ id, status: bulkStatus }) })
          .then(r => r.ok)
          .catch(() => false),
      ),
    );
    const failed = results.filter(ok => !ok).length;
    setSelected(new Set()); setBulkStatus(''); fetchLeads();
    if (failed > 0) showToast(`${failed} van ${ids.length} lead(s) niet bijgewerkt`, 'error');
    else showToast(`${ids.length} lead(s) bijgewerkt`);
  };
  const handleBulkDelete = async () => {
    if (selected.size === 0 || !confirm(`${selected.size} lead(s) verwijderen?`)) return;
    const count = selected.size;
    try {
      const res = await adminFetch('/api/admin/leads', { method: 'DELETE', body: JSON.stringify({ ids: Array.from(selected) }) });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        showToast(d.error || 'Verwijderen mislukt', 'error');
        return;
      }
      setSelected(new Set()); fetchLeads();
      showToast(`${count} lead(s) verwijderd`);
    } catch {
      showToast('Netwerkfout bij verwijderen', 'error');
    }
  };

  const handleValidatePhones = async () => {
    setValidatingPhones(true);
    setPhoneValidationResult(null);
    try {
      const res = await adminFetch('/api/admin/leads/validate-phones', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setPhoneValidationResult({ validated: data.validated, invalid: data.invalid });
        fetchLeads();
        setTimeout(() => setPhoneValidationResult(null), 5000);
      }
    } catch { /* ignore */ }
    setValidatingPhones(false);
  };

  const currentFilterParams = useMemo(() => {
    const p: Record<string, string> = {};
    if (selBranches.length > 0) p.branch = selBranches.join(',');
    if (selCustomers.length > 0) p.customer_id = selCustomers.join(',');
    if (selStatuses.length > 0) p.status = selStatuses.join(',');
    if (selProvinces.length > 0) p.province = selProvinces.join(',');
    if (selSources.length > 0) p.source = selSources.join(',');
    if (assignmentFilter !== 'all') p.assignment = assignmentFilter;
    if (phoneFilter !== 'all') p.phone_valid = phoneFilter;
    if (bulkFilter !== 'all') p.bulk_status = bulkFilter;
    if (dateFrom) p.date_from = dateFrom;
    if (dateTo) p.date_to = dateTo;
    if ((dateFrom || dateTo) && !includeUnknownDate) p.include_unknown_date = 'false';
    if (search) p.search = search;
    if (plaatsFilter.trim()) p.plaats = plaatsFilter.trim();
    if (plaatsFilter.trim() && plaatsRadiusKm != null) p.plaats_radius_km = String(plaatsRadiusKm);
    if (postcodeRanges.trim()) p.postcode_ranges = postcodeRanges.trim();
    return p;
  }, [selBranches, selCustomers, selStatuses, selProvinces, selSources, assignmentFilter, phoneFilter, bulkFilter, dateFrom, dateTo, includeUnknownDate, search, plaatsFilter, plaatsRadiusKm, postcodeRanges]);

  const handleQuickStatus = async (id: string, newStatus: string) => {
    const prevStatus = leads.find(l => l.id === id)?.status;
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l));
    try {
      const res = await adminFetch('/api/admin/leads', { method: 'PUT', body: JSON.stringify({ id, status: newStatus }) });
      if (!res.ok) {
        setLeads(prev => prev.map(l => l.id === id ? { ...l, status: prevStatus ?? l.status } : l));
        const d = await res.json().catch(() => ({}));
        showToast(d.error || 'Status bijwerken mislukt', 'error');
      }
    } catch {
      setLeads(prev => prev.map(l => l.id === id ? { ...l, status: prevStatus ?? l.status } : l));
      showToast('Netwerkfout bij bijwerken status', 'error');
    }
  };
  const handleDeleteSingle = async (id: string, name: string) => {
    if (!confirm(`Lead "${name}" verwijderen?`)) return;
    try {
      const res = await adminFetch('/api/admin/leads', { method: 'DELETE', body: JSON.stringify({ ids: [id] }) });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        showToast(d.error || 'Verwijderen mislukt', 'error');
        return;
      }
      fetchLeads();
      showToast('Lead verwijderd');
    } catch {
      showToast('Netwerkfout bij verwijderen', 'error');
    }
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
      {toast && (
        <div className="fixed right-4 top-4 z-[100] max-w-sm">
          <div className={`rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
            {toast.msg}
          </div>
        </div>
      )}
      {loadError && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="min-w-0 flex-1 text-sm text-red-700">{loadError}</p>
          <button onClick={() => fetchLeads()} className="shrink-0 rounded-md border border-red-300 bg-white px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50">
            Opnieuw
          </button>
        </div>
      )}
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
          <button
            onClick={() => {
              setBulkAssignInitialScope('all_filtered');
              setBulkAssignModalKey(k => k + 1);
              setShowBulkAssignModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <UserPlusIcon className="h-4 w-4" /> Bulk toewijzen
          </button>
          <button
            onClick={() => {
              setExportPresetCustomerId('');
              setExportPresetBulkBatchId('');
              setExportModalKey(k => k + 1);
              setShowExportModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <ArrowDownTrayIcon className="h-4 w-4" /> Bulk export
          </button>
          <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-button-gradient px-3.5 py-2 text-sm font-bold text-white shadow-sm">
            <PlusIcon className="h-4 w-4" /> Nieuwe lead
          </button>
        </div>
      </div>

      <AnimatePresence>
        {enrichResult && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="min-w-0 flex-1 text-sm text-emerald-700">
                {enrichResult.enriched > 0 ? (
                  <><strong>{enrichResult.enriched}</strong> van {enrichResult.total} leads verrijkt met plaatsnaam/provincie</>
                ) : enrichResult.total === 0 ? (
                  <>Alle leads hebben al een plaatsnaam en provincie</>
                ) : (
                  <>Geen adressen gevonden voor {enrichResult.total} leads (onbekende postcodes?)</>
                )}
              </p>
              <button onClick={() => setEnrichResult(null)} className="ml-3 shrink-0 text-emerald-400 hover:text-emerald-600"><XMarkIcon className="h-4 w-4" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {bulkAssignFeedback && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            {bulkAssignFeedback.kind === 'success' ? (
              <div className={`mb-4 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 ${bulkAssignFeedback.assigned > 0 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                <p className={`min-w-0 flex-1 break-words text-sm ${bulkAssignFeedback.assigned > 0 ? 'text-emerald-700' : 'text-amber-800'}`}>
                  <strong>{bulkAssignFeedback.assigned.toLocaleString('nl-NL')}</strong> lead{bulkAssignFeedback.assigned === 1 ? '' : 's'} toegewezen aan <strong>{bulkAssignFeedback.customerName}</strong>
                  {bulkAssignFeedback.skipped > 0 && (
                    <> · <span className="opacity-80">{bulkAssignFeedback.skipped.toLocaleString('nl-NL')} overgeslagen (binnen 30 dagen al toegewezen)</span></>
                  )}
                  {bulkAssignFeedback.blocked > 0 && (
                    <> · <span className="opacity-80">{bulkAssignFeedback.blocked.toLocaleString('nl-NL')} geblokkeerd door guardrails</span></>
                  )}
                </p>
                <button onClick={() => setBulkAssignFeedback(null)} className={`ml-3 shrink-0 ${bulkAssignFeedback.assigned > 0 ? 'text-emerald-400 hover:text-emerald-600' : 'text-amber-400 hover:text-amber-600'}`}><XMarkIcon className="h-4 w-4" /></button>
              </div>
            ) : (
              <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <p className="min-w-0 flex-1 break-words text-sm text-red-700">{bulkAssignFeedback.message}</p>
                <button onClick={() => setBulkAssignFeedback(null)} className="ml-3 shrink-0 text-red-400 hover:text-red-600"><XMarkIcon className="h-4 w-4" /></button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative mb-3">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Zoek op naam, email, telefoon, postcode of plaats..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2.5 pl-9 pr-4 text-sm text-slate-700 outline-none focus:border-brand-purple/50 focus:bg-white focus:ring-1 focus:ring-brand-purple/30" />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8">
          <MultiSelect
            label="branches"
            allLabel="Alle branches"
            options={branches.filter(b => b.is_active).map(b => ({ value: b.slug, label: b.name }))}
            selected={selBranches}
            onChange={setSelBranches}
            counts={facets.branch}
          />
          <MultiSelect
            label="uitgedeeld aan"
            allLabel="Alle klanten"
            options={customers.map(c => ({ value: c.id, label: c.name }))}
            selected={selCustomers}
            onChange={setSelCustomers}
            searchable
            counts={facets.customer_id}
          />
          <MultiSelect
            label="statussen"
            allLabel="Alle statussen"
            options={STATUSES.map(s => ({ value: s, label: statusLabel(s) }))}
            selected={selStatuses}
            onChange={setSelStatuses}
            counts={facets.status}
          />
          <MultiSelect
            label="provincies"
            allLabel="Alle provincies"
            groups={[
              { label: 'Nederland', options: LEAD_PROVINCE_OPTIONS_NL },
              { label: 'België', options: LEAD_PROVINCE_OPTIONS_BE },
            ]}
            selected={selProvinces}
            onChange={setSelProvinces}
            searchable
            counts={facets.province}
          />
          <MultiSelect
            label="bronnen"
            allLabel="Alle bronnen"
            options={[
              { value: 'handmatig', label: 'Handmatig' },
              { value: 'excel_import', label: 'Excel import' },
              { value: 'zapier', label: 'Zapier' },
            ]}
            selected={selSources}
            onChange={setSelSources}
            counts={facets.source}
          />
          <select value={assignmentFilter} onChange={e => setAssignmentFilter(e.target.value as 'all' | 'assigned' | 'unassigned')} className={`rounded-lg border px-3 py-2 text-sm ${assignmentFilter !== 'all' ? 'border-purple-300 bg-purple-50 text-purple-700' : 'border-slate-200 bg-white text-slate-700'}`} title="Toon enkel leads die wel of niet aan een klant zijn uitgedeeld">
            <option value="all">Alle toewijzingen</option>
            <option value="assigned">Wel uitgedeeld</option>
            <option value="unassigned">Niet uitgedeeld</option>
          </select>
          <select value={phoneFilter} onChange={e => setPhoneFilter(e.target.value)} className={`rounded-lg border px-3 py-2 text-sm ${phoneFilter === 'false' ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-700'}`}>
            <option value="all">Alle nummers</option>
            <option value="false">Verdacht nummer</option>
            <option value="true">Geldig nummer</option>
          </select>
          <select value={bulkFilter} onChange={e => setBulkFilter(e.target.value)} className={`rounded-lg border px-3 py-2 text-sm ${bulkFilter !== 'all' ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-700'}`}>
            <option value="all">Alle bulk status</option>
            <option value="never">Nog niet verkocht</option>
            <option value="once">1x verkocht</option>
            <option value="multiple">2x+ verkocht</option>
          </select>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full max-w-[9.5rem] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 sm:w-auto" />
            <span className="text-xs text-slate-400">t/m</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full max-w-[9.5rem] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 sm:w-auto" />
          </div>
          <input
            type="text"
            value={plaatsFilter}
            onChange={e => setPlaatsFilter(e.target.value)}
            placeholder="Plaatsnaam (NL/BE)"
            title={plaatsRadiusKm != null
              ? 'Middelpunt voor straalfilter (geocode NL/BE), bijv. Amsterdam of Antwerpen'
              : 'Filter op plaatsnaam, bijv. Amsterdam of Antwerpen'}
            className={`min-w-[12rem] flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/30 sm:max-w-[14rem] ${plaatsFilter.trim() ? 'border-sky-300 bg-sky-50 text-sky-900' : 'border-slate-200 bg-white text-slate-700'}`}
          />
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={500}
              step={1}
              list="admin-leads-radius-presets"
              value={plaatsRadiusKm == null ? '' : String(plaatsRadiusKm)}
              onChange={e => {
                const raw = e.target.value.trim();
                if (!raw) {
                  setPlaatsRadiusKm(null);
                  return;
                }
                const n = Number(raw);
                if (!Number.isFinite(n) || n <= 0) {
                  setPlaatsRadiusKm(null);
                  return;
                }
                setPlaatsRadiusKm(Math.min(Math.round(n), 500));
              }}
              placeholder="Straal"
              title="Straal in km rondom de plaatsnaam (1–500). Leeg = alleen plaatsnaam-match. Kies een preset of typ zelf."
              className={`w-[5.5rem] rounded-lg border px-2.5 py-2 text-sm tabular-nums outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/30 ${plaatsRadiusKm != null ? 'border-sky-300 bg-sky-50 text-sky-900' : 'border-slate-200 bg-white text-slate-700'}`}
            />
            <datalist id="admin-leads-radius-presets">
              {DISTANCE_PRESETS_KM.map((km) => (
                <option key={km} value={km} />
              ))}
            </datalist>
            <span className="text-xs text-slate-400">km</span>
          </div>
          {plaatsRadiusKm != null && plaatsFilter.trim() && plaatsRadiusLabel && (
            <span className="text-xs text-sky-700" title="Geocodeerd middelpunt">
              ≤{plaatsRadiusKm} km van {plaatsRadiusLabel}
            </span>
          )}
          <input
            type="text"
            value={postcodeRanges}
            onChange={e => setPostcodeRanges(e.target.value)}
            placeholder="Postcodegebied (bijv. 7500-7599, 2000, 7511AB)"
            title="Filter op PC4-gebieden: 7500-7599, 75, 7511AB of meerdere ranges gescheiden door komma"
            className={`min-w-[14rem] flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/30 sm:max-w-xs ${parsePostcodeRanges(postcodeRanges).length > 0 ? 'border-sky-300 bg-sky-50 text-sky-900' : 'border-slate-200 bg-white text-slate-700'}`}
          />
          {(dateFrom || dateTo) && (
            <label className="flex cursor-pointer select-none items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={includeUnknownDate}
                onChange={e => setIncludeUnknownDate(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-brand-purple focus:ring-brand-purple"
              />
              <span>Ook leads zonder bekende datum</span>
            </label>
          )}
          <button
            onClick={handleValidatePhones}
            disabled={validatingPhones}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
          >
            <ExclamationTriangleIcon className={`h-3.5 w-3.5 ${validatingPhones ? 'animate-pulse' : ''}`} />
            {validatingPhones ? 'Controleren...' : 'Nummers controleren'}
          </button>
          {phoneValidationResult && (
            <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
              {phoneValidationResult.validated} gecontroleerd, {phoneValidationResult.invalid} verdacht
            </span>
          )}
        </div>
      </div>

      {/* Facet breakdown bars */}
      {Object.keys(facets).length > 0 && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FacetBreakdown
            title="Verdeling per branche"
            counts={facets.branch || {}}
            options={branches.filter(b => b.is_active).map(b => ({ value: b.slug, label: b.name }))}
            selected={selBranches}
          />
          <FacetBreakdown
            title="Verdeling per provincie"
            counts={facets.province || {}}
            options={[...LEAD_PROVINCE_OPTIONS_NL, ...LEAD_PROVINCE_OPTIONS_BE]}
            selected={selProvinces}
          />
          <FacetBreakdown
            title="Verdeling per status"
            counts={facets.status || {}}
            options={STATUSES.map(s => ({ value: s, label: statusLabel(s) }))}
            selected={selStatuses}
          />
          <FacetBreakdown
            title="Verdeling per klant"
            counts={facets.customer_id || {}}
            options={customers.map(c => ({ value: c.id, label: c.name }))}
            selected={selCustomers}
          />
          <FacetBreakdown
            title="Verdeling per bron"
            counts={facets.source || {}}
            options={[
              { value: 'handmatig', label: 'Handmatig' },
              { value: 'excel_import', label: 'Excel import' },
              { value: 'zapier', label: 'Zapier' },
            ]}
            selected={selSources}
          />
        </div>
      )}

      {/* Export History */}
      {exportHistory.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowExportHistory(h => !h)}
            className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            Recente exports ({exportHistory.length})
            <ChevronDownIcon className={`h-3.5 w-3.5 transition ${showExportHistory ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
            {showExportHistory && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/80">
                        <th className="px-3 py-2.5 text-xs font-semibold text-slate-500">Datum</th>
                        <th className="px-3 py-2.5 text-xs font-semibold text-slate-500">Admin</th>
                        <th className="px-3 py-2.5 text-xs font-semibold text-slate-500">Klant</th>
                        <th className="px-3 py-2.5 text-xs font-semibold text-slate-500">Leads</th>
                        <th className="px-3 py-2.5 text-xs font-semibold text-slate-500">Formaat</th>
                        <th className="px-3 py-2.5 text-xs font-semibold text-slate-500">Portaal</th>
                        <th className="px-3 py-2.5 text-xs font-semibold text-slate-500">Actie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exportHistory.map(ex => (
                        <tr key={ex.id} className="border-b border-slate-50">
                          <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600">{new Date(ex.created_at).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="px-3 py-2 text-xs text-slate-600">{ex.admin_name}</td>
                          <td className="px-3 py-2 text-xs text-slate-600">{ex.customer_name || '-'}</td>
                          <td className="px-3 py-2 text-xs font-medium tabular-nums text-slate-700">{ex.lead_count.toLocaleString('nl-NL')}</td>
                          <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${ex.format === 'xlsx' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{ex.format}</span></td>
                          <td className="px-3 py-2">{ex.added_to_portal ? <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">Ja</span> : <span className="text-xs text-slate-400">Nee</span>}</td>
                          <td className="px-3 py-2">
                            <button
                              onClick={() => handleUndoExport(ex.id)}
                              disabled={undoingExportId === ex.id}
                              className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-[11px] font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                            >
                              {undoingExportId === ex.id ? (
                                <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
                              ) : (
                                <ArrowUturnLeftIcon className="h-3 w-3" />
                              )}
                              {undoingExportId === ex.id ? 'Bezig...' : 'Ongedaan'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-brand-purple/20 bg-brand-purple/5 px-4 py-3">
              <span className="text-sm font-medium text-brand-purple">{selected.size} geselecteerd</span>
              <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm">
                <option value="">Status wijzigen...</option>
                {STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
              </select>
              {bulkStatus && <button onClick={handleBulkStatus} className="rounded-lg bg-brand-purple px-3 py-1.5 text-sm font-medium text-white">Toepassen</button>}
              <button
                onClick={() => {
                  setBulkAssignInitialScope('selected');
                  setBulkAssignModalKey(k => k + 1);
                  setShowBulkAssignModal(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
              >
                <UserPlusIcon className="h-3.5 w-3.5" /> Toewijzen aan klant
              </button>
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
                {selBranches.length !== 1 && (
                  <th className="cursor-pointer px-3 py-3 text-xs font-semibold text-slate-500 hover:text-slate-700" onClick={() => toggleSort('branch')}>
                    <span className="inline-flex items-center gap-1">Branche <ChevronUpDownIcon className="h-3 w-3" /></span>
                  </th>
                )}
                <th className="px-3 py-3 text-xs font-semibold text-slate-500">Klant</th>
                <th className="cursor-pointer whitespace-nowrap px-3 py-3 text-xs font-semibold text-slate-500 hover:text-slate-700" onClick={() => toggleSort('bulk_export_count')}>
                  <span className="inline-flex items-center gap-1">
                    Bulk
                    {sortBy === 'bulk_export_count' && <span className="text-brand-purple">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                  </span>
                </th>
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
                  <tr key={lead.id} onClick={() => setEditLead(lead)} className="cursor-pointer border-b border-slate-50 transition hover:bg-slate-50/50">
                    <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}><input type="checkbox" checked={selected.has(lead.id)} onChange={() => toggleSelect(lead.id)} className="h-4 w-4 rounded border-slate-300" /></td>
                    {selBranches.length !== 1 && (
                      <td className="px-3 py-2.5">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.light} ${badge.text}`}>{badge.name}</span>
                      </td>
                    )}
                    <td className="px-3 py-2.5 text-xs text-slate-500">
                      <div>{lead.customers?.name || '-'}</div>
                      {(lead as any).assignment_count > 0 && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-600" title={(lead as any).assigned_customers?.join(', ')}>
                          {(lead as any).assignment_count}x toegewezen
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {(() => {
                        const cnt = lead.bulk_export_count ?? 0;
                        const color = cnt === 0 ? 'bg-emerald-100 text-emerald-700' : cnt === 1 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
                        return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ${color}`}>{cnt}x</span>;
                      })()}
                    </td>
                    {visibleCols.map(col => (
                      <td key={col} className="whitespace-nowrap px-3 py-2.5 text-sm text-slate-700" onClick={col === 'status' ? e => e.stopPropagation() : undefined}>
                        {col === 'status' ? (
                          <select value={lead.status} onChange={e => handleQuickStatus(lead.id, e.target.value)}
                            className={`rounded-full border-0 px-2.5 py-0.5 text-[11px] font-medium ${STATUS_COLORS[lead.status] || 'bg-slate-100 text-slate-600'}`}>
                            {STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
                          </select>
                        ) : col === 'telefoonnummer' ? (
                          <span className="flex items-center gap-1">
                            <span className="block max-w-[140px] truncate">{lead.telefoonnummer || '-'}</span>
                            {lead.phone_valid === false && (
                              <span title="Mogelijk nep telefoonnummer" className="shrink-0">
                                <ExclamationTriangleIcon className="h-3.5 w-3.5 text-amber-500" />
                              </span>
                            )}
                          </span>
                        ) : col === 'lead_cost' ? (
                          <span className={`text-xs font-medium ${lead.lead_cost ? 'text-slate-700' : 'text-slate-300'}`}>
                            {lead.lead_cost ? `€${Number(lead.lead_cost).toFixed(2)}` : '-'}
                          </span>
                        ) : col === 'plaatsnaam' && typeof lead.distance_km === 'number' ? (
                          <span className="block max-w-[180px] truncate" title={`${lead.plaatsnaam || '-'} · ${lead.distance_km} km`}>
                            {lead.plaatsnaam || '-'}
                            <span className="ml-1 text-[11px] text-sky-600">{lead.distance_km} km</span>
                          </span>
                        ) : (
                          <span className="block max-w-[160px] truncate">{getLeadFieldValue(lead, col) || '-'}</span>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                      <button onClick={() => handleDeleteSingle(lead.id, lead.naam_klant)} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"><TrashIcon className="h-4 w-4" /></button>
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
            <div key={lead.id} onClick={() => setEditLead(lead)} className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition active:bg-slate-50">
              <div className="mb-2 flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{lead.naam_klant || '-'}</p>
                  <p className="text-xs text-slate-500">
                    {lead.customers?.name || '-'}
                    {(lead as any).assignment_count > 0 && (
                      <span className="ml-1 text-[10px] text-purple-500">({(lead as any).assignment_count}x)</span>
                    )}
                  </p>
                </div>
                <div onClick={e => e.stopPropagation()}>
                  <select value={lead.status} onChange={e => handleQuickStatus(lead.id, e.target.value)}
                    className={`ml-2 min-h-10 shrink-0 rounded-full border-0 px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[lead.status] || 'bg-slate-100 text-slate-600'}`}>
                    {STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.light} ${badge.text}`}>{badge.name}</span>
                {(() => {
                  const cnt = lead.bulk_export_count ?? 0;
                  const color = cnt === 0 ? 'bg-emerald-100 text-emerald-700' : cnt === 1 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
                  return <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${color}`}>{cnt}x bulk</span>;
                })()}
                {lead.plaatsnaam && (
                  <span>
                    {lead.plaatsnaam}
                    {typeof lead.distance_km === 'number' && (
                      <span className="ml-1 text-sky-600">{lead.distance_km} km</span>
                    )}
                  </span>
                )}
                {lead.telefoonnummer && (
                  <span className="flex min-w-0 items-center gap-0.5">
                    <span className="truncate break-all">{lead.telefoonnummer}</span>
                    {lead.phone_valid === false && <ExclamationTriangleIcon className="h-3 w-3 shrink-0 text-amber-500" />}
                  </span>
                )}
                {lead.wervingsdatum ? (
                  <span>{lead.wervingsdatum}</span>
                ) : lead.wervingsdatum_unknown ? (
                  <span className="italic text-slate-400" title="Wervingsdatum onbekend (was leeg/onleesbaar bij import)">Datum onbekend</span>
                ) : null}
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
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-30"><ChevronLeftIcon className="h-4 w-4" /></button>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-30"><ChevronRightIcon className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {(editLead || showNew) && (
          <LeadFormPanel
            lead={editLead}
            customers={customers}
            branches={branches}
            defaultBranch={selBranches.length === 1 ? selBranches[0] : branches[0]?.slug || 'thuisbatterij'}
            onClose={() => { setEditLead(null); setShowNew(false); }}
            onSaved={() => { setEditLead(null); setShowNew(false); fetchLeads(); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showExportModal && (
          <ExportModal
            key={exportModalKey}
            total={total}
            customers={customers}
            branches={branches}
            filterParams={currentFilterParams}
            presetCustomerId={exportPresetCustomerId}
            presetBulkBatchId={exportPresetBulkBatchId}
            onClose={() => setShowExportModal(false)}
            onExported={() => { fetchLeads(); fetchExportHistory(); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBulkAssignModal && (
          <BulkAssignModal
            key={bulkAssignModalKey}
            customers={customers}
            selectedLeadIds={Array.from(selected)}
            filterParams={currentFilterParams}
            totalInFilter={total}
            initialScope={bulkAssignInitialScope}
            onClose={() => setShowBulkAssignModal(false)}
            onAssigned={(result) => {
              setBulkAssignFeedback({
                kind: 'success',
                assigned: result.assigned,
                skipped: result.skipped_already,
                blocked: result.blocked_guardrails ?? 0,
                total: result.total,
                customerName: result.customer_name,
              });
              setSelected(new Set());
              fetchLeads();
              setTimeout(() => setBulkAssignFeedback(null), 9000);
            }}
            onError={(message) => {
              setBulkAssignFeedback({ kind: 'error', message });
              setTimeout(() => setBulkAssignFeedback(null), 9000);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

type ExportBatchInfo = {
  customer_id: string | null;
  customer_name: string | null;
  branch: string | null;
  batch_size: number;
  leads_delivered: number;
  remaining: number;
};

function ExportModal({
  total: initialTotal, customers, branches, filterParams, presetCustomerId, presetBulkBatchId, onClose, onExported,
}: {
  total: number;
  customers: Customer[];
  branches: BranchConfig[];
  filterParams: Record<string, string>;
  presetCustomerId?: string;
  presetBulkBatchId?: string;
  onClose: () => void;
  onExported: () => void;
}) {
  const isBulkBatchFlow = !!presetBulkBatchId;

  const [targetCustomerId, setTargetCustomerId] = useState(presetCustomerId || '');
  const [bulkBatchId, setBulkBatchId] = useState(presetBulkBatchId || '');
  const [addToPortal, setAddToPortal] = useState(!!(presetCustomerId && presetBulkBatchId));
  const [format, setFormat] = useState<'csv' | 'xlsx'>('xlsx');
  const [prioritize, setPrioritize] = useState(true);
  const [maxLeads, setMaxLeads] = useState('');
  const [excludeCustomers, setExcludeCustomers] = useState<string[]>([]);
  const [excludeAlreadyAssigned, setExcludeAlreadyAssigned] = useState(false);
  const [showExcludePicker, setShowExcludePicker] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  // Filter-state binnen de modal — geïnitialiseerd vanuit `filterParams` zodat
  // de admin verder kan met wat al actief was op de leads-pagina, en daarna
  // vrij kan tweaken zonder de buiten-state te wijzigen.
  const [selFilterBranches, setSelFilterBranches] = useState<string[]>(() =>
    filterParams.branch ? filterParams.branch.split(',').filter(Boolean) : []);
  const [selFilterStatuses, setSelFilterStatuses] = useState<string[]>(() =>
    filterParams.status ? filterParams.status.split(',').filter(Boolean) : []);
  const [selFilterProvinces, setSelFilterProvinces] = useState<string[]>(() =>
    filterParams.province ? filterParams.province.split(',').filter(Boolean) : []);
  const [selFilterSources, setSelFilterSources] = useState<string[]>(() =>
    filterParams.source ? filterParams.source.split(',').filter(Boolean) : []);
  const [filterPhone, setFilterPhone] = useState<string>(filterParams.phone_valid || 'all');
  const [filterBulkStatus, setFilterBulkStatus] = useState<string>(filterParams.bulk_status || 'all');
  const [filterDateFrom, setFilterDateFrom] = useState<string>(filterParams.date_from || '');
  const [filterDateTo, setFilterDateTo] = useState<string>(filterParams.date_to || '');
  const [filterIncludeUnknownDate, setFilterIncludeUnknownDate] = useState<boolean>(
    filterParams.include_unknown_date !== 'false');
  const filterPostcodeRanges = filterParams.postcode_ranges || '';
  const filterPlaats = filterParams.plaats || '';
  const filterPlaatsRadiusKm = filterParams.plaats_radius_km || '';
  const filterSearch = filterParams.search || '';
  const [filtersExpanded, setFiltersExpanded] = useState<boolean>(
    isBulkBatchFlow || !(filterParams.branch?.split(',').filter(Boolean).length),
  );

  // Bulk-batch context: opgehaald via /api/admin/batches/[id] zodat we
  // klantnaam, branche en remaining-count weten voor de info-banner en
  // smart-defaults.
  const [batchInfo, setBatchInfo] = useState<ExportBatchInfo | null>(null);
  const smartDefaultsAppliedRef = useRef(false);

  useEffect(() => {
    if (!presetBulkBatchId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await adminFetch(`/api/admin/batches/${presetBulkBatchId}`);
        if (!res.ok) return;
        const d = await res.json();
        if (cancelled) return;
        const b = d.batch;
        if (!b) return;
        const batchSize = Number(b.batch_size || 0);
        const delivered = Number(b.leads_delivered || 0);
        const remaining = Math.max(0, batchSize - delivered);
        const branch = (typeof b.branch === 'string' && b.branch) ? b.branch : null;
        const customerId = (typeof b.customer_id === 'string' && b.customer_id) ? b.customer_id : null;
        setBatchInfo({
          customer_id: customerId,
          customer_name: b.customers?.name || null,
          branch,
          batch_size: batchSize,
          leads_delivered: delivered,
          remaining,
        });
        if (!smartDefaultsAppliedRef.current) {
          smartDefaultsAppliedRef.current = true;
          if (branch) {
            setSelFilterBranches(prev => prev.length === 0 ? [branch] : prev);
          }
          if (remaining > 0) {
            setMaxLeads(prev => prev ? prev : String(remaining));
          }
          if (customerId) {
            setExcludeCustomers(prev => prev.includes(customerId) ? prev : [...prev, customerId]);
          }
        }
      } catch { /* non-blocking */ }
    })();
    return () => { cancelled = true; };
  }, [presetBulkBatchId]);

  // Body voor zowel /api/admin/leads/count als /api/admin/leads/export.
  // Bevat ALLE filters die de export-route ook respecteert, behalve format
  // en target_customer_id.
  const buildFilterBody = useCallback((): Record<string, string> => {
    const body: Record<string, string> = {};
    if (selFilterBranches.length > 0) body.branch = selFilterBranches.join(',');
    if (selFilterStatuses.length > 0) body.status = selFilterStatuses.join(',');
    if (selFilterProvinces.length > 0) body.province = selFilterProvinces.join(',');
    if (selFilterSources.length > 0) body.source = selFilterSources.join(',');
    if (filterPhone !== 'all') body.phone_valid = filterPhone;
    if (filterBulkStatus !== 'all') body.bulk_status = filterBulkStatus;
    if (filterDateFrom) body.date_from = filterDateFrom;
    if (filterDateTo) body.date_to = filterDateTo;
    if ((filterDateFrom || filterDateTo) && !filterIncludeUnknownDate) body.include_unknown_date = 'false';
    if (filterSearch.trim()) body.search = filterSearch.trim();
    if (filterPlaats.trim()) body.plaats = filterPlaats.trim();
    if (filterPlaats.trim() && filterPlaatsRadiusKm.trim()) {
      body.plaats_radius_km = filterPlaatsRadiusKm.trim();
    }
    if (filterPostcodeRanges.trim()) body.postcode_ranges = filterPostcodeRanges.trim();
    if (excludeCustomers.length > 0) body.exclude_customer_id = excludeCustomers.join(',');
    // De "Sluit reeds uitgedeelde leads uit"-checkbox is in de bulk-batch
    // flow verborgen; daar regelt klant-exclude (`exclude_customer_id`) dat
    // op een minder strenge manier.
    if (excludeAlreadyAssigned && !isBulkBatchFlow) body.assignment = 'unassigned';
    return body;
  }, [
    selFilterBranches, selFilterStatuses, selFilterProvinces, selFilterSources,
    filterPhone, filterBulkStatus, filterDateFrom, filterDateTo, filterIncludeUnknownDate,
    filterSearch, filterPlaats, filterPlaatsRadiusKm, filterPostcodeRanges, excludeCustomers, excludeAlreadyAssigned, isBulkBatchFlow,
  ]);

  const [liveCount, setLiveCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);

  const branchRequired = selFilterBranches.length === 0;

  useEffect(() => {
    let cancelled = false;
    if (branchRequired) {
      setLiveCount(null);
      setCountLoading(false);
      return;
    }
    setCountLoading(true);
    const handle = setTimeout(async () => {
      try {
        const params = new URLSearchParams(buildFilterBody());
        const res = await adminFetch(`/api/admin/leads/count?${params}`);
        if (!cancelled && res.ok) {
          const d = await res.json();
          setLiveCount(typeof d.count === 'number' ? d.count : 0);
        }
      } finally {
        if (!cancelled) setCountLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [buildFilterBody, branchRequired]);

  const effectiveTotal = branchRequired ? 0 : (liveCount ?? initialTotal);
  const exportCount = useMemo(() => {
    const cap = maxLeads && Number(maxLeads) > 0 ? Number(maxLeads) : Number.POSITIVE_INFINITY;
    return Math.min(effectiveTotal, cap);
  }, [effectiveTotal, maxLeads]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (selFilterBranches.length > 0) n++;
    if (selFilterStatuses.length > 0) n++;
    if (selFilterProvinces.length > 0) n++;
    if (selFilterSources.length > 0) n++;
    if (filterPhone !== 'all') n++;
    if (filterBulkStatus !== 'all') n++;
    if (filterDateFrom || filterDateTo) n++;
    return n;
  }, [selFilterBranches, selFilterStatuses, selFilterProvinces, selFilterSources, filterPhone, filterBulkStatus, filterDateFrom, filterDateTo]);

  const branchOptions = useMemo(
    () => branches.filter(b => b.is_active).map(b => ({ value: b.slug, label: b.name })),
    [branches],
  );

  const handleExport = async () => {
    if (branchRequired) {
      setError('Selecteer minimaal één branche om te exporteren');
      setFiltersExpanded(true);
      return;
    }
    setExporting(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        ...buildFilterBody(),
        format,
        prioritize_least_exported: prioritize,
      };
      if (targetCustomerId) {
        body.target_customer_id = targetCustomerId;
        body.add_to_portal = addToPortal;
        if (addToPortal && bulkBatchId) {
          body.bulk_batch_id = bulkBatchId;
        }
      }
      if (maxLeads && Number(maxLeads) > 0) body.max_leads = Number(maxLeads);

      const res = await adminFetch('/api/admin/leads/export', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: 'Export mislukt' }));
        throw new Error(d.error || 'Export mislukt');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = format === 'xlsx' ? 'xlsx' : 'csv';
      a.download = `leads-bulk-export-${new Date().toISOString().split('T')[0]}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      onExported();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Er ging iets mis');
    } finally {
      setExporting(false);
    }
  };

  const branchLabel = (slug: string | null) => {
    if (!slug) return '';
    return branches.find(b => b.slug === slug)?.name || slug;
  };

  const headerCount = countLoading && liveCount === null
    ? initialTotal
    : effectiveTotal;

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4 sm:items-center">
        <div className="my-8 flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Bulk Lead Export</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {branchRequired ? (
                  <span className="text-amber-700">Selecteer minimaal één branche in de filters</span>
                ) : (
                  <span className={countLoading ? 'opacity-60' : ''}>
                    {headerCount.toLocaleString('nl-NL')} leads in huidige filters
                  </span>
                )}
                {countLoading && !branchRequired && <span className="ml-2 text-xs text-slate-400">…</span>}
              </p>
            </div>
            <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><XMarkIcon className="h-5 w-5" /></button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>}

            {isBulkBatchFlow && batchInfo && (
              <div className="rounded-lg border border-violet-200 bg-violet-50/60 px-4 py-3 text-sm text-violet-900">
                <div className="font-semibold">
                  Bulk-batch voor {batchInfo.customer_name || 'klant'}
                </div>
                <p className="mt-1 text-xs text-violet-800/90">
                  {batchInfo.batch_size.toLocaleString('nl-NL')} leads pakket
                  {batchInfo.branch ? <> op branche <strong>{branchLabel(batchInfo.branch)}</strong></> : null}
                  , <strong>{batchInfo.remaining.toLocaleString('nl-NL')}</strong> resterend
                  {batchInfo.leads_delivered > 0 ? ` (${batchInfo.leads_delivered.toLocaleString('nl-NL')} al uitgedeeld)` : ''}.
                </p>
                <p className="mt-1 text-xs text-violet-800/90">
                  Leads die al via bulk of vers aan deze klant zijn toegewezen worden automatisch overgeslagen.
                </p>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Exporteren voor klant (optioneel)</label>
              <SearchableSelect
                value={targetCustomerId}
                onChange={v => {
                  if (!v) {
                    setTargetCustomerId('');
                    setAddToPortal(false);
                    setBulkBatchId('');
                    return;
                  }
                  if (v !== targetCustomerId) setBulkBatchId('');
                  setTargetCustomerId(v);
                }}
                options={customers.map(c => ({ value: c.id, label: c.name }))}
                emptyOptionLabel="Geen specifieke klant"
                placeholder="Geen specifieke klant"
                searchPlaceholder="Zoek klant…"
                ariaLabel="Exporteren voor klant"
                className="py-2.5"
                disabled={isBulkBatchFlow}
              />
            </div>

            {bulkBatchId && targetCustomerId && (
              <div className="rounded-lg border border-violet-200 bg-violet-50/50 px-3 py-2 text-xs text-violet-900">
                <span className="font-semibold">Bulk-batch</span>
                <span className="ml-1 font-mono text-[11px] text-violet-700">{bulkBatchId.slice(0, 8)}…</span>
                <p className="mt-1 text-violet-800/90">Portaaltoewijzingen krijgen deze batch als <code className="rounded bg-white/80 px-1">batch_id</code>.</p>
              </div>
            )}

            {targetCustomerId && (
              <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-700 cursor-pointer hover:bg-slate-50">
                <input type="checkbox" checked={addToPortal} onChange={e => setAddToPortal(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-purple focus:ring-brand-purple/30" />
                <div>
                  <span className="font-medium">Toevoegen aan klantportaal</span>
                  <p className="text-xs text-slate-500">Leads worden ook als lead_assignments aan deze klant gekoppeld</p>
                </div>
              </label>
            )}

            <div className="rounded-lg border border-slate-200 bg-slate-50/30">
              <button
                type="button"
                onClick={() => setFiltersExpanded(s => !s)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-700"
              >
                <span className="inline-flex items-center gap-2">
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="rounded-full bg-brand-purple/10 px-2 py-0.5 text-[10px] font-semibold text-brand-purple">
                      {activeFilterCount} actief
                    </span>
                  )}
                </span>
                <ChevronDownIcon className={`h-4 w-4 text-slate-400 transition ${filtersExpanded ? 'rotate-180' : ''}`} />
              </button>

              {filtersExpanded && (
                <div className="space-y-3 border-t border-slate-200 px-4 py-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {branchOptions.length > 0 && (
                      <div>
                        <MultiSelect
                          label="branches (verplicht)"
                          allLabel="Geen — selecteer minimaal één"
                          options={branchOptions}
                          selected={selFilterBranches}
                          onChange={setSelFilterBranches}
                          searchable
                        />
                        {branchRequired && (
                          <p className="mt-1 text-xs text-amber-700">Bulk export zonder branche is niet toegestaan.</p>
                        )}
                      </div>
                    )}
                    <MultiSelect
                      label="provincies"
                      allLabel="Alle provincies"
                      groups={[
                        { label: 'Nederland', options: LEAD_PROVINCE_OPTIONS_NL },
                        { label: 'België', options: LEAD_PROVINCE_OPTIONS_BE },
                      ]}
                      selected={selFilterProvinces}
                      onChange={setSelFilterProvinces}
                      searchable
                    />
                    <MultiSelect
                      label="statussen"
                      allLabel="Alle statussen"
                      options={STATUSES.map(s => ({ value: s, label: statusLabel(s) }))}
                      selected={selFilterStatuses}
                      onChange={setSelFilterStatuses}
                    />
                    <MultiSelect
                      label="bronnen"
                      allLabel="Alle bronnen"
                      options={[
                        { value: 'handmatig', label: 'Handmatig' },
                        { value: 'excel_import', label: 'Excel import' },
                        { value: 'zapier', label: 'Zapier' },
                      ]}
                      selected={selFilterSources}
                      onChange={setSelFilterSources}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">Wervingsdatum</label>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="date"
                        value={filterDateFrom}
                        onChange={e => setFilterDateFrom(e.target.value)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                        aria-label="Datum vanaf"
                      />
                      <span className="text-xs text-slate-400">t/m</span>
                      <input
                        type="date"
                        value={filterDateTo}
                        onChange={e => setFilterDateTo(e.target.value)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                        aria-label="Datum tot"
                      />
                      {(filterDateFrom || filterDateTo) && (
                        <label className="flex cursor-pointer select-none items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            checked={filterIncludeUnknownDate}
                            onChange={e => setFilterIncludeUnknownDate(e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-brand-purple focus:ring-brand-purple"
                          />
                          <span>Ook leads zonder bekende datum</span>
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-500">Telefoon</label>
                      <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                        {[
                          { v: 'all', l: 'Alle' },
                          { v: 'true', l: 'Geldig' },
                          { v: 'false', l: 'Verdacht' },
                        ].map(opt => (
                          <button
                            key={opt.v}
                            type="button"
                            onClick={() => setFilterPhone(opt.v)}
                            className={`flex-1 px-2 py-1.5 text-xs font-medium transition ${filterPhone === opt.v ? 'bg-brand-purple text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                          >
                            {opt.l}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-500">Bulk-status</label>
                      <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                        {[
                          { v: 'all', l: 'Alle' },
                          { v: 'never', l: 'Nooit' },
                          { v: 'once', l: '1×' },
                          { v: 'multiple', l: '2×+' },
                        ].map(opt => (
                          <button
                            key={opt.v}
                            type="button"
                            onClick={() => setFilterBulkStatus(opt.v)}
                            className={`flex-1 px-2 py-1.5 text-xs font-medium transition ${filterBulkStatus === opt.v ? 'bg-brand-purple text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                          >
                            {opt.l}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {activeFilterCount > 0 && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setSelFilterStatuses([]);
                          setSelFilterProvinces([]);
                          setSelFilterSources([]);
                          setFilterPhone('all');
                          setFilterBulkStatus('all');
                          setFilterDateFrom('');
                          setFilterDateTo('');
                          setFilterIncludeUnknownDate(true);
                        }}
                        className="text-xs font-medium text-slate-500 hover:text-slate-700"
                      >
                        Filters wissen
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {!isBulkBatchFlow && (
              <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-700 cursor-pointer hover:bg-slate-50">
                <input type="checkbox" checked={excludeAlreadyAssigned} onChange={e => setExcludeAlreadyAssigned(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-purple focus:ring-brand-purple/30" />
                <div>
                  <span className="font-medium">Sluit reeds uitgedeelde leads uit</span>
                  <p className="text-xs text-slate-500">Alleen leads exporteren die nog niet aan een klant zijn toegewezen</p>
                </div>
              </label>
            )}

            <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3">
              <button type="button" onClick={() => setShowExcludePicker(s => !s)} className="flex w-full items-center justify-between text-left text-sm font-medium text-slate-700">
                <span>
                  Sluit specifieke klanten uit
                  {excludeCustomers.length > 0 && (
                    <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                      {excludeCustomers.length} geselecteerd
                    </span>
                  )}
                </span>
                <ChevronDownIcon className={`h-4 w-4 text-slate-400 transition ${showExcludePicker ? 'rotate-180' : ''}`} />
              </button>
              {!showExcludePicker && (
                <p className="mt-1 text-xs text-slate-500">
                  {isBulkBatchFlow && batchInfo?.customer_id
                    ? `Leads die al aan ${batchInfo.customer_name || 'deze klant'} zijn uitgedeeld worden overgeslagen.`
                    : 'Verberg leads die al aan deze klanten zijn uitgedeeld'}
                </p>
              )}
              {showExcludePicker && (
                <div className="mt-3 max-h-44 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
                  {customers.length === 0 && <p className="px-2 py-1 text-xs text-slate-400">Geen klanten</p>}
                  {customers.map(c => {
                    const checked = excludeCustomers.includes(c.id);
                    const isPresetExclude = isBulkBatchFlow && batchInfo?.customer_id === c.id;
                    return (
                      <label key={c.id} className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50 ${isPresetExclude ? 'cursor-not-allowed text-slate-500' : 'cursor-pointer text-slate-700'}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={isPresetExclude}
                          onChange={() => setExcludeCustomers(prev => checked ? prev.filter(id => id !== c.id) : [...prev, c.id])}
                          className="h-4 w-4 rounded border-slate-300 text-brand-purple focus:ring-brand-purple/30"
                        />
                        <span>
                          {c.name}
                          {isPresetExclude && <span className="ml-1 text-[10px] text-slate-400">(bulk-batch klant)</span>}
                        </span>
                      </label>
                    );
                  })}
                  {excludeCustomers.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setExcludeCustomers(prev => isBulkBatchFlow && batchInfo?.customer_id
                        ? prev.filter(id => id === batchInfo.customer_id)
                        : [])}
                      className="mt-2 text-xs font-medium text-slate-500 hover:text-slate-700"
                    >
                      Selectie wissen
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Formaat</label>
                <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                  <button onClick={() => setFormat('xlsx')} className={`flex-1 px-3 py-2 text-sm font-medium transition ${format === 'xlsx' ? 'bg-brand-purple text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                    Excel (.xlsx)
                  </button>
                  <button onClick={() => setFormat('csv')} className={`flex-1 px-3 py-2 text-sm font-medium transition ${format === 'csv' ? 'bg-brand-purple text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                    CSV
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Max. aantal leads</label>
                <input type="number" value={maxLeads} onChange={e => setMaxLeads(e.target.value)} placeholder="Alle"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" min={1} />
              </div>
            </div>

            <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-700 cursor-pointer hover:bg-slate-50">
              <input type="checkbox" checked={prioritize} onChange={e => setPrioritize(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-purple focus:ring-brand-purple/30" />
              <div>
                <span className="font-medium">Minst verkochte leads eerst</span>
                <p className="text-xs text-slate-500">Leads die nog nooit of minder vaak als bulk zijn geëxporteerd krijgen voorrang</p>
              </div>
            </label>
          </div>

          <div className="border-t border-slate-100 px-5 py-4">
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Annuleren
              </button>
              <button
                onClick={handleExport}
                disabled={exporting || branchRequired || effectiveTotal === 0}
                className="flex-1 rounded-lg bg-button-gradient py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-60"
              >
                {exporting ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Exporteren...
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <ArrowDownTrayIcon className="h-4 w-4" />
                    {Number.isFinite(exportCount)
                      ? `${Math.max(0, exportCount).toLocaleString('nl-NL')} leads exporteren`
                      : 'Exporteren'}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}

type BulkAssignResult = {
  assigned: number;
  skipped_already: number;
  blocked_guardrails?: number;
  total: number;
  customer_name: string;
};

function BulkAssignModal({
  customers,
  selectedLeadIds,
  filterParams,
  totalInFilter,
  initialScope,
  onClose,
  onAssigned,
  onError,
}: {
  customers: Customer[];
  selectedLeadIds: string[];
  filterParams: Record<string, string>;
  totalInFilter: number;
  initialScope: 'selected' | 'all_filtered';
  onClose: () => void;
  onAssigned: (result: BulkAssignResult) => void;
  onError: (message: string) => void;
}) {
  const hasSelection = selectedLeadIds.length > 0;
  const initial = initialScope === 'selected' && !hasSelection ? 'all_filtered' : initialScope;

  const [customerId, setCustomerId] = useState('');
  const [scope, setScope] = useState<'selected' | 'all_filtered'>(initial);
  const [maxLeads, setMaxLeads] = useState('');
  const [overrideGuardrails, setOverrideGuardrails] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [filterCount, setFilterCount] = useState<number | null>(totalInFilter > 0 ? totalInFilter : null);
  const [filterCountLoading, setFilterCountLoading] = useState(false);

  // Live filter-count via /api/admin/leads/count zodat de teller exact
  // overeenkomt met wat het backend-endpoint gaat resolven (en dus identiek
  // is aan de export-modal-count).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setFilterCountLoading(true);
      try {
        const params = new URLSearchParams(filterParams);
        const res = await adminFetch(`/api/admin/leads/count?${params}`);
        if (!cancelled && res.ok) {
          const d = await res.json();
          setFilterCount(typeof d.count === 'number' ? d.count : 0);
        }
      } finally {
        if (!cancelled) setFilterCountLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [filterParams]);

  const customerName = useMemo(
    () => customers.find(c => c.id === customerId)?.name || '',
    [customerId, customers],
  );

  const filterTotal = filterCount ?? totalInFilter;
  const cap = maxLeads && Number(maxLeads) > 0 ? Number(maxLeads) : Number.POSITIVE_INFINITY;
  const targetCount = scope === 'selected'
    ? selectedLeadIds.length
    : Math.max(0, Math.min(filterTotal, cap));

  const handleSubmit = async () => {
    if (!customerId) { setError('Kies eerst een klant'); return; }
    if (targetCount === 0) { setError('Geen leads om toe te wijzen'); return; }
    setSubmitting(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        customer_id: customerId,
        scope,
        override_guardrails: overrideGuardrails,
      };
      if (scope === 'selected') {
        body.lead_ids = selectedLeadIds;
      } else {
        // Map page filter `customer_id` → `filter_customer_id` zodat we de
        // toewijzings-klant niet overschrijven.
        const {
          customer_id: filterCustomerId,
          ...restFilters
        } = filterParams;
        Object.assign(body, restFilters);
        if (filterCustomerId) body.filter_customer_id = filterCustomerId;
        if (maxLeads && Number(maxLeads) > 0) body.max_leads = Number(maxLeads);
      }
      const res = await adminFetch('/api/admin/leads/bulk-assign', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = d?.error || 'Toewijzen mislukt';
        throw new Error(msg);
      }

      const assigned = typeof d.assigned === 'number' ? d.assigned : 0;
      const blocked = typeof d.blocked_guardrails === 'number' ? d.blocked_guardrails : 0;
      const skipped = typeof d.skipped_already === 'number' ? d.skipped_already : 0;
      const total = typeof d.total === 'number' ? d.total : targetCount;
      const name = typeof d.customer_name === 'string' ? d.customer_name : customerName;

      if (assigned === 0 && blocked > 0) {
        const sampleReasons: string[] = Array.isArray(d.blocked_sample)
          ? (d.blocked_sample as Array<{ reasons?: string[] }>)
              .flatMap(s => s.reasons || [])
              .filter((r, i, arr) => arr.indexOf(r) === i)
              .slice(0, 3)
          : [];
        const detail = sampleReasons.length > 0 ? ` ${sampleReasons.join(' · ')}` : '';
        const msg =
          (typeof d.error === 'string' && d.error) ||
          `${blocked} lead${blocked === 1 ? '' : 's'} geblokkeerd door guardrails.${detail} Vink hieronder "Guardrails negeren" aan om toch toe te wijzen.`;
        setError(msg);
        onError(msg);
        return;
      }

      onAssigned({
        assigned,
        skipped_already: skipped,
        blocked_guardrails: blocked,
        total,
        customer_name: name,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Er ging iets mis';
      setError(msg);
      onError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4 sm:items-center">
        <div className="my-8 max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Leads toewijzen aan klant</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Wijst geselecteerde of gefilterde leads in één keer aan een klant toe.
              </p>
            </div>
            <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><XMarkIcon className="h-5 w-5" /></button>
          </div>

          <div className="space-y-4 p-5">
            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>}

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Klant</label>
              <SearchableSelect
                value={customerId}
                onChange={v => setCustomerId(v || '')}
                options={customers.map(c => ({ value: c.id, label: c.name }))}
                emptyOptionLabel="—"
                placeholder="Kies een klant…"
                searchPlaceholder="Zoek klant…"
                ariaLabel="Klant kiezen voor toewijzen"
                className="py-2.5"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">Welke leads toewijzen?</label>
              <div className="space-y-2">
                <label className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-sm transition ${scope === 'selected' ? 'border-brand-purple/50 bg-brand-purple/5' : 'border-slate-200 bg-white hover:bg-slate-50'} ${!hasSelection ? 'cursor-not-allowed opacity-50' : ''}`}>
                  <input
                    type="radio"
                    name="bulk-assign-scope"
                    value="selected"
                    disabled={!hasSelection}
                    checked={scope === 'selected'}
                    onChange={() => setScope('selected')}
                    className="mt-0.5 h-4 w-4 border-slate-300 text-brand-purple focus:ring-brand-purple/30"
                  />
                  <div>
                    <span className="font-medium text-slate-700">
                      Alleen geselecteerde leads
                      <span className="ml-2 text-slate-500">({selectedLeadIds.length.toLocaleString('nl-NL')})</span>
                    </span>
                    {!hasSelection && (
                      <p className="mt-0.5 text-xs text-slate-400">Selecteer eerst leads in de tabel om deze optie te gebruiken.</p>
                    )}
                  </div>
                </label>
                <label className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-sm transition ${scope === 'all_filtered' ? 'border-brand-purple/50 bg-brand-purple/5' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                  <input
                    type="radio"
                    name="bulk-assign-scope"
                    value="all_filtered"
                    checked={scope === 'all_filtered'}
                    onChange={() => setScope('all_filtered')}
                    className="mt-0.5 h-4 w-4 border-slate-300 text-brand-purple focus:ring-brand-purple/30"
                  />
                  <div className="flex-1">
                    <span className="font-medium text-slate-700">
                      Alle leads in huidige filters
                      <span className={`ml-2 text-slate-500 ${filterCountLoading ? 'opacity-60' : ''}`}>
                        ({filterTotal.toLocaleString('nl-NL')}{filterCountLoading ? '…' : ''})
                      </span>
                    </span>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Pas de filters op de leads-pagina aan om deze set te wijzigen.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {scope === 'all_filtered' && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Max. aantal leads (optioneel)</label>
                <input
                  type="number"
                  value={maxLeads}
                  onChange={e => setMaxLeads(e.target.value)}
                  placeholder={`Alle ${filterTotal.toLocaleString('nl-NL')}`}
                  min={1}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Leads worden eerst gesorteerd op &quot;minst eerder als bulk verkocht&quot;, daarna op werving­datum (nieuwste eerst).
                </p>
              </div>
            )}

            <label className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-sm transition ${overrideGuardrails ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
              <input
                type="checkbox"
                checked={overrideGuardrails}
                onChange={e => setOverrideGuardrails(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500/30"
              />
              <div>
                <span className="font-medium text-slate-700">Guardrails negeren</span>
                <p className="mt-0.5 text-xs text-slate-500">
                  Wijs ook toe als branche of doelgebied niet matcht, of als de lead geen coördinaten heeft.
                </p>
              </div>
            </label>

            <div className="rounded-lg border border-violet-200 bg-violet-50/60 px-4 py-3 text-xs text-violet-900">
              <p className="font-semibold">Wat gebeurt er bij toewijzen?</p>
              <ul className="mt-1 space-y-0.5 text-violet-800/90">
                <li>• Leads die binnen de afgelopen 30 dagen al aan deze klant zijn toegewezen worden overgeslagen.</li>
                <li>• Standaard checken we branche + doelgebied van de klant.</li>
                <li>• Heeft de klant een actieve betaalde leads-batch? Dan komen de toewijzingen daarin (progress klopt direct).</li>
                <li>• Bestaande Teamleader/Google Sheets integraties worden automatisch gesynced.</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-100 px-5 py-4">
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Annuleren
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !customerId || targetCount === 0}
                className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Toewijzen…
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <UserPlusIcon className="h-4 w-4" />
                    {Number.isFinite(targetCount)
                      ? `${Math.max(0, targetCount).toLocaleString('nl-NL')} leads toewijzen`
                      : 'Toewijzen'}
                    {customerName && ` aan ${customerName}`}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </>
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Branche</label>
              <select value={formBranch} onChange={e => setFormBranch(e.target.value)} disabled={isEdit}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-50">
                {branches.filter(b => b.is_active).map(b => <option key={b.slug} value={b.slug}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Klant (bedrijf)</label>
              <SearchableSelect
                value={form.customer_id || ''}
                onChange={v => set('customer_id', v)}
                options={customers.map(c => ({ value: c.id, label: c.name }))}
                emptyOptionLabel="Geen klant"
                placeholder="- Selecteer -"
                searchPlaceholder="Zoek klant…"
                ariaLabel="Klant (bedrijf)"
              />
            </div>
          </div>
          <div className="border-t border-slate-100 pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Contactgegevens</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
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
                  <option value="">- Selecteer -</option>
                  <optgroup label="Nederland">{LEAD_PROVINCE_OPTIONS_NL.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>
                  <optgroup label="België">{LEAD_PROVINCE_OPTIONS_BE.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>
                </select>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Status & metadata</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
                <select value={form.status || 'nieuw'} onChange={e => set('status', e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900">
                  {STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {branchFields.map(f => (
                  <div key={f.key}>
                    <label className="mb-1 block text-xs font-medium text-slate-500">{f.label}{f.is_required ? ' *' : ''}</label>
                    {f.field_type === 'textarea' ? (
                      <textarea value={form[f.key] || ''} onChange={e => set(f.key, e.target.value)} rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50" />
                    ) : f.field_type === 'select' ? (
                      <select value={form[f.key] || ''} onChange={e => set(f.key, e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900">
                        <option value="">- Selecteer -</option>
                        {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : f.field_type === 'boolean' ? (
                      <select value={form[f.key] || ''} onChange={e => set(f.key, e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900">
                        <option value="">- Selecteer -</option>
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
          {isEdit && (lead?.meta_campaign_id || lead?.meta_ad_id || lead?.lead_cost) && (
            <div className="border-t border-slate-100 pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Meta Ads</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {lead?.meta_campaign_id && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Campaign ID</label>
                    <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-mono text-slate-600 select-all">{lead.meta_campaign_id}</p>
                  </div>
                )}
                {lead?.meta_adset_id && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Adset ID</label>
                    <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-mono text-slate-600 select-all">{lead.meta_adset_id as string}</p>
                  </div>
                )}
                {lead?.meta_ad_id && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Ad ID</label>
                    <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-mono text-slate-600 select-all">{lead.meta_ad_id as string}</p>
                  </div>
                )}
                {lead?.lead_cost && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Lead kosten (CPL)</label>
                    <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-emerald-600">&euro;{Number(lead.lead_cost).toFixed(2)}</p>
                  </div>
                )}
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
