'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  ArrowDownTrayIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckIcon,
  BookmarkIcon,
  TrashIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { portalFetch } from '@/lib/portalAuth';

/* ─── types ─── */

interface ExportColumn {
  key: string;
  label: string;
  group: 'basis' | 'adres' | 'lead' | 'branche' | 'meta';
}

interface BranchField {
  key: string;
  label: string;
}

export interface ExportFilters {
  statusFilter: string;
  branchFilter: string;
  dateFrom: string;
  dateTo: string;
  leadSource: string;
  search: string;
  /** 'all' | 'unassigned' | portal_user uuid */
  assignedTo?: string;
  /** Comma-separated provincie names */
  provinces?: string;
  plaats?: string;
  postcodeArea?: string;
  maxDistanceKm?: string;
}

export interface ExportPreset {
  id: string;
  name: string;
  columns: string[];
  format: 'csv' | 'xlsx' | 'vcf';
  separator: ';' | ',';
  dateFormat: 'nl' | 'iso';
  includeHeaders: boolean;
  feedbackFilter: '' | 'unrated';
}

/* ─── column definitions ─── */

const CORE_COLUMNS: ExportColumn[] = [
  { key: 'naam_klant', label: 'Naam', group: 'basis' },
  { key: 'email', label: 'E-mail', group: 'basis' },
  { key: 'telefoonnummer', label: 'Telefoon', group: 'basis' },

  { key: 'postcode', label: 'Postcode', group: 'adres' },
  { key: 'huisnummer', label: 'Huisnummer', group: 'adres' },
  { key: 'plaatsnaam', label: 'Plaats', group: 'adres' },
  { key: 'provincie', label: 'Provincie', group: 'adres' },
  { key: 'land', label: 'Land', group: 'adres' },

  { key: 'branch', label: 'Branche', group: 'lead' },
  { key: 'status', label: 'Status', group: 'lead' },
  { key: 'received_at', label: 'Ontvangstdatum', group: 'lead' },

  { key: 'notities', label: 'Notities', group: 'meta' },
];

const GROUP_LABELS: Record<string, string> = {
  basis: 'Basis',
  adres: 'Adres',
  lead: 'Lead-info',
  branche: 'Branche-specifiek',
  meta: 'Overig',
};

const GROUP_ORDER = ['basis', 'adres', 'lead', 'branche', 'meta'];

const PRESET_STANDAARD: string[] = [
  'naam_klant', 'email', 'telefoonnummer', 'postcode', 'huisnummer',
  'plaatsnaam', 'provincie', 'status', 'branch', 'received_at', 'notities',
];

const PRESET_BELSYSTEEM: string[] = [
  'naam_klant', 'telefoonnummer', 'email', 'postcode', 'plaatsnaam',
];

const STORAGE_KEY = 'warmeleads-export-presets';

function loadSavedPresets(): ExportPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p: ExportPreset) =>
      p && p.id && p.name && Array.isArray(p.columns) && p.columns.length > 0,
    );
  } catch {
    return [];
  }
}

function persistPresets(presets: ExportPreset[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch { /* quota exceeded */ }
}

async function readPortalExportErrorMessage(res: Response): Promise<string> {
  const raw = await res.text();
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    try {
      const j = JSON.parse(trimmed) as { error?: string };
      if (typeof j.error === 'string' && j.error.trim()) return j.error;
    } catch {
      /* ignore */
    }
  }
  if (res.status === 413) {
    return 'De export is te groot voor één download. Gebruik filters (datum, branche, status) of neem contact op voor een uitgebreide export.';
  }
  return 'Export mislukt. Probeer het later opnieuw.';
}

/* ─── component ─── */

export interface ExportSelection {
  mode: 'filters' | 'lead_ids';
  leadIds?: string[];
}

interface ExportWizardProps {
  open: boolean;
  onClose: () => void;
  filters: ExportFilters;
  totalLeads: number;
  customerName: string;
  branchFields: BranchField[];
  exportSelection?: ExportSelection | null;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function ExportWizard({
  open,
  onClose,
  filters,
  totalLeads,
  customerName,
  branchFields,
  exportSelection,
  showToast,
}: ExportWizardProps) {
  const [step, setStep] = useState(1);

  const allColumns = useMemo<ExportColumn[]>(() => {
    const branchCols: ExportColumn[] = branchFields.map(f => ({
      key: `cf_${f.key}`,
      label: f.label,
      group: 'branche' as const,
    }));
    return [...CORE_COLUMNS, ...branchCols];
  }, [branchFields]);

  const allColumnKeys = useMemo(() => new Set(allColumns.map(c => c.key)), [allColumns]);

  const [selectedCols, setSelectedCols] = useState<string[]>(PRESET_STANDAARD);
  const [format, setFormat] = useState<'csv' | 'xlsx' | 'vcf'>('xlsx');
  const [separator, setSeparator] = useState<';' | ','>(',');
  const [dateFormat, setDateFormat] = useState<'nl' | 'iso'>('nl');
  const [includeHeaders, setIncludeHeaders] = useState(true);
  const [feedbackFilter, setFeedbackFilter] = useState<'' | 'unrated'>('');

  const [savedPresets, setSavedPresets] = useState<ExportPreset[]>([]);
  const [presetName, setPresetName] = useState('');
  const [showSavePreset, setShowSavePreset] = useState(false);

  const [downloading, setDownloading] = useState(false);
  const [preview, setPreview] = useState<string[][] | null>(null);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [previewCount, setPreviewCount] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 639px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (typeof document === 'undefined') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setStep(1);
      setSavedPresets(loadSavedPresets());
      setPreview(null);
      setShowSavePreset(false);
      setPresetName('');
      setDownloading(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !downloading) onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open, downloading, onClose]);

  const grouped = useMemo(() => {
    const groups: Record<string, ExportColumn[]> = {};
    allColumns.forEach(col => {
      if (!groups[col.group]) groups[col.group] = [];
      groups[col.group].push(col);
    });
    return groups;
  }, [allColumns]);

  const toggleCol = (key: string) => {
    setSelectedCols(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key],
    );
  };

  const toggleGroup = (group: string) => {
    const groupKeys = (grouped[group] || []).map(c => c.key);
    const allSelected = groupKeys.every(k => selectedCols.includes(k));
    if (allSelected) {
      setSelectedCols(prev => prev.filter(k => !groupKeys.includes(k)));
    } else {
      setSelectedCols(prev => [...new Set([...prev, ...groupKeys])]);
    }
  };

  const applyBuiltinPreset = (preset: 'standaard' | 'belsysteem' | 'volledig') => {
    if (preset === 'standaard') setSelectedCols(PRESET_STANDAARD);
    else if (preset === 'belsysteem') setSelectedCols(PRESET_BELSYSTEEM);
    else setSelectedCols(allColumns.map(c => c.key));
  };

  const applyCustomPreset = (preset: ExportPreset) => {
    const validCols = preset.columns.filter(k => allColumnKeys.has(k));
    setSelectedCols(validCols.length > 0 ? validCols : PRESET_STANDAARD);
    setFormat(['csv', 'xlsx', 'vcf'].includes(preset.format) ? preset.format : 'xlsx');
    setSeparator(preset.separator === ',' ? ',' : ';');
    setDateFormat(preset.dateFormat === 'iso' ? 'iso' : 'nl');
    setIncludeHeaders(preset.includeHeaders !== false);
    setFeedbackFilter(preset.feedbackFilter === 'unrated' ? 'unrated' : '');
  };

  const saveCurrentAsPreset = () => {
    if (!presetName.trim()) return;
    const newPreset: ExportPreset = {
      id: Date.now().toString(),
      name: presetName.trim(),
      columns: selectedCols,
      format,
      separator,
      dateFormat,
      includeHeaders,
      feedbackFilter,
    };
    const updated = [...savedPresets, newPreset];
    setSavedPresets(updated);
    persistPresets(updated);
    setPresetName('');
    setShowSavePreset(false);
  };

  const deletePreset = (id: string) => {
    const updated = savedPresets.filter(p => p.id !== id);
    setSavedPresets(updated);
    persistPresets(updated);
  };

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    params.set('format', format);
    params.set('columns', selectedCols.join(','));
    params.set('separator', separator);
    params.set('date_format', dateFormat);
    params.set('include_headers', includeHeaders ? 'true' : 'false');
    if (feedbackFilter) params.set('feedback_filter', feedbackFilter);
    if (exportSelection?.mode === 'lead_ids' && exportSelection.leadIds?.length) {
      params.set('lead_ids', exportSelection.leadIds.join(','));
    } else {
      if (filters.statusFilter !== 'all') params.set('status', filters.statusFilter);
      if (filters.branchFilter !== 'all') params.set('branch', filters.branchFilter);
      if (filters.dateFrom) params.set('from', filters.dateFrom);
      if (filters.dateTo) params.set('to', filters.dateTo);
      if (filters.leadSource !== 'all') params.set('lead_source', filters.leadSource);
      if (filters.search) params.set('search', filters.search);
      if (filters.assignedTo && filters.assignedTo !== 'all') {
        params.set('assigned_to', filters.assignedTo);
      }
      if (filters.provinces) params.set('provincie', filters.provinces);
      if (filters.plaats) params.set('plaats', filters.plaats);
      if (filters.postcodeArea) params.set('postcode_area', filters.postcodeArea);
      if (filters.maxDistanceKm) params.set('max_distance_km', filters.maxDistanceKm);
    }
    return params;
  }, [format, selectedCols, separator, dateFormat, includeHeaders, feedbackFilter, filters, exportSelection]);

  const loadPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const params = buildParams();
      params.set('format', 'csv');
      params.set('separator', ',');
      params.set('include_headers', 'true');
      const res = await portalFetch(`/api/portal/export?${params}`);
      if (!res.ok) {
        const errMsg = await readPortalExportErrorMessage(res);
        showToast?.(errMsg, 'error');
        setPreview([]);
        setPreviewHeaders([]);
        setPreviewCount(0);
        setPreviewLoading(false);
        return;
      }
      const text = await res.text();
      const bom = text.startsWith('\uFEFF') ? text.slice(1) : text;
      const lines = bom.split('\r\n').filter(l => l.trim());
      if (lines.length === 0) {
        setPreviewHeaders([]);
        setPreview([]);
        setPreviewCount(0);
      } else {
        const parseLine = (line: string) => {
          const result: string[] = [];
          let current = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inQuotes) {
              if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
              else if (ch === '"') { inQuotes = false; }
              else { current += ch; }
            } else {
              if (ch === '"') { inQuotes = true; }
              else if (ch === ',') { result.push(current); current = ''; }
              else { current += ch; }
            }
          }
          result.push(current);
          return result;
        };
        const headers = parseLine(lines[0]);
        const dataLines = lines.slice(1);
        setPreviewHeaders(headers);
        setPreview(dataLines.slice(0, 5).map(parseLine));
        setPreviewCount(dataLines.length);
      }
    } catch {
      setPreview([]);
      setPreviewCount(0);
      showToast?.('Preview kon niet geladen worden', 'error');
    }
    setPreviewLoading(false);
  }, [buildParams, showToast]);

  useEffect(() => {
    if (step === 3) loadPreview();
  }, [step, loadPreview]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const params = buildParams();
      const res = await portalFetch(`/api/portal/export?${params}`);
      if (!res.ok) {
        const errMsg = await readPortalExportErrorMessage(res);
        showToast?.(errMsg, 'error');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = format === 'vcf' ? 'vcf' : format === 'xlsx' ? 'xlsx' : 'csv';
      a.download = `leads-${customerName.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      showToast?.('Export gedownload', 'success');
      onClose();
    } catch {
      showToast?.('Download mislukt. Controleer je verbinding en probeer opnieuw.', 'error');
    }
    setDownloading(false);
  };

  const closeSafe = useCallback(() => { if (!downloading) onClose(); }, [downloading, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const STEPS = [
    { num: 1, label: 'Kolommen' },
    { num: 2, label: 'Format & opties' },
    { num: 3, label: 'Preview & download' },
  ];

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop (hidden below mobile fullscreen, visible behind desktop modal) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 hidden bg-black/30 backdrop-blur-sm sm:block"
            onClick={closeSafe}
          />

          {/* Centering wrapper (fullscreen on mobile, centered modal on desktop) */}
          <div className="pointer-events-none fixed inset-0 z-[60] flex sm:items-center sm:justify-center sm:p-6">
            <motion.div
              initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 12 }}
              animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
              exit={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 12 }}
              transition={
                isMobile
                  ? { type: 'spring', damping: 30, stiffness: 280 }
                  : { type: 'spring', damping: 26, stiffness: 320 }
              }
              className="pointer-events-auto flex w-full flex-col overflow-hidden bg-white sm:h-auto sm:max-h-[calc(100vh-3rem)] sm:w-full sm:max-w-xl sm:rounded-2xl sm:border sm:border-slate-200 sm:shadow-xl"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="shrink-0 border-b border-slate-100 bg-white pt-[env(safe-area-inset-top)] sm:pt-0">
                <div className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4">
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-slate-900 sm:text-lg">Leads exporteren</h2>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {exportSelection?.mode === 'lead_ids'
                        ? `${totalLeads} geselecteerde lead${totalLeads === 1 ? '' : 's'}`
                        : `${totalLeads} leads beschikbaar`}
                    </p>
                  </div>
                  <button
                    onClick={closeSafe}
                    disabled={downloading}
                    className="ml-3 shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                {/* Step indicator */}
                <div className="flex gap-1 px-4 pb-3 sm:px-5">
                  {STEPS.map(s => {
                    const isActive = step === s.num;
                    const isDone = step > s.num;
                    const canClick = s.num <= step || (s.num <= step + 1 && selectedCols.length > 0);
                    return (
                      <button
                        key={s.num}
                        onClick={() => { if (canClick) setStep(s.num); }}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition ${
                          isActive
                            ? 'bg-brand-purple/10 text-brand-purple'
                            : isDone
                              ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                              : canClick
                                ? 'text-slate-400 hover:bg-slate-50'
                                : 'text-slate-300 cursor-not-allowed'
                        }`}
                      >
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                          isDone ? 'bg-emerald-100 text-emerald-600' :
                          isActive ? 'bg-brand-purple text-white' : 'bg-slate-100 text-slate-400'
                        }`}>
                          {isDone ? <CheckIcon className="h-3 w-3" /> : s.num}
                        </span>
                        <span className="hidden min-[400px]:inline">{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
                {/* ── Step 1: Kolommen ── */}
                {step === 1 && (
                  <div className="space-y-3">
                    {/* Quick presets */}
                    <div>
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Snelkeuze</p>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { id: 'standaard', label: 'Standaard', desc: '11' },
                          { id: 'belsysteem', label: 'Belsysteem', desc: '5' },
                          { id: 'volledig', label: 'Volledig', desc: String(allColumns.length) },
                        ].map(p => (
                          <button
                            key={p.id}
                            onClick={() => applyBuiltinPreset(p.id as 'standaard' | 'belsysteem' | 'volledig')}
                            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-brand-purple/30 hover:bg-brand-purple/5 hover:text-brand-purple"
                          >
                            {p.label} <span className="text-slate-400">({p.desc})</span>
                          </button>
                        ))}
                        {savedPresets.map(p => (
                          <div key={p.id} className="flex items-center">
                            <button
                              onClick={() => applyCustomPreset(p)}
                              className="rounded-l-lg border border-r-0 border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-brand-purple/30 hover:bg-brand-purple/5 hover:text-brand-purple"
                            >
                              <BookmarkIcon className="mr-1 -mt-0.5 inline h-3 w-3" />
                              {p.name}
                            </button>
                            <button
                              onClick={() => deletePreset(p.id)}
                              className="rounded-r-lg border border-slate-200 px-1.5 py-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                            >
                              <TrashIcon className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Column groups */}
                    {GROUP_ORDER.map(group => {
                      const cols = grouped[group];
                      if (!cols || cols.length === 0) return null;
                      const allSelected = cols.every(c => selectedCols.includes(c.key));
                      const someSelected = cols.some(c => selectedCols.includes(c.key));
                      return (
                        <div key={group} className="rounded-xl border border-slate-200">
                          <button
                            onClick={() => toggleGroup(group)}
                            className="flex w-full items-center justify-between px-3 py-2 text-left"
                          >
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                              {GROUP_LABELS[group]}
                            </span>
                            <span className={`flex h-4 w-4 items-center justify-center rounded border text-white transition ${
                              allSelected ? 'border-brand-purple bg-brand-purple' :
                              someSelected ? 'border-brand-purple/50 bg-brand-purple/30' :
                              'border-slate-300'
                            }`}>
                              {(allSelected || someSelected) && <CheckIcon className="h-3 w-3" />}
                            </span>
                          </button>
                          <div className="flex flex-wrap gap-1.5 border-t border-slate-100 px-3 py-2.5">
                            {cols.map(col => {
                              const active = selectedCols.includes(col.key);
                              return (
                                <button
                                  key={col.key}
                                  onClick={() => toggleCol(col.key)}
                                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                                    active
                                      ? 'bg-brand-purple/10 text-brand-purple ring-1 ring-inset ring-brand-purple/20'
                                      : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                                  }`}
                                >
                                  {active && <CheckIcon className="h-3 w-3" />}
                                  {col.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    <p className="text-center text-[11px] text-slate-400">
                      {selectedCols.length} kolommen geselecteerd
                    </p>
                  </div>
                )}

                {/* ── Step 2: Format & opties ── */}
                {step === 2 && (
                  <div className="space-y-4">
                    {/* Format */}
                    <div>
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Bestandsformaat</p>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'xlsx', label: 'Excel', sub: '.xlsx', desc: 'Spreadsheets' },
                          { id: 'csv', label: 'CSV', sub: '.csv', desc: 'Belsystemen' },
                          { id: 'vcf', label: 'vCard', sub: '.vcf', desc: 'Contacten' },
                        ].map(f => (
                          <button
                            key={f.id}
                            onClick={() => setFormat(f.id as 'csv' | 'xlsx' | 'vcf')}
                            className={`rounded-xl border-2 p-2.5 text-center transition ${
                              format === f.id
                                ? 'border-brand-purple bg-brand-purple/5'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <p className={`text-sm font-semibold ${format === f.id ? 'text-brand-purple' : 'text-slate-700'}`}>{f.label}</p>
                            <p className="text-[10px] text-slate-400">{f.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* CSV-specific options */}
                    <AnimatePresence>
                      {format === 'csv' && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">CSV-opties</p>
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { val: ',', label: 'Komma (,)', desc: 'Internationaal' },
                                { val: ';', label: 'Puntkomma (;)', desc: 'NL standaard' },
                              ].map(s => (
                                <button
                                  key={s.val}
                                  onClick={() => setSeparator(s.val as ';' | ',')}
                                  className={`rounded-lg border-2 p-2 text-left transition ${
                                    separator === s.val ? 'border-brand-purple bg-brand-purple/5' : 'border-slate-200 hover:border-slate-300'
                                  }`}
                                >
                                  <p className={`text-sm font-medium ${separator === s.val ? 'text-brand-purple' : 'text-slate-700'}`}>{s.label}</p>
                                  <p className="text-[10px] text-slate-400">{s.desc}</p>
                                </button>
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Date format */}
                    <div>
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Datumformaat</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setDateFormat('nl')}
                          className={`rounded-lg border-2 p-2 text-center transition ${
                            dateFormat === 'nl' ? 'border-brand-purple bg-brand-purple/5' : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <p className={`text-sm font-medium ${dateFormat === 'nl' ? 'text-brand-purple' : 'text-slate-700'}`}>DD-MM-JJJJ</p>
                          <p className="text-[10px] text-slate-400">Nederlands</p>
                        </button>
                        <button
                          onClick={() => setDateFormat('iso')}
                          className={`rounded-lg border-2 p-2 text-center transition ${
                            dateFormat === 'iso' ? 'border-brand-purple bg-brand-purple/5' : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <p className={`text-sm font-medium ${dateFormat === 'iso' ? 'text-brand-purple' : 'text-slate-700'}`}>JJJJ-MM-DD</p>
                          <p className="text-[10px] text-slate-400">ISO / internationaal</p>
                        </button>
                      </div>
                    </div>

                    {/* Toggles */}
                    <div className="space-y-2 rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-700">Kolomkoppen meenemen</span>
                        <button
                          onClick={() => setIncludeHeaders(!includeHeaders)}
                          role="switch"
                          aria-checked={includeHeaders}
                          aria-label="Kolomkoppen meenemen"
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
                            includeHeaders ? 'bg-brand-purple' : 'bg-slate-200'
                          }`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition ${
                            includeHeaders ? 'translate-x-[18px]' : 'translate-x-[3px]'
                          }`} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm text-slate-700">Alleen onbeoordeelde leads</span>
                          <p className="text-[10px] text-slate-400">Sluit leads met reclamatie uit</p>
                        </div>
                        <button
                          onClick={() => setFeedbackFilter(feedbackFilter === 'unrated' ? '' : 'unrated')}
                          role="switch"
                          aria-checked={feedbackFilter === 'unrated'}
                          aria-label="Alleen onbeoordeelde leads"
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
                            feedbackFilter === 'unrated' ? 'bg-brand-purple' : 'bg-slate-200'
                          }`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition ${
                            feedbackFilter === 'unrated' ? 'translate-x-[18px]' : 'translate-x-[3px]'
                          }`} />
                        </button>
                      </div>
                    </div>

                    {/* Save preset */}
                    <div className="border-t border-slate-100 pt-3">
                      {showSavePreset ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Naam voor profiel..."
                            value={presetName}
                            onChange={e => setPresetName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveCurrentAsPreset(); }}
                            className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/20"
                            autoFocus
                          />
                          <button
                            onClick={saveCurrentAsPreset}
                            disabled={!presetName.trim()}
                            className="rounded-lg bg-brand-purple px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-purple/90 disabled:opacity-50"
                          >
                            Opslaan
                          </button>
                          <button
                            onClick={() => { setShowSavePreset(false); setPresetName(''); }}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
                          >
                            Annuleer
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowSavePreset(true)}
                          className="flex items-center gap-1.5 text-xs font-medium text-brand-purple transition hover:text-brand-purple/80"
                        >
                          <BookmarkIcon className="h-3.5 w-3.5" />
                          Instellingen opslaan als profiel
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Step 3: Preview & download ── */}
                {step === 3 && (
                  <div className="space-y-3">
                    {/* Summary */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <p className="text-sm font-semibold text-slate-900">
                        {previewLoading ? (
                          <span className="inline-flex items-center gap-1.5">
                            <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                            Preview laden...
                          </span>
                        ) : (
                          <>{previewCount} leads worden geëxporteerd</>
                        )}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {selectedCols.length} kolommen &middot; {format.toUpperCase()}
                        {format === 'csv' ? ` (${separator === ',' ? 'komma' : 'puntkomma'})` : ''}
                        {feedbackFilter === 'unrated' ? ' &middot; Alleen onbeoordeeld' : ''}
                      </p>
                    </div>

                    {/* Preview table */}
                    {previewLoading ? (
                      <div className="space-y-1.5">
                        {[0, 1, 2].map(i => (
                          <div key={i} className="h-7 animate-pulse rounded-lg bg-slate-100" />
                        ))}
                      </div>
                    ) : preview && preview.length > 0 ? (
                      <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
                        <div className="inline-block min-w-full rounded-xl border border-slate-200">
                          <table className="min-w-full text-[11px]">
                            <thead>
                              <tr className="border-b border-slate-100 bg-slate-50">
                                {previewHeaders.map((h, i) => (
                                  <th key={i} className="whitespace-nowrap px-2.5 py-1.5 text-left font-semibold text-slate-500">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {preview.map((row, ri) => (
                                <tr key={ri}>
                                  {row.map((cell, ci) => (
                                    <td key={ci} className="max-w-[140px] truncate whitespace-nowrap px-2.5 py-1.5 text-slate-600">{cell}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {previewCount > 5 && (
                            <p className="border-t border-slate-100 py-1.5 text-center text-[10px] text-slate-400">
                              ...en {previewCount - 5} meer
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center">
                        <p className="text-sm text-slate-400">Geen leads met de huidige filters</p>
                      </div>
                    )}

                    {format === 'vcf' && (
                      <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                        <p className="text-[11px] text-blue-700">
                          vCard bestanden kunnen direct geïmporteerd worden in je telefooncontacten, Outlook, Google Contacts en de meeste CRM/belsystemen.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="shrink-0 border-t border-slate-100 bg-white px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:px-5 sm:pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    {step > 1 && (
                      <button
                        onClick={() => setStep(step - 1)}
                        className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                      >
                        <ChevronLeftIcon className="h-4 w-4" />
                        Vorige
                      </button>
                    )}
                  </div>
                  {step < 3 ? (
                    <button
                      onClick={() => setStep(step + 1)}
                      disabled={step === 1 && selectedCols.length === 0}
                      className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-purple/90 disabled:opacity-50"
                    >
                      Volgende
                      <ChevronRightIcon className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      onClick={handleDownload}
                      disabled={downloading || previewCount === 0}
                      className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {downloading ? (
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      ) : (
                        <ArrowDownTrayIcon className="h-4 w-4" />
                      )}
                      Download {format.toUpperCase()}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
