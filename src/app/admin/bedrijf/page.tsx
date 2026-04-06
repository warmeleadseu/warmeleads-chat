'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BuildingOffice2Icon,
  CheckCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';

const FIELDS = [
  { key: 'company_name', label: 'Bedrijfsnaam', placeholder: 'WarmeLeads B.V.' },
  { key: 'company_address', label: 'Adres', placeholder: 'Straatnaam 123' },
  { key: 'company_postcode', label: 'Postcode', placeholder: '1234 AB' },
  { key: 'company_city', label: 'Plaats', placeholder: 'Amsterdam' },
  { key: 'company_kvk', label: 'KvK-nummer', placeholder: '12345678' },
  { key: 'company_btw', label: 'BTW-nummer', placeholder: 'NL123456789B01' },
  { key: 'company_iban', label: 'IBAN', placeholder: 'NL00 BANK 0000 0000 00' },
  { key: 'company_email', label: 'E-mail (facturen)', placeholder: 'info@warmeleads.eu' },
];

export default function BedrijfsgegevensPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/admin/settings');
      if (res.ok) {
        const { settings } = await res.json();
        const vals: Record<string, string> = {};
        for (const f of FIELDS) {
          vals[f.key] = settings[f.key]?.value || '';
        }
        setValues(vals);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      for (const f of FIELDS) {
        await adminFetch('/api/admin/settings', {
          method: 'PUT',
          body: JSON.stringify({ key: f.key, value: values[f.key] || '' }),
        });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      alert('Opslaan mislukt');
    }
    setSaving(false);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <BuildingOffice2Icon className="h-7 w-7 text-brand-purple" />
          Bedrijfsgegevens
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Deze gegevens verschijnen op alle facturen die het systeem genereert.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <ArrowPathIcon className="mr-2 h-5 w-5 animate-spin" /> Laden...
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            {FIELDS.map(f => (
              <div key={f.key} className={f.key === 'company_name' || f.key === 'company_address' ? 'sm:col-span-2' : ''}>
                <label className="mb-1 block text-xs font-medium text-slate-500">{f.label}</label>
                <input
                  value={values[f.key] || ''}
                  onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/20"
                />
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-button-gradient px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:shadow-md disabled:opacity-50"
            >
              {saving ? (
                <><ArrowPathIcon className="h-4 w-4 animate-spin" /> Opslaan...</>
              ) : (
                'Opslaan'
              )}
            </button>
            {saved && (
              <span className="flex items-center gap-1 text-sm font-medium text-emerald-600">
                <CheckCircleIcon className="h-4 w-4" />
                Opgeslagen
              </span>
            )}
          </div>

          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs text-amber-700">
              <strong>Let op:</strong> Zorg dat je KvK-nummer en BTW-nummer correct zijn ingevuld.
              Deze gegevens zijn wettelijk verplicht op facturen.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
