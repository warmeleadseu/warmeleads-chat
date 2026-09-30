'use client';

import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import MultiSelect from '@/components/admin/MultiSelect';
import { LEAD_PROVINCE_OPTIONS_NL, LEAD_PROVINCE_OPTIONS_BE } from '@/data/provinces';
import { DISTANCE_PRESETS_KM } from '@/lib/portalLeadGeoFilters';
import { parsePostcodeRanges } from '@/lib/postcodeRanges';
import type { LeadFilterStand } from '@/lib/leadFilterState';

/**
 * De filterbalk van Restleads, opgebouwd zoals die van het Leads CRM.
 *
 * Status en "wel/niet uitgedeeld" ontbreken bewust: elke lead hier heeft nul
 * of één klant en geen verkoopstatus die ertoe doet. Daarvoor in de plaats twee
 * klantfilters: bij wie de lead al staat, en naar wie hij nog kan.
 */

interface Optie { value: string; label: string }

export default function RestleadsFilters({
  filters,
  zet,
  kanNaar,
  setKanNaar,
  facetten,
  branches,
  klanten,
  campagnes,
  plaatsLabel,
  actief,
  onWis,
}: {
  filters: LeadFilterStand;
  zet: <K extends keyof LeadFilterStand>(sleutel: K, waarde: LeadFilterStand[K]) => void;
  kanNaar: string[];
  setKanNaar: (v: string[]) => void;
  facetten: Record<string, Record<string, number>>;
  branches: Optie[];
  klanten: Optie[];
  campagnes: Optie[];
  plaatsLabel: string | null;
  actief: number;
  onWis: () => void;
}) {
  const f = filters;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={f.search}
            onChange={e => zet('search', e.target.value)}
            placeholder="Zoek op naam, email, telefoon, postcode of plaats..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2.5 pl-9 pr-4 text-sm text-slate-700 outline-none focus:border-brand-purple/50 focus:bg-white focus:ring-1 focus:ring-brand-purple/30"
          />
        </div>
        {actief > 0 && (
          <button
            type="button"
            onClick={onWis}
            title="Zet alle filters en de zoekterm terug. Marge-instellingen blijven staan."
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
          >
            <XMarkIcon className="h-4 w-4" />
            Alle filters verwijderen ({actief})
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-8">
        <MultiSelect
          label="branches"
          allLabel="Alle branches"
          options={branches}
          selected={f.selBranches}
          onChange={v => zet('selBranches', v)}
          counts={facetten.branch}
        />
        <MultiSelect
          label="uitgedeeld aan"
          allLabel="Uitgedeeld aan: iedereen"
          options={klanten}
          selected={f.selCustomers}
          onChange={v => zet('selCustomers', v)}
          searchable
          counts={facetten.customer_id}
        />
        <MultiSelect
          label="kan naar"
          allLabel="Kan naar: iedereen"
          options={klanten}
          selected={kanNaar}
          onChange={setKanNaar}
          searchable
          counts={facetten.kan_naar}
        />
        <MultiSelect
          label="provincies"
          allLabel="Alle provincies"
          groups={[
            { label: 'Nederland', options: LEAD_PROVINCE_OPTIONS_NL },
            { label: 'België', options: LEAD_PROVINCE_OPTIONS_BE },
          ]}
          selected={f.selProvinces}
          onChange={v => zet('selProvinces', v)}
          searchable
          counts={facetten.province}
        />
        <MultiSelect
          label="bronnen"
          allLabel="Alle bronnen"
          options={[
            { value: 'handmatig', label: 'Handmatig' },
            { value: 'zapier', label: 'Zapier' },
          ]}
          selected={f.selSources}
          onChange={v => zet('selSources', v)}
          counts={facetten.source}
        />
        {campagnes.length > 0 && (
          <MultiSelect
            label="campagnes"
            allLabel="Alle campagnes"
            searchable
            options={campagnes}
            selected={f.selCampaigns}
            onChange={v => zet('selCampaigns', v)}
            counts={facetten.meta_campaign_id}
          />
        )}
        <select
          value={f.phoneFilter}
          onChange={e => zet('phoneFilter', e.target.value)}
          className={`rounded-lg border px-3 py-2 text-sm ${f.phoneFilter === 'false' ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-700'}`}
        >
          <option value="all">Alle nummers</option>
          <option value="false">Verdacht nummer</option>
          <option value="true">Geldig nummer</option>
        </select>
        <select
          value={f.bulkFilter}
          onChange={e => zet('bulkFilter', e.target.value)}
          className={`rounded-lg border px-3 py-2 text-sm ${f.bulkFilter !== 'all' ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-700'}`}
        >
          <option value="all">Alle bulk status</option>
          <option value="never">Nog niet verkocht</option>
          <option value="once">1x verkocht</option>
          <option value="multiple">2x+ verkocht</option>
        </select>
      </div>

      {/* Provinciemarge, zoals in het Leads CRM: alleen zinvol met een provincie. */}
      {f.selProvinces.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
          <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={f.provincieMargeKm != null}
              onChange={e => zet('provincieMargeKm', e.target.checked ? 10 : null)}
              className="h-4 w-4 rounded border-slate-300 text-brand-purple focus:ring-brand-purple"
            />
            Ook leads net buiten de provincie
          </label>
          {f.provincieMargeKm != null && (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                inputMode="decimal"
                min={1}
                max={100}
                step={1}
                list="restleads-provinciemarge-presets"
                value={f.provincieMargeKm}
                onChange={e => {
                  const n = parseFloat(e.target.value.replace(',', '.'));
                  zet('provincieMargeKm', Number.isFinite(n) && n > 0 ? Math.min(100, n) : null);
                }}
                className="w-20 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-900 outline-none focus:ring-1 focus:ring-emerald-400"
              />
              <datalist id="restleads-provinciemarge-presets">
                <option value="5" />
                <option value="10" />
                <option value="15" />
                <option value="25" />
              </datalist>
              <span className="text-xs text-slate-500">km over de grens</span>
            </div>
          )}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={f.dateFrom} onChange={e => zet('dateFrom', e.target.value)} title="Wervingsdatum vanaf" className="w-full max-w-[9.5rem] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 sm:w-auto" />
          <span className="text-xs text-slate-400">t/m</span>
          <input type="date" value={f.dateTo} onChange={e => zet('dateTo', e.target.value)} title="Wervingsdatum tot en met" className="w-full max-w-[9.5rem] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 sm:w-auto" />
        </div>
        <input
          type="text"
          value={f.plaatsFilter}
          onChange={e => zet('plaatsFilter', e.target.value)}
          placeholder="Plaatsnaam (NL/BE)"
          title={f.plaatsRadiusKm != null
            ? 'Middelpunt voor straalfilter (geocode NL/BE), bijv. Amsterdam of Antwerpen'
            : 'Filter op plaatsnaam, bijv. Amsterdam of Antwerpen'}
          className={`min-w-[12rem] flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/30 sm:max-w-[14rem] ${f.plaatsFilter.trim() ? 'border-sky-300 bg-sky-50 text-sky-900' : 'border-slate-200 bg-white text-slate-700'}`}
        />
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={500}
            step={1}
            list="restleads-radius-presets"
            value={f.plaatsRadiusKm == null ? '' : String(f.plaatsRadiusKm)}
            onChange={e => {
              const n = Number(e.target.value.trim());
              zet('plaatsRadiusKm', e.target.value.trim() && Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), 500) : null);
            }}
            placeholder="Straal"
            title="Straal in km rondom de plaatsnaam (1–500). Leeg = alleen plaatsnaam-match."
            className={`w-[5.5rem] rounded-lg border px-2.5 py-2 text-sm tabular-nums outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/30 ${f.plaatsRadiusKm != null ? 'border-sky-300 bg-sky-50 text-sky-900' : 'border-slate-200 bg-white text-slate-700'}`}
          />
          <datalist id="restleads-radius-presets">
            {DISTANCE_PRESETS_KM.map(km => <option key={km} value={km} />)}
          </datalist>
          <span className="text-xs text-slate-400">km</span>
        </div>
        {f.plaatsRadiusKm != null && f.plaatsFilter.trim() && plaatsLabel && (
          <span className="text-xs text-sky-700" title="Geocodeerd middelpunt">
            ≤{f.plaatsRadiusKm} km van {plaatsLabel}
          </span>
        )}
        <input
          type="text"
          value={f.postcodeRanges}
          onChange={e => zet('postcodeRanges', e.target.value)}
          placeholder="Postcodegebied (bijv. 7500-7599, 2000, 7511AB)"
          title="Filter op PC4-gebieden: 7500-7599, 75, 7511AB of meerdere ranges gescheiden door komma"
          className={`min-w-[14rem] flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/30 sm:max-w-xs ${parsePostcodeRanges(f.postcodeRanges).length > 0 ? 'border-sky-300 bg-sky-50 text-sky-900' : 'border-slate-200 bg-white text-slate-700'}`}
        />
        {(f.dateFrom || f.dateTo) && (
          <label className="flex cursor-pointer select-none items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={f.includeUnknownDate}
              onChange={e => zet('includeUnknownDate', e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-brand-purple focus:ring-brand-purple"
            />
            <span>Ook leads zonder bekende datum</span>
          </label>
        )}
      </div>
    </div>
  );
}
