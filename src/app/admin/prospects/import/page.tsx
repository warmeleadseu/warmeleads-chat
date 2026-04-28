'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  DocumentArrowUpIcon,
  ExclamationTriangleIcon,
  TableCellsIcon,
  ChevronDownIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';
import { useAdmin } from '../../adminContext';
import type { AdminUserOption } from '../_components/ProspectDrawer';

type Step = 'upload' | 'map' | 'preview' | 'assign' | 'done';

const TARGET_FIELDS: ReadonlyArray<{ key: string; label: string; required?: boolean }> = [
  { key: 'company_name', label: 'Bedrijfsnaam', required: true },
  { key: 'contact_person', label: 'Contactpersoon' },
  { key: 'email', label: 'E-mail' },
  { key: 'phone', label: 'Telefoon' },
  { key: 'website', label: 'Website' },
  { key: 'kvk_nummer', label: 'KVK-nummer' },
  { key: 'vat_id', label: 'BTW / RSIN' },
  { key: 'address', label: 'Adres (straat + nr)' },
  { key: 'postcode', label: 'Postcode' },
  { key: 'city', label: 'Plaats' },
  { key: 'country', label: 'Land' },
  { key: 'branches', label: 'Branches (komma-gescheiden)' },
  { key: 'company_size', label: 'Bedrijfsgrootte' },
  { key: 'notes', label: 'Notities' },
];

type TargetKey =
  | 'company_name'
  | 'contact_person'
  | 'email'
  | 'phone'
  | 'website'
  | 'kvk_nummer'
  | 'vat_id'
  | 'address'
  | 'postcode'
  | 'city'
  | 'country'
  | 'branches'
  | 'company_size'
  | 'notes';

const ALIASES: Record<TargetKey, string[]> = {
  company_name: ['bedrijfsnaam', 'bedrijf', 'company', 'companyname', 'firmanaam', 'klantnaam', 'naambedrijf'],
  contact_person: ['contactpersoon', 'contact', 'naam', 'voornaamachternaam', 'volledigenaam'],
  email: ['email', 'emailadres', 'e-mail', 'mail'],
  phone: ['telefoon', 'telefoonnummer', 'tel', 'phone', 'mobiel', 'gsm'],
  website: ['website', 'site', 'url', 'web'],
  kvk_nummer: ['kvk', 'kvknummer', 'kvk-nummer', 'kamervankoophandel'],
  vat_id: ['btw', 'vat', 'btwnummer', 'rsin'],
  address: ['adres', 'straat', 'address', 'huisnummer'],
  postcode: ['postcode', 'zip', 'pc'],
  city: ['plaats', 'stad', 'city', 'woonplaats', 'gemeente'],
  country: ['land', 'country'],
  branches: ['branches', 'branche', 'interesse', 'productinteresse', 'branchen'],
  company_size: ['grootte', 'bedrijfsgrootte', 'size', 'fte'],
  notes: ['opmerking', 'opmerkingen', 'notities', 'notes', 'toelichting'],
};

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function autoMap(headers: string[]): Record<string, TargetKey | ''> {
  const result: Record<string, TargetKey | ''> = {};
  const used = new Set<TargetKey>();
  for (const h of headers) {
    const nh = normalize(h);
    let best: { key: TargetKey; score: number } | null = null;
    for (const t of TARGET_FIELDS) {
      const key = t.key as TargetKey;
      if (used.has(key)) continue;
      const aliases = [normalize(t.label), normalize(t.key), ...(ALIASES[key] || []).map(normalize)];
      let score = 0;
      for (const a of aliases) {
        if (!a) continue;
        if (nh === a) score = Math.max(score, 100);
        else if (nh.includes(a) && a.length >= 3) score = Math.max(score, 50 + a.length);
        else if (a.includes(nh) && nh.length >= 3) score = Math.max(score, 30 + nh.length);
      }
      if (score > 0 && (!best || score > best.score)) best = { key, score };
    }
    if (best) {
      result[h] = best.key;
      used.add(best.key);
    } else {
      result[h] = '';
    }
  }
  return result;
}

interface ParsedRow {
  [header: string]: unknown;
}

interface DupeCheck {
  duplicate_kvk_nummers: string[];
  duplicate_emails: string[];
}

export default function ProspectsImportPage() {
  const { user } = useAdmin();
  const router = useRouter();
  const canImport = user.role === 'admin' || user.role === 'superadmin';

  const [step, setStep] = useState<Step>('upload');
  const [filename, setFilename] = useState('');
  const [format, setFormat] = useState<'csv' | 'xlsx'>('xlsx');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, TargetKey | ''>>({});
  const [parsing, setParsing] = useState(false);
  const [dupes, setDupes] = useState<DupeCheck | null>(null);
  const [strategy, setStrategy] = useState<'manual' | 'specific_am' | 'round_robin'>('manual');
  const [amId, setAmId] = useState<string>('');
  const [poolIds, setPoolIds] = useState<Set<string>>(new Set());
  const [ams, setAms] = useState<AdminUserOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ imported: number; duplicates: number; errors_count: number; total: number } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    adminFetch('/api/admin/account-managers')
      .then(r => r.json())
      .then(d =>
        setAms(
          (d.account_managers || []).map((a: { id: string; name: string }) => ({ id: a.id, name: a.name })),
        ),
      )
      .catch(() => {});
  }, []);

  const onFile = useCallback(async (file: File) => {
    setParsing(true);
    try {
      const ext = file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'xlsx';
      setFormat(ext);
      setFilename(file.name);
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      const hdrs = json.length > 0 ? Object.keys(json[0]) : [];
      setHeaders(hdrs);
      setRows(json);
      setMapping(autoMap(hdrs));
      setStep('map');
    } finally {
      setParsing(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file) onFile(file);
    },
    [onFile],
  );

  // Bouw mapped rijen voor preview en import
  const mapped = useMemo(() => {
    return rows.map(r => {
      const out: Record<string, unknown> = {};
      for (const [hdr, target] of Object.entries(mapping)) {
        if (!target) continue;
        out[target] = r[hdr];
      }
      return out;
    });
  }, [rows, mapping]);

  const validation = useMemo(() => {
    let valid = 0;
    let missingName = 0;
    let invalidEmail = 0;
    let invalidKvk = 0;
    for (const m of mapped) {
      const name = typeof m.company_name === 'string' ? m.company_name.trim() : '';
      if (!name) {
        missingName += 1;
        continue;
      }
      if (m.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(m.email))) {
        invalidEmail += 1;
      }
      if (m.kvk_nummer && String(m.kvk_nummer).replace(/\D/g, '').length !== 8) {
        invalidKvk += 1;
      }
      valid += 1;
    }
    return { valid, missingName, invalidEmail, invalidKvk };
  }, [mapped]);

  const goPreview = async () => {
    if (!mapping || Object.values(mapping).every(v => v !== 'company_name')) {
      alert('Map minimaal "Bedrijfsnaam"');
      return;
    }
    setStep('preview');
    // Run dedupe check
    try {
      const kvks = mapped
        .map(m => (m.kvk_nummer ? String(m.kvk_nummer).replace(/\D/g, '') : ''))
        .filter(s => s.length === 8);
      const emails = mapped
        .map(m => (m.email ? String(m.email).toLowerCase() : ''))
        .filter(s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
      const res = await adminFetch('/api/admin/prospects/import', {
        method: 'PUT',
        body: JSON.stringify({ kvk_nummers: kvks, emails }),
      });
      const data = await res.json();
      if (res.ok) setDupes(data);
    } catch {
      /* niet kritiek */
    }
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        filename,
        format,
        rows: mapped,
        column_mapping: mapping,
        assignment_strategy: strategy,
      };
      if (strategy === 'specific_am') body.account_manager_id = amId;
      if (strategy === 'round_robin') body.account_manager_ids = Array.from(poolIds);

      const res = await adminFetch('/api/admin/prospects/import', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({
          imported: data.imported,
          duplicates: data.duplicates,
          errors_count: data.errors_count,
          total: data.total,
        });
        setStep('done');
      } else {
        alert(data.error || 'Import mislukt');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!canImport) {
    return (
      <div className="px-6 py-10 text-center text-slate-500">
        Importeren is alleen beschikbaar voor admins.
      </div>
    );
  }

  const dupeKvkSet = new Set(dupes?.duplicate_kvk_nummers || []);
  const dupeEmailSet = new Set(dupes?.duplicate_emails || []);

  return (
    <div className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/prospects" className="text-xs text-slate-500 hover:text-slate-700">
            <ArrowLeftIcon className="mr-1 inline h-3 w-3" />
            Terug naar prospects
          </Link>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-slate-900">
            <ArrowDownTrayIcon className="h-7 w-7 text-brand-purple" />
            Prospects importeren
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Excel of CSV uploaden, kolommen koppelen en in 1 klik importeren in de prospect-pijplijn.
          </p>
        </div>
        <Stepper step={step} />
      </div>

      {step === 'upload' && (
        <div
          className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-12 text-center"
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
        >
          <DocumentArrowUpIcon className="mx-auto h-12 w-12 text-slate-300" />
          <h2 className="mt-3 text-base font-semibold text-slate-700">Sleep een Excel of CSV hierheen</h2>
          <p className="mt-1 text-sm text-slate-500">
            Of klik op de knop om een bestand te kiezen. Eerste sheet wordt gebruikt.
          </p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={parsing}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-purple/90 disabled:opacity-50"
          >
            <DocumentArrowUpIcon className="h-4 w-4" />
            {parsing ? 'Verwerken...' : 'Bestand kiezen'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
            className="hidden"
          />
        </div>
      )}

      {step === 'map' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">
              <TableCellsIcon className="h-5 w-5 text-brand-purple" />
              Kolommen koppelen
            </h2>
            <span className="text-xs text-slate-500">{rows.length} rijen, {headers.length} kolommen</span>
          </div>
          <p className="mb-4 text-sm text-slate-500">
            Koppel de kolommen uit jouw bestand aan de juiste prospect-velden. Bedrijfsnaam is verplicht.
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            {headers.map(h => (
              <div key={h} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/40 p-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700">{h}</p>
                  <p className="truncate text-[11px] text-slate-400">
                    {(rows[0]?.[h] !== undefined && rows[0]?.[h] !== '') ? String(rows[0][h]).slice(0, 80) : 'leeg'}
                  </p>
                </div>
                <ArrowRightIcon className="h-3 w-3 text-slate-300" />
                <select
                  value={mapping[h] || ''}
                  onChange={e => setMapping(prev => ({ ...prev, [h]: e.target.value as TargetKey | '' }))}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-brand-purple/50"
                >
                  <option value="">— Niet importeren —</option>
                  {TARGET_FIELDS.map(t => (
                    <option key={t.key} value={t.key}>
                      {t.label}{t.required ? ' *' : ''}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="mt-5 flex justify-between">
            <button
              type="button"
              onClick={() => setStep('upload')}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Terug
            </button>
            <button
              type="button"
              onClick={goPreview}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-white hover:bg-brand-purple/90"
            >
              Voorbeeld bekijken
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Stat label="Te importeren" value={validation.valid - dupeKvkSet.size - dupeEmailSet.size} accent="bg-emerald-50 text-emerald-700" />
            <Stat label="Duplicaten" value={dupeKvkSet.size + dupeEmailSet.size} accent="bg-amber-50 text-amber-700" />
            <Stat label="Validatie-fouten" value={validation.missingName} accent="bg-rose-50 text-rose-700" />
            <Stat label="Totaal" value={rows.length} accent="bg-slate-50 text-slate-700" />
          </div>

          {(validation.missingName > 0 || dupes) && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <h3 className="flex items-center gap-1.5 font-semibold">
                <ExclamationTriangleIcon className="h-4 w-4" />
                Aandachtspunten
              </h3>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
                {validation.missingName > 0 && <li>{validation.missingName} rijen zonder bedrijfsnaam worden overgeslagen.</li>}
                {dupeKvkSet.size > 0 && <li>{dupeKvkSet.size} KVK-nummers zijn al bekend (in prospects of klanten) en worden overgeslagen.</li>}
                {dupeEmailSet.size > 0 && <li>{dupeEmailSet.size} e-mailadressen zijn al bekend en worden overgeslagen.</li>}
                {validation.invalidEmail > 0 && <li>{validation.invalidEmail} ongeldige e-mailadressen worden niet meegenomen.</li>}
                {validation.invalidKvk > 0 && <li>{validation.invalidKvk} ongeldige KVK-nummers worden genegeerd (alleen 8 cijfers).</li>}
              </ul>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Voorbeeld (eerste 10 rijen)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Bedrijfsnaam</th>
                    <th className="px-3 py-2 text-left">KVK</th>
                    <th className="px-3 py-2 text-left">Contact</th>
                    <th className="px-3 py-2 text-left">E-mail</th>
                    <th className="px-3 py-2 text-left">Plaats</th>
                    <th className="px-3 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mapped.slice(0, 10).map((r, idx) => {
                    const name = String(r.company_name || '').trim();
                    const kvk = r.kvk_nummer ? String(r.kvk_nummer).replace(/\D/g, '') : '';
                    const email = r.email ? String(r.email).toLowerCase() : '';
                    const issue =
                      !name
                        ? { txt: 'Geen naam', cls: 'bg-rose-50 text-rose-700' }
                        : kvk && dupeKvkSet.has(kvk)
                          ? { txt: 'KVK duplicaat', cls: 'bg-amber-50 text-amber-700' }
                          : email && dupeEmailSet.has(email)
                            ? { txt: 'E-mail duplicaat', cls: 'bg-amber-50 text-amber-700' }
                            : { txt: 'OK', cls: 'bg-emerald-50 text-emerald-700' };
                    return (
                      <tr key={idx}>
                        <td className="px-3 py-2 text-slate-400">{idx + 1}</td>
                        <td className="px-3 py-2 font-medium text-slate-800">{name || <span className="text-rose-500">—</span>}</td>
                        <td className="px-3 py-2 font-mono text-slate-500">{kvk || ''}</td>
                        <td className="px-3 py-2 text-slate-600">{(r.contact_person as string) || ''}</td>
                        <td className="px-3 py-2 text-slate-500">{email}</td>
                        <td className="px-3 py-2 text-slate-500">{(r.city as string) || ''}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${issue.cls}`}>{issue.txt}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setStep('map')}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Terug
            </button>
            <button
              type="button"
              onClick={() => setStep('assign')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-white hover:bg-brand-purple/90"
            >
              Toewijzing
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {step === 'assign' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-800">Toewijzing</h2>
          <p className="mt-1 text-sm text-slate-500">
            Wijs deze prospects direct toe aan een AM, of laat ze ongekoppeld voor handmatige verdeling.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {([
              { id: 'manual', label: 'Niet toewijzen', sub: 'Handmatig later toewijzen' },
              { id: 'specific_am', label: 'Eén AM', sub: 'Allemaal aan dezelfde persoon' },
              { id: 'round_robin', label: 'Round-robin', sub: 'Verdeel gelijkmatig over een pool' },
            ] as { id: typeof strategy; label: string; sub: string }[]).map(o => (
              <button
                key={o.id}
                type="button"
                onClick={() => setStrategy(o.id)}
                className={`rounded-xl border p-3 text-left ${
                  strategy === o.id
                    ? 'border-brand-purple bg-brand-purple/5'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <p className={`text-sm font-semibold ${strategy === o.id ? 'text-brand-purple' : 'text-slate-700'}`}>{o.label}</p>
                <p className="mt-0.5 text-xs text-slate-500">{o.sub}</p>
              </button>
            ))}
          </div>

          {strategy === 'specific_am' && (
            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-slate-500">Account manager</label>
              <select
                value={amId}
                onChange={e => setAmId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-purple/50"
              >
                <option value="">— Kies AM —</option>
                {ams.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}

          {strategy === 'round_robin' && (
            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-slate-500">
                AM-pool ({poolIds.size} geselecteerd)
              </label>
              <div className="grid max-h-60 grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2 sm:grid-cols-2">
                {ams.map(a => {
                  const checked = poolIds.has(a.id);
                  return (
                    <label key={a.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setPoolIds(prev => {
                            const n = new Set(prev);
                            if (n.has(a.id)) n.delete(a.id);
                            else n.add(a.id);
                            return n;
                          });
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-brand-purple focus:ring-brand-purple"
                      />
                      <span className="text-sm text-slate-800">{a.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-between border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setStep('preview')}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Terug
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={
                submitting ||
                (strategy === 'specific_am' && !amId) ||
                (strategy === 'round_robin' && poolIds.size === 0) ||
                validation.valid - dupeKvkSet.size - dupeEmailSet.size <= 0
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-purple px-5 py-2 text-sm font-semibold text-white hover:bg-brand-purple/90 disabled:opacity-50"
            >
              <CheckIcon className="h-4 w-4" />
              {submitting
                ? 'Bezig...'
                : `Importeer ${Math.max(0, validation.valid - dupeKvkSet.size - dupeEmailSet.size)} prospects`}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && result && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
          <CheckCircleIcon className="mx-auto h-12 w-12 text-emerald-600" />
          <h2 className="mt-3 text-lg font-bold text-emerald-900">Import afgerond</h2>
          <p className="mt-1 text-sm text-emerald-800">
            {result.imported} prospects toegevoegd. {result.duplicates} duplicaten en {result.errors_count} foutieve rijen overgeslagen.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => router.push('/admin/prospects')}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Naar prospects
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('upload');
                setRows([]);
                setHeaders([]);
                setMapping({});
                setDupes(null);
                setResult(null);
              }}
              className="rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
            >
              Nog een import doen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: 'upload', label: 'Upload' },
    { id: 'map', label: 'Mapping' },
    { id: 'preview', label: 'Preview' },
    { id: 'assign', label: 'Toewijzen' },
    { id: 'done', label: 'Klaar' },
  ];
  const idx = steps.findIndex(s => s.id === step);
  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-500">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center gap-1.5">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
              i < idx ? 'bg-emerald-500 text-white' : i === idx ? 'bg-brand-purple text-white' : 'bg-slate-200 text-slate-500'
            }`}
          >
            {i < idx ? <CheckIcon className="h-3 w-3" /> : i + 1}
          </span>
          <span className={i === idx ? 'font-semibold text-slate-700' : ''}>{s.label}</span>
          {i < steps.length - 1 && <ChevronDownIcon className="-rotate-90 text-slate-300 h-3 w-3" />}
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className={`mb-1 inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${accent}`}>
        {label}
      </div>
      <div className="text-xl font-bold text-slate-900">{value}</div>
    </div>
  );
}
