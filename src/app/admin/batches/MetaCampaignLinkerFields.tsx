'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
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
};

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
}: Props) {
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
        setPicks(mergeMetaCampaignLookupNames(ids, d.campaigns || []));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [idsKey, setPicks]);

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
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={already || picks.length >= MAX_PICKS}
                    onClick={() => {
                      if (already || picks.length >= MAX_PICKS) return;
                      setPicks(prev => [...prev, { id: c.id, name: c.name }]);
                      setMetaSearchQuery('');
                      setMetaSearchResults([]);
                      setMetaSearchOpen(false);
                    }}
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span className="font-medium text-slate-900">{c.name}</span>
                    <span className="font-mono text-[10px] text-slate-500">
                      {c.id}
                      {c.effective_status ? ` · ${c.effective_status}` : ''}
                    </span>
                  </button>
                );
              })}
          </div>
        )}
      </div>

      {picks.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {picks.map(p => (
            <span
              key={p.id}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-indigo-200 bg-white px-2.5 py-1 text-[11px] text-indigo-950"
            >
              <span className="truncate font-medium" title={p.name}>
                {p.name}
              </span>
              <span className="shrink-0 font-mono text-[10px] text-slate-500">({p.id})</span>
              <button
                type="button"
                onClick={() => setPicks(prev => prev.filter(x => x.id !== p.id))}
                className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                aria-label="Verwijderen"
              >
                <XMarkIcon className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
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
        Meta sync aan (uit = gekoppelde campagnes naar gepauzeerd)
      </label>

      {syncStatusSlot}
    </div>
  );
}
