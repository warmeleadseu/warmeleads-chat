'use client';

import { useRef, useState } from 'react';
import {
  MapPinIcon,
  PlusIcon,
  TrashIcon,
  ArrowPathIcon,
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';
import { PROVINCE_OPTIONS_NL, PROVINCE_OPTIONS_BE } from '@/data/provinces';
import { formatProvinceTargetLabel } from '@/lib/provinceTargetMatch';
import type { BatchTargetInsertInput } from '@/lib/batchTargetInsert';

export type BatchTargetDraft = BatchTargetInsertInput & { _key: string };

const COUNTRY_PRESETS: Omit<BatchTargetInsertInput, 'target_type'>[] = [
  { label: 'Heel Nederland', lat: 52.1326, lng: 5.2913, radius_km: 200 },
  { label: 'Heel België', lat: 50.5039, lng: 4.4699, radius_km: 170 },
];

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Targetgebieden kiezen vóór de batch bestaat. De parent slaat drafts op en stuurt
 * ze mee bij POST /api/admin/batches als `batch_targets`.
 */
export default function BatchTargetsDraftEditor({
  targets,
  onChange,
}: {
  targets: BatchTargetDraft[];
  onChange: (targets: BatchTargetDraft[]) => void;
}) {
  const [showAdd, setShowAdd] = useState<false | 'radius' | 'province'>(false);
  const [error, setError] = useState('');

  const [cityQuery, setCityQuery] = useState('');
  const [cityResult, setCityResult] = useState<{ lat: number; lng: number; naam: string } | null>(null);
  const [citySearching, setCitySearching] = useState(false);
  const [cityError, setCityError] = useState('');
  const [newRadius, setNewRadius] = useState(25);
  const [newRadiusCountry, setNewRadiusCountry] = useState<'' | 'NL' | 'BE' | 'BOTH'>('');
  const searchTimer = useRef<NodeJS.Timeout | null>(null);

  const [selectedProvinces, setSelectedProvinces] = useState<string[]>([]);
  const [provLabel, setProvLabel] = useState('');

  const resetAddForm = () => {
    setShowAdd(false);
    setCityQuery('');
    setCityResult(null);
    setCityError('');
    setNewRadius(25);
    setNewRadiusCountry('');
    setSelectedProvinces([]);
    setProvLabel('');
    setError('');
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
      if (res.ok) setCityResult(await res.json());
      else setCityError('Plaats niet gevonden');
      setCitySearching(false);
    }, 500);
  };

  const addDraft = (draft: BatchTargetInsertInput) => {
    onChange([...targets, { ...draft, _key: newKey() }]);
    resetAddForm();
  };

  const addRadiusTarget = () => {
    if (!cityResult || newRadiusCountry === '') return;
    const country = newRadiusCountry === 'BOTH' ? null : newRadiusCountry;
    addDraft({
      label: cityResult.naam,
      target_type: 'radius',
      lat: cityResult.lat,
      lng: cityResult.lng,
      radius_km: newRadius,
      country,
    });
  };

  const addProvinceTarget = () => {
    if (selectedProvinces.length === 0) return;
    const label = provLabel.trim() || selectedProvinces.map(formatProvinceTargetLabel).join(', ');
    addDraft({ label, target_type: 'province', provinces: selectedProvinces });
  };

  const addPreset = (preset: (typeof COUNTRY_PRESETS)[0]) => {
    if (targets.some(t => t.label === preset.label)) return;
    addDraft({
      label: preset.label,
      target_type: 'radius',
      lat: preset.lat,
      lng: preset.lng,
      radius_km: preset.radius_km,
    });
  };

  const removeDraft = (key: string) => {
    onChange(targets.filter(t => t._key !== key));
  };

  const toggleProvince = (prov: string) => {
    setSelectedProvinces(prev =>
      prev.includes(prov) ? prev.filter(p => p !== prov) : [...prev, prov],
    );
  };

  const formatSummary = (t: BatchTargetDraft) => {
    if (t.target_type === 'province' && t.provinces?.length) {
      return t.provinces.map(formatProvinceTargetLabel).join(', ');
    }
    if (t.lat != null && t.lng != null) {
      return `${t.label} (${t.radius_km ?? 25} km)`;
    }
    return t.label;
  };

  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          <MapPinIcon className="h-4 w-4 shrink-0 text-brand-purple" />
          Eigen targetgebieden batch
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
          {targets.length > 0
            ? 'Deze batch krijgt eigen targetgebieden en negeert de klant-targetgebieden.'
            : 'Optioneel: voeg targetgebieden toe om klant-targetgebieden te overrulen.'}
        </p>
      </div>

      {targets.length > 0 && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-800">
          Override actief: klant-targetgebieden tellen niet mee voor deze batch.
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-medium text-rose-700">
          {error}
        </div>
      )}

      {targets.length === 0 ? (
        <p className="mb-3 rounded-lg border border-dashed border-slate-200 px-3 py-3 text-center text-xs text-slate-400">
          Nog geen eigen targetgebieden — batch volgt klant-targetgebieden.
        </p>
      ) : (
        <ul className="mb-3 flex flex-col gap-1.5">
          {targets.map(t => (
            <li
              key={t._key}
              className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-brand-purple/20 bg-brand-purple/[0.04] px-2.5 py-2"
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <MapPinIcon className="h-3.5 w-3.5 shrink-0 text-brand-purple" />
                <span className="truncate text-xs font-medium text-slate-700">{formatSummary(t)}</span>
              </div>
              <button
                type="button"
                onClick={() => removeDraft(t._key)}
                title="Verwijderen"
                className="shrink-0 rounded-md border border-rose-200 bg-white px-1.5 py-1 text-rose-500 transition hover:bg-rose-50"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!showAdd && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {COUNTRY_PRESETS.map(p => {
            const alreadyAdded = targets.some(t => t.label === p.label);
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => addPreset(p)}
                disabled={alreadyAdded}
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${
                  alreadyAdded
                    ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-brand-purple hover:text-brand-purple'
                }`}
              >
                <MapPinIcon className="h-3 w-3" />
                {p.label}
                {alreadyAdded && <CheckIcon className="h-3 w-3 text-emerald-500" />}
              </button>
            );
          })}
        </div>
      )}

      {showAdd === 'radius' ? (
        <div className="rounded-xl border border-brand-purple/20 bg-brand-purple/5 p-3">
          <h4 className="mb-2 text-xs font-semibold text-slate-800">Plaats + radius</h4>
          <div className="mb-2">
            <label className="mb-1 block text-[11px] font-medium text-slate-500">Zoek plaats</label>
            <div className="relative">
              <input
                value={cityQuery}
                onChange={e => searchCity(e.target.value)}
                placeholder="Bijv. Amsterdam, Antwerpen…"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-8 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
                autoFocus
              />
              {citySearching && (
                <ArrowPathIcon className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-slate-400" />
              )}
            </div>
            {cityError && <p className="mt-1 text-[11px] text-rose-500">{cityError}</p>}
            {cityResult && (
              <p className="mt-1 text-[11px] text-emerald-600">
                {cityResult.naam} gevonden ({cityResult.lat.toFixed(4)}, {cityResult.lng.toFixed(4)})
              </p>
            )}
          </div>
          <div className="mb-2">
            <label className="mb-1 block text-[11px] font-medium text-slate-500">Radius (km)</label>
            <input
              type="number"
              value={newRadius}
              onChange={e => setNewRadius(Number(e.target.value))}
              min={1}
              max={300}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
            />
          </div>
          <div className="mb-3">
            <label className="mb-1 block text-[11px] font-medium text-slate-500">
              Land-restrictie <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {([
                { value: 'NL' as const, label: 'Alleen NL' },
                { value: 'BE' as const, label: 'Alleen BE' },
                { value: 'BOTH' as const, label: 'Beide' },
              ]).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setNewRadiusCountry(opt.value)}
                  className={`rounded-lg border px-2 py-2 text-[11px] font-medium transition ${
                    newRadiusCountry === opt.value
                      ? 'border-brand-purple bg-brand-purple/10 text-brand-purple'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-brand-purple/50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={resetAddForm} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50">
              Annuleren
            </button>
            <button
              type="button"
              onClick={addRadiusTarget}
              disabled={!cityResult || newRadiusCountry === ''}
              className="rounded-lg bg-button-gradient px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              Toevoegen
            </button>
          </div>
        </div>
      ) : showAdd === 'province' ? (
        <div className="rounded-xl border border-brand-purple/20 bg-brand-purple/5 p-3">
          <h4 className="mb-2 text-xs font-semibold text-slate-800">Provincies</h4>
          <div className="mb-2">
            <label className="mb-1 block text-[11px] font-medium text-slate-500">Label (optioneel)</label>
            <input
              value={provLabel}
              onChange={e => setProvLabel(e.target.value)}
              placeholder="Wordt automatisch gegenereerd"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
            />
          </div>
          <div className="mb-2">
            <label className="mb-1 block text-[11px] font-medium text-slate-500">Nederland</label>
            <div className="flex flex-wrap gap-1.5">
              {PROVINCE_OPTIONS_NL.map(opt => {
                const selected = selectedProvinces.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleProvince(opt.value)}
                    className={`rounded-lg border px-2 py-1.5 text-[11px] font-medium transition ${
                      selected
                        ? 'border-brand-purple bg-brand-purple/10 text-brand-purple'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-brand-purple/50'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mb-2">
            <label className="mb-1 block text-[11px] font-medium text-slate-500">België</label>
            <div className="flex flex-wrap gap-1.5">
              {PROVINCE_OPTIONS_BE.map(opt => {
                const selected = selectedProvinces.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleProvince(opt.value)}
                    className={`rounded-lg border px-2 py-1.5 text-[11px] font-medium transition ${
                      selected
                        ? 'border-brand-purple bg-brand-purple/10 text-brand-purple'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-brand-purple/50'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
          {selectedProvinces.length > 0 && (
            <p className="mb-2 text-[11px] text-brand-purple">
              {selectedProvinces.length} geselecteerd: {selectedProvinces.map(formatProvinceTargetLabel).join(', ')}
            </p>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={resetAddForm} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50">
              Annuleren
            </button>
            <button
              type="button"
              onClick={addProvinceTarget}
              disabled={selectedProvinces.length === 0}
              className="rounded-lg bg-button-gradient px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              Toevoegen
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowAdd('radius')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-button-gradient px-3 py-2 text-xs font-bold text-white shadow-sm"
          >
            <MapPinIcon className="h-4 w-4" /> Plaats + radius
          </button>
          <button
            type="button"
            onClick={() => setShowAdd('province')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-purple/30 bg-brand-purple/5 px-3 py-2 text-xs font-bold text-brand-purple shadow-sm hover:bg-brand-purple/10"
          >
            <PlusIcon className="h-4 w-4" /> Provincies
          </button>
        </div>
      )}
    </div>
  );
}
