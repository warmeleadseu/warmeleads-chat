'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DocumentArrowUpIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  ArrowPathIcon,
  ClipboardDocumentIcon,
  TableCellsIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  ExclamationCircleIcon,
  CheckIcon,
  MinusCircleIcon,
  TrashIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';

/* ─── Types ───────────────────────────────────────────────────────────── */

interface BranchConfig {
  id: string;
  slug: string;
  name: string;
  color: string;
  is_active: boolean;
  branch_fields: { key: string; label: string }[];
}

interface SheetData {
  name: string;
  headers: string[];
  rows: Record<string, unknown>[];
  branch: string;
  mapping: Record<string, string>;
}

interface TabResult {
  sheetName: string;
  branch: string;
  imported: number;
  skipped: number;
  duplicates: number;
  errors: number;
  errorDetails: string[];
}

interface ImportRun {
  run_id: string;
  branch: string;
  sheet_name: string;
  imported: number;
  date: string;
  lead_ids: string[];
}

type Step = 'upload' | 'tabs' | 'mapping' | 'importing' | 'done';

/* ─── Constants ───────────────────────────────────────────────────────── */

const COMMON_CRM_FIELDS = [
  { key: 'naam_klant', label: 'Naam klant' },
  { key: 'email', label: 'E-mail' },
  { key: 'telefoonnummer', label: 'Telefoon' },
  { key: 'postcode', label: 'Postcode' },
  { key: 'huisnummer', label: 'Huisnummer' },
  { key: 'plaatsnaam', label: 'Plaatsnaam' },
  { key: 'provincie', label: 'Provincie' },
  { key: 'wervingsdatum', label: 'Datum' },
  { key: 'notities', label: 'Notities' },
];

const SKIP_PATTERNS = [
  /afstand/i, /binnen\s*gebied/i, /verwerkt/i, /geexporteerd/i, /ge[eë]xporteerd/i,
  /nieuwsbrief/i, /newsletter/i,
];

const ALIASES: Record<string, string[]> = {
  naam_klant: ['naamklant', 'klantnaam', 'volledigenaam', 'naambewoner', 'voornaam', 'achternaam', 'naam', 'name', 'fullname'],
  email: ['emailadres', 'emailaddress', 'mailadres', 'email', 'emal', 'mail'],
  telefoonnummer: ['telefoonnummer', 'telefoon', 'phonenumber', 'phone', 'mobiel', 'gsmnummer', 'gsm', 'telnr', 'tel'],
  postcode: ['postcode', 'zipcode', 'postalcode', 'postal', 'zip'],
  huisnummer: ['huisnummer', 'huisnr', 'housenumber', 'huisnummertoevoeging'],
  plaatsnaam: ['plaatsnaam', 'woonplaats', 'plaats', 'stad', 'city', 'gemeente'],
  provincie: ['provincie', 'province', 'regio'],
  wervingsdatum: ['wervingsdatum', 'aanvraagdatum', 'invuldatum', 'datuminteresseklant', 'datum', 'date', 'created'],
  notities: ['notities', 'opmerkingen', 'opmerking', 'notes', 'toelichting', 'extra'],
  zonnepanelen: ['zonnepanelen', 'zonnepaneel', 'solar', 'solarpanels'],
  dynamisch_contract: ['dynamischcontract', 'dynamisch'],
  stroomverbruik: ['stroomverbruik', 'verbruikinkwh', 'kwh', 'verbruik', 'energieverbruik'],
  budget: ['budget', 'prijsindicatie'],
  reden_thuisbatterij: ['redenthuisbatterij', 'reden', 'motivatie'],
  koopintentie: ['koopintentie'],
  type_airco: ['typeairco', 'aircotype'],
  koelen_verwarmen: ['koelenverwarmen', 'koelenofverwarmen'],
  hoeveel_ruimtes: ['hoeveelruimtes', 'aantalruimtes', 'ruimtes', 'kamers'],
  zakelijk: ['zakelijkofparticulier', 'zakelijk'],
  koop_of_huur: ['koopofhuur', 'koophuur'],
  boorwerkzaamheden_toegestaan: ['boorwerkzaamhedentoegestaan', 'boorwerkzaamheden', 'boorwerk'],
  particulier_ondernemer: ['particulierofondernemer'],
  schuin_plat_dak: ['schuinofplatdak', 'daktype'],
  orientatie_dak: ['orientatiedak', 'dakrichting', 'orientatie'],
  wanneer_installatie: ['wanneerinstallatie', 'installatiedatum', 'planning'],
  hoeveel_panelen: ['hoeveelpanelen', 'aantalpanelen'],
};

const COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  sky: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  cyan: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
  lime: { bg: 'bg-lime-50', text: 'text-lime-700', border: 'border-lime-200' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  teal: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  slate: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' },
};

/* ─── Helpers ─────────────────────────────────────────────────────────── */

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function autoMap(headers: string[], branchFields: { key: string; label: string }[]): Record<string, string> {
  const m: Record<string, string> = {};
  const usedFields = new Set<string>();
  const usedHeaders = new Set<string>();

  const extAliases = { ...ALIASES };
  for (const f of branchFields) {
    if (!extAliases[f.key]) {
      extAliases[f.key] = [normalize(f.key), normalize(f.label)];
    }
  }

  // Score each (header, field) pair; higher = better match
  const candidates: { header: string; field: string; score: number }[] = [];

  for (const header of headers) {
    if (SKIP_PATTERNS.some(p => p.test(header))) continue;
    const norm = normalize(header);
    if (!norm) continue;

    for (const [field, alts] of Object.entries(extAliases)) {
      let bestScore = 0;

      for (const alias of alts) {
        if (norm === alias) {
          bestScore = Math.max(bestScore, 1000 + alias.length);
        } else if (norm.startsWith(alias) || alias.startsWith(norm)) {
          bestScore = Math.max(bestScore, 500 + alias.length);
        } else if (norm.includes(alias) && alias.length >= 4) {
          bestScore = Math.max(bestScore, 100 + alias.length);
        } else if (alias.includes(norm) && norm.length >= 4) {
          bestScore = Math.max(bestScore, 50 + norm.length);
        }
      }

      if (bestScore > 0) {
        candidates.push({ header, field, score: bestScore });
      }
    }
  }

  // Sort by score descending so best matches are assigned first
  candidates.sort((a, b) => b.score - a.score);

  for (const c of candidates) {
    if (usedFields.has(c.field) || usedHeaders.has(c.header)) continue;
    m[c.header] = c.field;
    usedFields.add(c.field);
    usedHeaders.add(c.header);
  }

  return m;
}

function guessSheetBranch(sheetName: string, branches: BranchConfig[]): string {
  const norm = normalize(sheetName);
  for (const b of branches) {
    if (norm.includes(normalize(b.slug)) || norm.includes(normalize(b.name))) {
      return b.slug;
    }
  }
  return '';
}

/* ─── Main Component ──────────────────────────────────────────────────── */

export default function ImportPage() {
  const [step, setStep] = useState<Step>('upload');
  const [branches, setBranches] = useState<BranchConfig[]>([]);
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [results, setResults] = useState<TabResult[]>([]);
  const [progress, setProgress] = useState<{ current: number; total: number; label: string }>({ current: 0, total: 0, label: '' });
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteBranch, setPasteBranch] = useState('');
  const [history, setHistory] = useState<ImportRun[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [undoing, setUndoing] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/import');
      const d = await res.json();
      setHistory(d.history || []);
    } catch { /* ignore */ }
    setLoadingHistory(false);
  }, []);

  useEffect(() => {
    adminFetch('/api/admin/branches').then(r => r.json()).then(d => setBranches(d.branches || []));
    fetchHistory();
  }, [fetchHistory]);

  /* ── File upload handler ──────────────────────────────────────── */

  const handleFile = useCallback(async (file: File) => {
    const XLSX = await import('xlsx');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });

    const parsed: SheetData[] = wb.SheetNames.map(name => {
      const sheet = wb.Sheets[name];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      const headers = json.length > 0 ? Object.keys(json[0]) : [];
      return { name, headers, rows: json, branch: '', mapping: {} };
    }).filter(s => s.rows.length > 0);

    if (parsed.length === 0) return;

    // Auto-guess branches from sheet names
    parsed.forEach(s => { s.branch = guessSheetBranch(s.name, branches); });

    setSheets(parsed);
    setStep('tabs');
  }, [branches]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  /* ── Paste handler ────────────────────────────────────────────── */

  const handlePaste = useCallback(() => {
    if (!pasteText.trim() || !pasteBranch) return;
    const lines = pasteText.split('\n').filter(l => l.trim());
    if (lines.length < 2) return;

    const headers = lines[0].split('\t').map(h => h.trim());
    const rows = lines.slice(1).map(line => {
      const vals = line.split('\t');
      const row: Record<string, unknown> = {};
      headers.forEach((h, i) => { row[h] = (vals[i] || '').trim(); });
      return row;
    }).filter(row => Object.values(row).some(v => v !== ''));

    if (rows.length === 0) return;

    setSheets([{ name: 'Geplakt', headers, rows, branch: pasteBranch, mapping: {} }]);
    setStep('tabs');
  }, [pasteText, pasteBranch]);

  /* ── Mapping auto-fill when branch changes ────────────────────── */

  const updateSheetBranch = useCallback((idx: number, branchSlug: string) => {
    setSheets(prev => {
      const next = [...prev];
      const s = { ...next[idx] };
      s.branch = branchSlug;
      if (branchSlug) {
        const bc = branches.find(b => b.slug === branchSlug);
        s.mapping = autoMap(s.headers, bc?.branch_fields || []);
      } else {
        s.mapping = {};
      }
      next[idx] = s;
      return next;
    });
  }, [branches]);

  const updateMapping = useCallback((sheetIdx: number, header: string, crmField: string) => {
    setSheets(prev => {
      const next = [...prev];
      const s = { ...next[sheetIdx], mapping: { ...next[sheetIdx].mapping } };
      if (crmField === '') {
        delete s.mapping[header];
      } else {
        for (const k of Object.keys(s.mapping)) {
          if (s.mapping[k] === crmField) delete s.mapping[k];
        }
        s.mapping[header] = crmField;
      }
      next[sheetIdx] = s;
      return next;
    });
  }, []);

  /* ── CRM field options per branch ─────────────────────────────── */

  const getCrmFields = useCallback((branchSlug: string) => {
    const bc = branches.find(b => b.slug === branchSlug);
    const custom = (bc?.branch_fields || []).map(f => ({ key: f.key, label: f.label }));
    return [...COMMON_CRM_FIELDS, ...custom];
  }, [branches]);

  /* ── Active (non-skipped) sheets ──────────────────────────────── */

  const activeSheets = useMemo(() => sheets.filter(s => s.branch), [sheets]);

  /* ── Map rows for preview ─────────────────────────────────────── */

  const mapRow = useCallback((row: Record<string, unknown>, mapping: Record<string, string>): Record<string, string> => {
    const mapped: Record<string, string> = {};
    for (const [excelCol, crmField] of Object.entries(mapping)) {
      if (row[excelCol] !== undefined && row[excelCol] !== '') {
        mapped[crmField] = String(row[excelCol]);
      }
    }
    return mapped;
  }, []);

  const isValidRow = useCallback((mapped: Record<string, string>): 'valid' | 'no_name' | 'no_contact' => {
    if (!mapped.naam_klant?.trim()) return 'no_name';
    if (!mapped.email?.trim() && !mapped.telefoonnummer?.trim()) return 'no_contact';
    return 'valid';
  }, []);

  /* ── Run import ───────────────────────────────────────────────── */

  const runImport = useCallback(async () => {
    setStep('importing');
    const allResults: TabResult[] = [];
    const total = activeSheets.reduce((s, sh) => s + sh.rows.length, 0);
    let processed = 0;

    for (const sheet of activeSheets) {
      setProgress({ current: processed, total, label: sheet.name });

      const mappedLeads = sheet.rows
        .map(row => mapRow(row, sheet.mapping))
        .filter(r => {
          const v = isValidRow(r);
          return v === 'valid';
        });

      const BATCH = 200;
      let tabImported = 0;
      let tabSkipped = sheet.rows.length - mappedLeads.length;
      let tabDuplicates = 0;
      let tabErrors = 0;
      const tabErrorDetails: string[] = [];
      const tabInsertedIds: string[] = [];

      for (let i = 0; i < mappedLeads.length; i += BATCH) {
        const batch = mappedLeads.slice(i, i + BATCH);
        try {
          const res = await adminFetch('/api/admin/import', {
            method: 'POST',
            body: JSON.stringify({ branch: sheet.branch, leads: batch }),
          });
          const d = await res.json();
          if (res.ok) {
            tabImported += d.imported || 0;
            tabSkipped += d.skipped || 0;
            tabDuplicates += d.duplicates || 0;
            tabErrors += d.errors || 0;
            if (d.errorDetails) tabErrorDetails.push(...d.errorDetails);
            if (d.insertedIds) tabInsertedIds.push(...d.insertedIds);
          } else {
            tabErrors += batch.length;
            tabErrorDetails.push(d.error || 'Onbekende fout');
          }
        } catch {
          tabErrors += batch.length;
          tabErrorDetails.push('Netwerkfout');
        }
        processed += batch.length;
        setProgress({ current: processed, total, label: sheet.name });
      }

      // Save import run for undo
      if (tabInsertedIds.length > 0) {
        const runId = `spreadsheet_import:${sheet.branch}:${Date.now()}`;
        try {
          await adminFetch('/api/admin/settings', {
            method: 'PUT',
            body: JSON.stringify({
              key: runId,
              value: JSON.stringify({
                lead_ids: tabInsertedIds,
                branch: sheet.branch,
                sheet_name: sheet.name,
                imported: tabInsertedIds.length,
                date: new Date().toISOString(),
              }),
            }),
          });
        } catch { /* non-critical */ }
      }

      processed += tabSkipped;
      setProgress({ current: Math.min(processed, total), total, label: sheet.name });

      const bc = branches.find(b => b.slug === sheet.branch);
      allResults.push({
        sheetName: sheet.name,
        branch: bc?.name || sheet.branch,
        imported: tabImported,
        skipped: tabSkipped,
        duplicates: tabDuplicates,
        errors: tabErrors,
        errorDetails: tabErrorDetails.slice(0, 5),
      });
    }

    setResults(allResults);
    fetchHistory();
    setStep('done');
  }, [activeSheets, branches, mapRow, isValidRow, fetchHistory]);

  /* ── Undo import run ──────────────────────────────────────────── */

  const undoRun = useCallback(async (runId: string) => {
    if (!confirm('Weet je zeker dat je deze import ongedaan wilt maken? Alle leads van deze import worden verwijderd.')) return;
    setUndoing(runId);
    try {
      const res = await adminFetch('/api/admin/import', {
        method: 'DELETE',
        body: JSON.stringify({ run_id: runId }),
      });
      if (res.ok) {
        fetchHistory();
      }
    } catch { /* ignore */ }
    setUndoing(null);
  }, [fetchHistory]);

  /* ── Reset ────────────────────────────────────────────────────── */

  const reset = useCallback(() => {
    setStep('upload');
    setSheets([]);
    setResults([]);
    setActiveTab(0);
    setProgress({ current: 0, total: 0, label: '' });
    setPasteMode(false);
    setPasteText('');
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  /* ── Navigation helpers ───────────────────────────────────────── */

  const canGoToMapping = activeSheets.length > 0;
  const goToMapping = () => {
    // Auto-map all active sheets that haven't been mapped yet
    setSheets(prev => prev.map(s => {
      if (!s.branch || Object.keys(s.mapping).length > 0) return s;
      const bc = branches.find(b => b.slug === s.branch);
      return { ...s, mapping: autoMap(s.headers, bc?.branch_fields || []) };
    }));
    setActiveTab(0);
    setStep('mapping');
  };

  const mappingActiveSheets = useMemo(() => sheets.filter(s => s.branch), [sheets]);
  const currentMappingSheet = mappingActiveSheets[activeTab];
  const allMapped = mappingActiveSheets.every(s => Object.values(s.mapping).includes('naam_klant'));

  /* ── Render ───────────────────────────────────────────────────── */

  const stepLabels = ['Upload', 'Tabbladen', 'Mapping', 'Importeren', 'Resultaat'];
  const stepKeys: Step[] = ['upload', 'tabs', 'mapping', 'importing', 'done'];
  const stepIdx = stepKeys.indexOf(step);

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-slate-900 sm:text-2xl">Leads importeren</h1>
      <p className="mb-6 text-sm text-slate-500">Upload een Excel bestand met meerdere tabbladen of plak data vanuit Google Sheets.</p>

      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-medium sm:gap-2">
        {stepLabels.map((label, i) => {
          if (i === 3 && step !== 'importing') return null;
          if (i === 4 && step !== 'done') return null;
          const done = i < stepIdx;
          const active = i === stepIdx;
          return (
            <div key={label} className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              {i > 0 && <div className={`h-px w-4 sm:w-6 ${done || active ? 'bg-brand-purple/40' : 'bg-slate-200'}`} />}
              <span className={`rounded-full px-3 py-1.5 transition ${active ? 'bg-brand-purple text-white' : done ? 'bg-brand-purple/10 text-brand-purple' : 'bg-slate-100 text-slate-400'}`}>
                <span className="sm:hidden">{i + 1}</span>
                <span className="hidden sm:inline">{i + 1}. {label}</span>
              </span>
            </div>
          );
        })}
      </div>

      {/* ─── Step 1: Upload ──────────────────────────────────────── */}
      {step === 'upload' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex gap-2">
            <button
              onClick={() => setPasteMode(false)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${!pasteMode ? 'bg-brand-purple text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              <DocumentArrowUpIcon className="mr-1.5 inline h-4 w-4" />Bestand uploaden
            </button>
            <button
              onClick={() => setPasteMode(true)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${pasteMode ? 'bg-brand-purple text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              <ClipboardDocumentIcon className="mr-1.5 inline h-4 w-4" />Plakken
            </button>
          </div>

          {!pasteMode ? (
            <label
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-16 transition hover:border-brand-purple/30 hover:bg-brand-purple/[0.02]"
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
            >
              <DocumentArrowUpIcon className="mb-3 h-12 w-12 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">Sleep een bestand hierheen of klik om te selecteren</p>
              <p className="mt-1 text-xs text-slate-400">Excel (.xlsx, .xls) of CSV — meerdere tabbladen worden automatisch herkend</p>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileInput} className="hidden" />
            </label>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Branche</label>
                <select
                  value={pasteBranch}
                  onChange={e => setPasteBranch(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm sm:w-64"
                >
                  <option value="">— Selecteer branche —</option>
                  {branches.filter(b => b.is_active).map(b => <option key={b.slug} value={b.slug}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Data (kopieer uit Google Sheets en plak hieronder)</label>
                <textarea
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  placeholder={'Naam Klant\tPostcode\tE-mail\tTelefoon\nJan de Vries\t1234AB\tjan@email.nl\t0612345678'}
                  className="h-48 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-xs text-slate-700 placeholder:text-slate-300"
                />
              </div>
              <button
                onClick={handlePaste}
                disabled={!pasteText.trim() || !pasteBranch}
                className="rounded-lg bg-button-gradient px-5 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-50"
              >
                Data verwerken
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── Import History (visible on upload + done) ────────────── */}
      {(step === 'upload' || step === 'done') && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-4">
            <ClockIcon className="h-5 w-5 text-slate-400" />
            <h2 className="font-semibold text-slate-900">Eerdere imports</h2>
            <span className="ml-auto text-xs text-slate-400">{history.length} import{history.length !== 1 ? 's' : ''}</span>
          </div>

          {loadingHistory ? (
            <div className="px-6 py-8 text-center text-sm text-slate-400">Laden...</div>
          ) : history.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-slate-400">Nog geen imports uitgevoerd.</div>
          ) : (
            <div className="divide-y divide-slate-50">
              {history.map(run => {
                const bc = branches.find(b => b.slug === run.branch);
                const d = run.date ? new Date(run.date) : null;
                const isUndoing = undoing === run.run_id;
                return (
                  <div key={run.run_id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800">{run.sheet_name || 'Import'}</span>
                        {bc && (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${COLOR_MAP[bc.color]?.bg || 'bg-slate-100'} ${COLOR_MAP[bc.color]?.text || 'text-slate-600'}`}>
                            {bc.name}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {d ? d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                        {' · '}{run.imported || run.lead_ids?.length || 0} leads
                      </p>
                    </div>
                    <button
                      onClick={() => undoRun(run.run_id)}
                      disabled={isUndoing}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-50 sm:py-1.5"
                    >
                      {isUndoing ? (
                        <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <TrashIcon className="h-3.5 w-3.5" />
                      )}
                      {isUndoing ? 'Verwijderen...' : 'Ongedaan maken'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Step 2: Tabs ────────────────────────────────────────── */}
      {step === 'tabs' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="font-semibold text-slate-900">Tabbladen configureren</h2>
            <p className="mt-0.5 text-xs text-slate-500">{sheets.length} tabblad{sheets.length !== 1 ? 'en' : ''} gevonden. Selecteer per tabblad de branche of sla over.</p>
          </div>

          <div className="space-y-3">
            {sheets.map((s, i) => {
              const bc = branches.find(b => b.slug === s.branch);
              const c = COLOR_MAP[bc?.color || 'slate'] || COLOR_MAP.slate;
              return (
                <div key={i} className={`rounded-xl border p-4 transition ${s.branch ? c.border + ' ' + c.bg : 'border-slate-200 bg-slate-50'}`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <TableCellsIcon className={`h-5 w-5 shrink-0 ${s.branch ? c.text : 'text-slate-400'}`} />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{s.name}</p>
                        <p className="text-xs text-slate-500">{s.rows.length} rijen · {s.headers.length} kolommen</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={s.branch}
                        onChange={e => updateSheetBranch(i, e.target.value)}
                        className={`rounded-lg border px-3 py-2 text-sm sm:w-48 ${s.branch ? c.border + ' ' + c.bg + ' ' + c.text + ' font-medium' : 'border-slate-200 bg-white text-slate-500'}`}
                      >
                        <option value="">— Overslaan —</option>
                        {branches.filter(b => b.is_active).map(b => <option key={b.slug} value={b.slug}>{b.name}</option>)}
                      </select>
                    </div>
                  </div>
                  {s.branch && (
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {s.headers.slice(0, 8).map(h => (
                        <span key={h} className="rounded bg-white/60 px-2 py-0.5 text-[10px] font-medium text-slate-500">{h}</span>
                      ))}
                      {s.headers.length > 8 && <span className="px-2 py-0.5 text-[10px] text-slate-400">+{s.headers.length - 8} meer</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex gap-3">
            <button onClick={reset} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Terug</button>
            <button
              onClick={goToMapping}
              disabled={!canGoToMapping}
              className="rounded-lg bg-button-gradient px-5 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-50"
            >
              Volgende: Mapping <ArrowRightIcon className="ml-1 inline h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 3: Mapping ─────────────────────────────────────── */}
      {step === 'mapping' && currentMappingSheet && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          {/* Tab navigation */}
          {mappingActiveSheets.length > 1 && (
            <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-100 px-4 pt-3">
              {mappingActiveSheets.map((s, i) => {
                const bc = branches.find(b => b.slug === s.branch);
                const hasMapped = Object.values(s.mapping).includes('naam_klant');
                return (
                  <button
                    key={i}
                    onClick={() => setActiveTab(i)}
                    className={`flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-xs font-medium transition ${i === activeTab ? 'border-b-2 border-brand-purple bg-brand-purple/5 text-brand-purple' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
                  >
                    {hasMapped ? <CheckIcon className="h-3.5 w-3.5 text-emerald-500" /> : <ExclamationCircleIcon className="h-3.5 w-3.5 text-amber-500" />}
                    {s.name}
                    <span className="text-[10px] text-slate-400">({bc?.name})</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">Kolommen koppelen — {currentMappingSheet.name}</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {currentMappingSheet.rows.length} rijen · Branche: {branches.find(b => b.slug === currentMappingSheet.branch)?.name}
                </p>
              </div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                {Object.keys(currentMappingSheet.mapping).length} gekoppeld
              </span>
            </div>

            {/* Mapping rows */}
            <div className="space-y-2">
              {currentMappingSheet.headers.map(header => {
                const crmField = currentMappingSheet.mapping[header] || '';
                const sampleVal = currentMappingSheet.rows.slice(0, 3).map(r => String(r[header] || '')).filter(Boolean).join(', ');
                const fields = getCrmFields(currentMappingSheet.branch);
                return (
                  <div key={header} className="flex flex-col gap-2 rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-3 sm:flex-row sm:items-center sm:gap-3 sm:py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-700">{header}</p>
                      {sampleVal && <p className="truncate text-[11px] text-slate-400">{sampleVal}</p>}
                    </div>
                    <ArrowRightIcon className="hidden h-4 w-4 shrink-0 text-slate-300 sm:block" />
                    <select
                      value={crmField}
                      onChange={e => updateMapping(sheets.indexOf(currentMappingSheet), header, e.target.value)}
                      className={`w-full rounded-lg border px-3 py-2.5 text-sm sm:w-48 sm:shrink-0 sm:py-1.5 ${crmField ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500'}`}
                    >
                      <option value="">— Overslaan —</option>
                      {fields.map(f => (
                        <option
                          key={f.key}
                          value={f.key}
                          disabled={Object.values(currentMappingSheet.mapping).includes(f.key) && crmField !== f.key}
                        >
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>

            {/* Preview table */}
            <div className="mt-5">
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <EyeIcon className="h-3.5 w-3.5" /> Preview (eerste 5 rijen)
              </h3>
              <div className="overflow-x-auto rounded-lg border border-slate-100">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b bg-slate-50 text-slate-500">
                      <th className="px-2.5 py-2">Status</th>
                      {Object.entries(currentMappingSheet.mapping).map(([, f]) => (
                        <th key={f} className="whitespace-nowrap px-2.5 py-2">
                          {getCrmFields(currentMappingSheet.branch).find(c => c.key === f)?.label || f}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {currentMappingSheet.rows.slice(0, 5).map((row, i) => {
                      const mapped = mapRow(row, currentMappingSheet.mapping);
                      const validity = isValidRow(mapped);
                      return (
                        <tr key={i} className={`border-b border-slate-50 ${validity !== 'valid' ? 'bg-red-50/50' : ''}`}>
                          <td className="px-2.5 py-2">
                            {validity === 'valid'
                              ? <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
                              : <MinusCircleIcon className="h-4 w-4 text-red-400" />
                            }
                          </td>
                          {Object.entries(currentMappingSheet.mapping).map(([, f]) => (
                            <td key={f} className="max-w-[150px] truncate whitespace-nowrap px-2.5 py-2 text-slate-700">{mapped[f] || '—'}</td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Navigation */}
            <div className="mt-6 flex items-center justify-between">
              <div className="flex gap-3">
                <button onClick={() => setStep('tabs')} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
                  <ChevronLeftIcon className="mr-1 inline h-3.5 w-3.5" /> Tabbladen
                </button>
                {mappingActiveSheets.length > 1 && activeTab > 0 && (
                  <button onClick={() => setActiveTab(activeTab - 1)} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
                    <ChevronLeftIcon className="mr-1 inline h-3.5 w-3.5" /> Vorig tabblad
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                {mappingActiveSheets.length > 1 && activeTab < mappingActiveSheets.length - 1 ? (
                  <button onClick={() => setActiveTab(activeTab + 1)} className="rounded-lg bg-button-gradient px-5 py-2.5 text-sm font-bold text-white shadow-sm">
                    Volgend tabblad <ChevronRightIcon className="ml-1 inline h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={runImport}
                    disabled={!allMapped}
                    className="rounded-lg bg-button-gradient px-5 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-50"
                  >
                    {activeSheets.reduce((s, sh) => s + sh.rows.length, 0)} leads importeren <ArrowRightIcon className="ml-1 inline h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Step 4: Importing ───────────────────────────────────── */}
      {step === 'importing' && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mx-auto max-w-md text-center">
            <ArrowPathIcon className="mx-auto mb-4 h-10 w-10 animate-spin text-brand-purple" />
            <h2 className="text-lg font-bold text-slate-900">Importeren...</h2>
            <p className="mt-1 text-sm text-slate-500">Tabblad: {progress.label}</p>

            <div className="mt-6">
              <div className="mb-2 flex justify-between text-xs text-slate-500">
                <span>{progress.current} / {progress.total} rijen</span>
                <span>{progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-brand-purple to-brand-pink"
                  animate={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Step 5: Done ────────────────────────────────────────── */}
      {step === 'done' && results.length > 0 && (
        <div className="space-y-4">
          {/* Summary card */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm text-center">
            {results.every(r => r.errors === 0) ? (
              <CheckCircleIcon className="mx-auto mb-3 h-12 w-12 text-emerald-500" />
            ) : (
              <ExclamationTriangleIcon className="mx-auto mb-3 h-12 w-12 text-amber-500" />
            )}
            <h2 className="text-lg font-bold text-slate-900">Import voltooid</h2>
            <p className="mt-1 text-sm text-slate-500">{results.length} tabblad{results.length !== 1 ? 'en' : ''} verwerkt</p>

            <div className="mx-auto mt-5 grid max-w-lg grid-cols-4 gap-3">
              <div className="rounded-lg bg-emerald-50 px-3 py-3">
                <p className="text-xl font-bold text-emerald-700">{results.reduce((s, r) => s + r.imported, 0)}</p>
                <p className="text-[11px] text-emerald-600">geïmporteerd</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-3">
                <p className="text-xl font-bold text-slate-500">{results.reduce((s, r) => s + r.skipped, 0)}</p>
                <p className="text-[11px] text-slate-400">overgeslagen</p>
              </div>
              <div className="rounded-lg bg-amber-50 px-3 py-3">
                <p className="text-xl font-bold text-amber-600">{results.reduce((s, r) => s + r.duplicates, 0)}</p>
                <p className="text-[11px] text-amber-500">duplicaten</p>
              </div>
              <div className="rounded-lg bg-red-50 px-3 py-3">
                <p className="text-xl font-bold text-red-500">{results.reduce((s, r) => s + r.errors, 0)}</p>
                <p className="text-[11px] text-red-400">fouten</p>
              </div>
            </div>
          </div>

          {/* Per-tab details */}
          {results.map((r, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{r.sheetName}</p>
                  <p className="text-xs text-slate-500">{r.branch}</p>
                </div>
                <div className="flex gap-4 text-xs">
                  <span className="text-emerald-600 font-medium">{r.imported} geïmporteerd</span>
                  {r.duplicates > 0 && <span className="text-amber-600">{r.duplicates} dubbel</span>}
                  {r.skipped > 0 && <span className="text-slate-400">{r.skipped} overgeslagen</span>}
                  {r.errors > 0 && <span className="text-red-500">{r.errors} fouten</span>}
                </div>
              </div>
              {r.errorDetails.length > 0 && (
                <div className="mt-3 rounded-lg bg-red-50 border border-red-100 px-3 py-2">
                  {r.errorDetails.map((e, j) => <p key={j} className="text-xs text-red-600">{e}</p>)}
                </div>
              )}
            </div>
          ))}

          {/* Actions */}
          <div className="flex justify-center gap-3 pt-2">
            <button onClick={reset} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Opnieuw importeren
            </button>
            <a href="/admin/leads" className="rounded-lg bg-button-gradient px-5 py-2.5 text-sm font-bold text-white shadow-sm">
              Bekijk leads
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
