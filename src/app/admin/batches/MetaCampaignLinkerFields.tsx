'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PauseCircleIcon, PlayCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';
import { mergeMetaCampaignLookupNames, type MetaCampaignPick } from '@/lib/metaCampaignIds';

const MAX_PICKS = 10;

type Props = {
  title?: string;
  helpText?: ReactNode;
  picks: MetaCampaignPick[];
  setPicks: React.Dispatch<React.SetStateAction<MetaCampaignPick[]>>;
  syncEnabled: boolean;
  setSyncEnabled: (v: boolean) => void;
  syncStatusSlot?: ReactNode;
  searchPlaceholder?: string;
  /**
   * Per gekoppelde campagne kiezen of de leads exclusief zijn voor deze batch,
   * en campagnes uitsluiten. Alleen voor leadbatches; wijzigen alleen door
   * superadmin en admin (anders alleen zichtbaar).
   */
  campagneRegels?: {
    magWijzigen: boolean;
    uitgesloten: MetaCampaignPick[];
    setUitgesloten: React.Dispatch<React.SetStateAction<MetaCampaignPick[]>>;
  };
};

const EXCLUSIEF_OPTIES: { waarde: '' | '24u' | 'altijd'; label: string }[] = [
  { waarde: '', label: 'Leads: gewone verdeling' },
  { waarde: '24u', label: 'Leads: 24 uur exclusief voor deze batch' },
  { waarde: 'altijd', label: 'Leads: altijd exclusief voor deze batch' },
];

/**
 * Zoeken + meerdere campagne-ID's koppelen (max 10), handmatige toevoeging, sync-toggle.
 * Haalt campagnenamen op via lookup wanneer de set gekoppelde ID's wijzigt.
 */
export function MetaCampaignLinkerFields({
  title = 'Meta campagnes',
  helpText,
  picks,
  setPicks,
  syncEnabled,
  setSyncEnabled,
  syncStatusSlot,
  searchPlaceholder = 'Typ een deel van de campagnenaam…',
  campagneRegels,
}: Props) {
  const uitgesloten = campagneRegels?.uitgesloten ?? [];
  const setUitgesloten = campagneRegels?.setUitgesloten;
  const uitIdsKey = uitgesloten.map(p => p.id).join(',');
  const [metaSearchQuery, setMetaSearchQuery] = useState('');
  const [metaSearchResults, setMetaSearchResults] = useState<{ id: string; name: string; effective_status?: string }[]>(
    [],
  );
  const [metaSearchLoading, setMetaSearchLoading] = useState(false);
  const [metaSearchError, setMetaSearchError] = useState<string | null>(null);
  const [metaSearchOpen, setMetaSearchOpen] = useState(false);
  const [manualMetaId, setManualMetaId] = useState('');
  const metaSearchWrapRef = useRef<HTMLDivElement>(null);

  const idsKey = picks.map(p => p.id).join(',');

  useEffect(() => {
    const ids = picks.map(p => p.id).filter(id => /^\d+$/.test(id));
    if (ids.length === 0) return;
    let cancelled = false;
    adminFetch(`/api/admin/meta-campaigns/lookup?ids=${encodeURIComponent(ids.join(','))}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('lookup failed'))))
      .then((d: { campaigns?: { id: string; name: string }[] }) => {
        if (cancelled) return;
        setPicks(prev => mergeMetaCampaignLookupNames(ids, d.campaigns || [], prev));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [idsKey, setPicks]);

  /* Namen voor de uitgesloten campagnes. */
  useEffect(() => {
    if (!setUitgesloten) return;
    const ids = uitgesloten.map(p => p.id).filter(id => /^\d+$/.test(id) && uitgesloten.find(x => x.id === id)?.name === id);
    if (ids.length === 0) return;
    let cancelled = false;
    adminFetch(`/api/admin/meta-campaigns/lookup?ids=${encodeURIComponent(ids.join(','))}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('lookup failed'))))
      .then((d: { campaigns?: { id: string; name: string }[] }) => {
        if (cancelled) return;
        const namen = new Map((d.campaigns || []).map(c => [String(c.id), c.name]));
        setUitgesloten(prev => prev.map(p => (namen.has(p.id) ? { ...p, name: namen.get(p.id) || p.id } : p)));
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uitIdsKey, setUitgesloten]);

  useEffect(() => {
    const q = metaSearchQuery.trim();
    if (q.length < 2) {
      setMetaSearchResults([]);
      setMetaSearchError(null);
      setMetaSearchLoading(false);
      return;
    }
    setMetaSearchLoading(true);
    setMetaSearchError(null);
    const t = window.setTimeout(() => {
      adminFetch(`/api/admin/meta-campaigns/search?q=${encodeURIComponent(q)}`)
        .then(async r => {
          const d = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error((d as { error?: string }).error || 'Zoeken mislukt');
          return d as { campaigns?: { id: string; name: string; effective_status?: string }[] };
        })
        .then(d => {
          setMetaSearchResults(d.campaigns || []);
        })
        .catch(e => {
          setMetaSearchResults([]);
          setMetaSearchError(e instanceof Error ? e.message : 'Zoeken mislukt');
        })
        .finally(() => setMetaSearchLoading(false));
    }, 400);
    return () => window.clearTimeout(t);
  }, [metaSearchQuery]);

  useEffect(() => {
    if (!metaSearchOpen) return;
    const close = (e: MouseEvent) => {
      if (metaSearchWrapRef.current && !metaSearchWrapRef.current.contains(e.target as Node)) {
        setMetaSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [metaSearchOpen]);

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-indigo-900">{title}</p>
        {picks.length > 0 && (
          <span className="text-[10px] font-medium text-indigo-700">
            {picks.length} gekoppeld (max. {MAX_PICKS})
          </span>
        )}
      </div>
      {helpText ? <div className="mb-2 text-[11px] text-indigo-800/90">{helpText}</div> : null}

      <div ref={metaSearchWrapRef} className="relative mb-3">
        <label className="mb-1 block text-[11px] font-medium text-indigo-900/80">Campagne zoeken</label>
        <input
          type="text"
          value={metaSearchQuery}
          onChange={e => {
            setMetaSearchQuery(e.target.value);
            setMetaSearchOpen(true);
          }}
          onFocus={() => setMetaSearchOpen(true)}
          placeholder={searchPlaceholder}
          autoComplete="off"
          className="w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400"
        />
        {metaSearchOpen && (metaSearchQuery.trim().length >= 2 || metaSearchLoading || metaSearchError) && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-52 overflow-auto rounded-lg border border-indigo-200 bg-white py-1 shadow-lg">
            {metaSearchLoading && <p className="px-3 py-2 text-xs text-slate-500">Zoeken in Meta…</p>}
            {!metaSearchLoading && metaSearchError && (
              <p className="px-3 py-2 text-xs text-rose-600">{metaSearchError}</p>
            )}
            {!metaSearchLoading &&
              !metaSearchError &&
              metaSearchResults.length === 0 &&
              metaSearchQuery.trim().length >= 2 && (
                <p className="px-3 py-2 text-xs text-slate-500">Geen campagnes gevonden (max. doorzocht in je ad account).</p>
              )}
            {!metaSearchLoading &&
              metaSearchResults.map(c => {
                const already = picks.some(p => p.id === c.id);
                const alUitgesloten = uitgesloten.some(p => p.id === c.id);
                const sluiten = () => { setMetaSearchQuery(''); setMetaSearchResults([]); setMetaSearchOpen(false); };
                return (
                  <div key={c.id} className="flex items-center gap-2 px-3 py-2 hover:bg-indigo-50">
                    <button
                      type="button"
                      disabled={already || alUitgesloten || picks.length >= MAX_PICKS}
                      onClick={() => {
                        if (already || alUitgesloten || picks.length >= MAX_PICKS) return;
                        setPicks(prev => [...prev, { id: c.id, name: c.name }]);
                        sluiten();
                      }}
                      className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left text-sm disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <span className="font-medium text-slate-900">{c.name}</span>
                      <span className="font-mono text-[10px] text-slate-500">
                        {c.id}
                        {c.effective_status ? ` · ${c.effective_status}` : ''}
                      </span>
                    </button>
                    {setUitgesloten && campagneRegels?.magWijzigen && (
                      <button
                        type="button"
                        disabled={already || alUitgesloten}
                        onClick={() => { setUitgesloten(prev => [...prev, { id: c.id, name: c.name }].slice(0, 50)); sluiten(); }}
                        className="shrink-0 rounded border border-rose-200 px-2 py-1 text-[10px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-40"
                        title="Deze batch krijgt nooit leads uit deze campagne"
                      >
                        Uitsluiten
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {picks.length > 0 && (
        <div className="mb-3 flex flex-col gap-1.5">
          {picks.map(p => {
            const isPaused = p.paused === true;
            return (
              <div
                key={p.id}
                className={`flex max-w-full items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] ${
                  isPaused
                    ? 'border-slate-200 bg-slate-100 text-slate-600'
                    : 'border-indigo-200 bg-white text-indigo-950'
                }`}
              >
                <span className="min-w-0 flex-1 truncate font-medium" title={p.name}>
                  {p.name}
                </span>
                <span className="hidden shrink-0 font-mono text-[10px] text-slate-500 sm:inline">({p.id})</span>
                {isPaused && (
                  <span className="shrink-0 rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-600">
                    Uit
                  </span>
                )}
                {campagneRegels && (
                  <select
                    value={p.exclusief ?? ''}
                    disabled={!campagneRegels.magWijzigen}
                    onChange={e => {
                      const v = e.target.value as '' | '24u' | 'altijd';
                      setPicks(prev => prev.map(x => {
                        if (x.id !== p.id) return x;
                        const { exclusief: _weg, ...rest } = x;
                        void _weg;
                        return v ? { ...rest, exclusief: v } : rest;
                      }));
                    }}
                    title={campagneRegels.magWijzigen ? 'Wie krijgt de leads uit deze campagne?' : 'Alleen een admin of superadmin kan dit wijzigen'}
                    aria-label="Exclusiviteit van de leads uit deze campagne"
                    className={`shrink-0 rounded border px-1.5 py-1 text-[10px] font-medium ${p.exclusief ? 'border-violet-300 bg-violet-50 text-violet-800' : 'border-slate-200 bg-white text-slate-600'} disabled:opacity-60`}
                  >
                    {EXCLUSIEF_OPTIES.map(o => <option key={o.waarde} value={o.waarde}>{o.label}</option>)}
                  </select>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setPicks(prev =>
                      prev.map(x => (x.id === p.id ? { ...x, paused: !x.paused } : x)),
                    )
                  }
                  className={`flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded p-2 ${
                    isPaused
                      ? 'text-emerald-600 hover:bg-emerald-50'
                      : 'text-amber-600 hover:bg-amber-50'
                  }`}
                  title={isPaused ? 'Aanzetten in Meta (na opslaan)' : 'Uitzetten in Meta (na opslaan)'}
                  aria-label={isPaused ? 'Campagne aanzetten' : 'Campagne uitzetten'}
                >
                  {isPaused ? (
                    <PlayCircleIcon className="h-4 w-4" />
                  ) : (
                    <PauseCircleIcon className="h-4 w-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setPicks(prev => prev.filter(x => x.id !== p.id))}
                  className="flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  aria-label="Koppeling verwijderen"
                  title="Verwijderen en in Meta pauzeren (na opslaan)"
                >
                  <XMarkIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {campagneRegels && picks.some(p => p.exclusief) && (
        <p className="mb-3 rounded-md border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[11px] text-violet-900">
          Exclusief: leads uit die campagne gaan alleen naar deze batch (bij &quot;24 uur&quot; de eerste 24 uur na binnenkomst, daarna ook naar
          anderen). Kan deze batch de lead niet nemen, dan wacht hij of komt hij in Restleads; een andere klant krijgt hem in die tijd niet.
          Een campagne kan maar bij één klant exclusief zijn.
        </p>
      )}

      {campagneRegels && (
        <div className="mb-3 rounded-md border border-rose-100 bg-white/70 px-2.5 py-2">
          <p className="text-[11px] font-semibold text-rose-900">Campagnes uitsluiten</p>
          <p className="text-[10px] text-rose-900/70">Deze batch krijgt nooit leads uit deze campagnes. Zoek hierboven een campagne en kies &quot;Uitsluiten&quot;.</p>
          {uitgesloten.length === 0 ? (
            <p className="mt-1 text-[10px] text-slate-400">Geen uitgesloten campagnes.</p>
          ) : (
            <div className="mt-1.5 flex flex-col gap-1">
              {uitgesloten.map(p => (
                <div key={p.id} className="flex items-center gap-1.5 rounded border border-rose-200 bg-rose-50/60 px-2 py-1 text-[11px] text-rose-900">
                  <span className="min-w-0 flex-1 truncate" title={p.name}>{p.name}</span>
                  <span className="hidden shrink-0 font-mono text-[10px] text-rose-700/70 sm:inline">({p.id})</span>
                  {campagneRegels.magWijzigen && setUitgesloten && (
                    <button type="button" onClick={() => setUitgesloten(prev => prev.filter(x => x.id !== p.id))}
                      className="rounded p-1 text-rose-400 hover:bg-rose-100 hover:text-rose-700" aria-label="Weer toestaan">
                      <XMarkIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mb-3 rounded-md border border-dashed border-indigo-200/80 bg-white/60 px-2 py-2">
        <p className="mb-1 text-[10px] font-medium text-indigo-900/70">Handmatig campagne-ID (fallback)</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={manualMetaId}
            onChange={e => setManualMetaId(e.target.value.replace(/\D/g, ''))}
            placeholder="Alleen cijfers"
            className="min-w-0 flex-1 rounded border border-indigo-100 px-2 py-1 font-mono text-xs text-slate-900"
          />
          <button
            type="button"
            onClick={() => {
              const id = manualMetaId.trim();
              if (!/^\d+$/.test(id) || picks.length >= MAX_PICKS) return;
              if (picks.some(p => p.id === id)) return;
              setPicks(prev => [...prev, { id, name: id }]);
              setManualMetaId('');
            }}
            className="shrink-0 rounded bg-indigo-600 px-2 py-1 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            Toevoegen
          </button>
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-indigo-950">
        <input
          type="checkbox"
          checked={syncEnabled}
          onChange={e => setSyncEnabled(e.target.checked)}
          className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
        />
        Meta sync aan (uit = alle gekoppelde campagnes naar gepauzeerd). Alleen <strong>actieve</strong> batches sturen aan/uit in Meta — voltooide batches blijven gekoppeld voor historiek. Per campagne: pauze/aan-knop; verwijderen = ontkoppelen + pauzeren in Meta.
      </label>

      {syncStatusSlot}
    </div>
  );
}
