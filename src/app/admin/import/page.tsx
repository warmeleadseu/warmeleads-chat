'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DocumentArrowUpIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';

interface Customer { id: string; name: string; }

const COMMON_FIELDS = [
  { key: 'naam_klant', label: 'Naam klant', required: true },
  { key: 'email', label: 'E-mail' },
  { key: 'telefoonnummer', label: 'Telefoon' },
  { key: 'postcode', label: 'Postcode' },
  { key: 'huisnummer', label: 'Huisnummer' },
  { key: 'plaatsnaam', label: 'Plaatsnaam' },
  { key: 'provincie', label: 'Provincie' },
  { key: 'wervingsdatum', label: 'Wervingsdatum' },
  { key: 'notities', label: 'Notities' },
];
const THUISBATTERIJ_FIELDS = [
  { key: 'zonnepanelen', label: 'Zonnepanelen' },
  { key: 'dynamisch_contract', label: 'Dynamisch contract' },
  { key: 'stroomverbruik', label: 'Stroomverbruik' },
  { key: 'budget', label: 'Budget' },
  { key: 'reden_thuisbatterij', label: 'Reden thuisbatterij' },
];
const AIRCO_FIELDS = [
  { key: 'type_airco', label: 'Type airco' },
  { key: 'koelen_verwarmen', label: 'Koelen/Verwarmen' },
  { key: 'hoeveel_ruimtes', label: 'Hoeveel ruimtes' },
  { key: 'zakelijk', label: 'Zakelijk' },
  { key: 'koop_of_huur', label: 'Koop of huur' },
  { key: 'boorwerkzaamheden_toegestaan', label: 'Boorwerk toegestaan' },
];

type Step = 'upload' | 'mapping' | 'preview' | 'result';

export default function ImportPage() {
  const [step, setStep] = useState<Step>('upload');
  const [branch, setBranch] = useState('thuisbatterij');
  const [customerId, setCustomerId] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [fileName, setFileName] = useState('');
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [excelData, setExcelData] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; skipped: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    adminFetch('/api/admin/customers').then(r => r.json()).then(d => setCustomers(d.customers || []));
  }, []);

  const crmFields = [...COMMON_FIELDS, ...(branch === 'thuisbatterij' ? THUISBATTERIJ_FIELDS : AIRCO_FIELDS)];

  const autoMap = (headers: string[]) => {
    const m: Record<string, string> = {};
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const aliases: Record<string, string[]> = {
      naam_klant: ['naam', 'name', 'naamklant', 'klantnaam', 'volledinenaam', 'naambewoner'],
      email: ['email', 'emailadres', 'emal', 'mailadres', 'mail'],
      telefoonnummer: ['telefoon', 'telefoonnummer', 'tel', 'phone', 'mobiel', 'gsm'],
      postcode: ['postcode', 'pc', 'zip', 'postal'],
      huisnummer: ['huisnummer', 'huisnr', 'nummer', 'nr'],
      plaatsnaam: ['plaats', 'plaatsnaam', 'woonplaats', 'stad', 'city'],
      provincie: ['provincie', 'province'],
      wervingsdatum: ['datum', 'wervingsdatum', 'date', 'aanvraagdatum', 'invuldatum'],
      notities: ['notities', 'opmerkingen', 'notes', 'opmerking'],
      zonnepanelen: ['zonnepanelen', 'panelen', 'solar'],
      dynamisch_contract: ['dynamischcontract', 'dynamisch', 'contract'],
      stroomverbruik: ['stroomverbruik', 'verbruik', 'kwh'],
      budget: ['budget'],
      reden_thuisbatterij: ['reden', 'redenthuisbatterij', 'motivatie'],
      type_airco: ['typeairco', 'type', 'aircotype'],
      koelen_verwarmen: ['koelenverwarmen', 'koelen', 'verwarmen'],
      hoeveel_ruimtes: ['hoeveelruimtes', 'ruimtes', 'aantalruimtes', 'kamers'],
      zakelijk: ['zakelijk', 'business', 'bedrijf'],
      koop_of_huur: ['koopofhuur', 'koop', 'huur', 'koophuur'],
      boorwerkzaamheden_toegestaan: ['boorwerkzaamheden', 'boorwerk', 'boren'],
    };
    for (const header of headers) {
      const norm = normalize(header);
      for (const [field, alts] of Object.entries(aliases)) {
        if (alts.some(a => norm.includes(a) || a.includes(norm))) {
          if (!Object.values(m).includes(field)) {
            m[header] = field;
            break;
          }
        }
      }
    }
    return m;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const XLSX = await import('xlsx');
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

    if (json.length === 0) return;

    const headers = Object.keys(json[0]);
    setExcelHeaders(headers);
    setExcelData(json);
    setMapping(autoMap(headers));
    setStep('mapping');
  };

  const setMap = (excelCol: string, crmField: string) => {
    setMapping(prev => {
      const next = { ...prev };
      if (crmField === '') { delete next[excelCol]; }
      else {
        for (const k of Object.keys(next)) { if (next[k] === crmField) delete next[k]; }
        next[excelCol] = crmField;
      }
      return next;
    });
  };

  const mappedData = excelData.map(row => {
    const lead: Record<string, any> = { branch, customer_id: customerId || null, bron: 'excel_import', status: 'nieuw' };
    for (const [excelCol, crmField] of Object.entries(mapping)) {
      if (row[excelCol] !== undefined && row[excelCol] !== '') {
        lead[crmField] = String(row[excelCol]);
      }
    }
    return lead;
  });

  const validRows = mappedData.filter(r => r.naam_klant && String(r.naam_klant).trim() !== '');

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    try {
      const BATCH_SIZE = 200;
      let success = 0;
      let errors: string[] = [];
      for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
        const batch = validRows.slice(i, i + BATCH_SIZE);
        const res = await adminFetch('/api/admin/leads', { method: 'POST', body: JSON.stringify({ leads: batch }) });
        if (res.ok) { const d = await res.json(); success += d.count || batch.length; }
        else { const d = await res.json(); errors.push(d.error || `Batch ${i / BATCH_SIZE + 1} mislukt`); }
      }
      setResult({ success, skipped: excelData.length - validRows.length, errors });
      setStep('result');
    } catch (err: any) {
      setResult({ success: 0, skipped: 0, errors: [err.message] });
      setStep('result');
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setStep('upload');
    setFileName('');
    setExcelHeaders([]);
    setExcelData([]);
    setMapping({});
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-slate-900 sm:text-2xl">Leads importeren</h1>
      <p className="mb-6 text-sm text-slate-500">Upload een Excel of CSV bestand en koppel de kolommen aan het CRM.</p>

      {/* Steps indicator */}
      <div className="mb-8 flex items-center gap-2 text-xs font-medium">
        {(['upload', 'mapping', 'preview', 'result'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <div className="h-px w-6 bg-slate-200" />}
            <span className={`rounded-full px-3 py-1 ${step === s ? 'bg-brand-purple text-white' : 'bg-slate-100 text-slate-400'}`}>
              {i + 1}. {s === 'upload' ? 'Upload' : s === 'mapping' ? 'Koppelen' : s === 'preview' ? 'Controleer' : 'Resultaat'}
            </span>
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Branche</label>
              <select value={branch} onChange={e => setBranch(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm">
                <option value="thuisbatterij">Thuisbatterij</option>
                <option value="airco">Airco</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Klant (bedrijf)</label>
              <select value={customerId} onChange={e => setCustomerId(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm">
                <option value="">— Geen specifieke klant —</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 transition hover:border-brand-purple/30 hover:bg-brand-purple/[0.02]">
            <DocumentArrowUpIcon className="mb-3 h-10 w-10 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">Klik om een bestand te selecteren</p>
            <p className="mt-1 text-xs text-slate-400">Excel (.xlsx, .xls) of CSV</p>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      )}

      {/* Step 2: Column Mapping */}
      {step === 'mapping' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Kolommen koppelen</h2>
              <p className="text-xs text-slate-500 mt-0.5">{fileName} — {excelData.length} rijen gevonden, {excelHeaders.length} kolommen</p>
            </div>
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
              {Object.keys(mapping).length} gekoppeld
            </span>
          </div>

          <div className="space-y-2">
            {excelHeaders.map(header => (
              <div key={header} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{header}</span>
                <ArrowRightIcon className="h-4 w-4 shrink-0 text-slate-300" />
                <select
                  value={mapping[header] || ''}
                  onChange={e => setMap(header, e.target.value)}
                  className={`w-48 shrink-0 rounded-lg border px-3 py-1.5 text-sm ${mapping[header] ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500'}`}
                >
                  <option value="">— Overslaan —</option>
                  {crmFields.map(f => (
                    <option key={f.key} value={f.key} disabled={Object.values(mapping).includes(f.key) && mapping[header] !== f.key}>
                      {f.label}{f.required ? ' *' : ''}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="mt-6 flex gap-3">
            <button onClick={reset} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Terug</button>
            <button
              onClick={() => setStep('preview')}
              disabled={!Object.values(mapping).includes('naam_klant')}
              className="rounded-lg bg-button-gradient px-5 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-50"
            >
              Volgende: Preview
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 'preview' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="font-semibold text-slate-900">Preview</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {validRows.length} geldige leads van {excelData.length} rijen.
              {excelData.length - validRows.length > 0 && ` ${excelData.length - validRows.length} worden overgeslagen (geen naam).`}
            </p>
          </div>

          <div className="mb-4 overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-xs text-slate-500">
                  <th className="px-3 py-2">#</th>
                  {Object.values(mapping).map(f => <th key={f} className="whitespace-nowrap px-3 py-2">{crmFields.find(c => c.key === f)?.label || f}</th>)}
                </tr>
              </thead>
              <tbody>
                {validRows.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="px-3 py-2 text-xs text-slate-400">{i + 1}</td>
                    {Object.values(mapping).map(f => (
                      <td key={f} className="whitespace-nowrap px-3 py-2 text-sm text-slate-700">{row[f] || '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {validRows.length > 5 && <p className="px-3 py-2 text-xs text-slate-400">...en {validRows.length - 5} meer</p>}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('mapping')} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Terug</button>
            <button
              onClick={handleImport}
              disabled={importing}
              className="rounded-lg bg-button-gradient px-5 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-60"
            >
              {importing ? (
                <span className="inline-flex items-center gap-2"><ArrowPathIcon className="h-4 w-4 animate-spin" /> Importeren...</span>
              ) : (
                `${validRows.length} leads importeren`
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Result */}
      {step === 'result' && result && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 text-center">
            {result.errors.length === 0 ? (
              <>
                <CheckCircleIcon className="mx-auto mb-3 h-12 w-12 text-emerald-500" />
                <h2 className="text-lg font-bold text-slate-900">Import voltooid</h2>
              </>
            ) : (
              <>
                <ExclamationTriangleIcon className="mx-auto mb-3 h-12 w-12 text-amber-500" />
                <h2 className="text-lg font-bold text-slate-900">Import gedeeltelijk voltooid</h2>
              </>
            )}
          </div>

          <div className="mx-auto mb-6 grid max-w-sm grid-cols-2 gap-3 text-center">
            <div className="rounded-lg bg-emerald-50 px-4 py-3">
              <p className="text-2xl font-bold text-emerald-700">{result.success}</p>
              <p className="text-xs text-emerald-600">geïmporteerd</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-4 py-3">
              <p className="text-2xl font-bold text-slate-500">{result.skipped}</p>
              <p className="text-xs text-slate-400">overgeslagen</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
              <p className="mb-1 text-sm font-medium text-red-700">Fouten:</p>
              {result.errors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
            </div>
          )}

          <div className="flex justify-center gap-3">
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
