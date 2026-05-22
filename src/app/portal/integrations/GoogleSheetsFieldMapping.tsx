'use client';

import { useCallback, useEffect, useState } from 'react';
import { portalFetch } from '@/lib/portalAuth';
import { T } from '../_ui';
import { ArrowPathIcon, SparklesIcon } from '@heroicons/react/24/outline';

type PortalField = { key: string; label: string; group: 'standard' | 'branch' };
type SheetColumn = { id: string; label: string; letter: string; display: string };
type BranchMappingData = {
  slug: string;
  name: string;
  portal_fields: PortalField[];
  mapping: Record<string, string>;
  mapping_source?: 'saved' | 'suggested';
};

export function GoogleSheetsFieldMapping({
  showToast,
  ready,
  onSaved,
}: {
  showToast: (msg: string, type?: 'success' | 'error') => void;
  ready: boolean;
  onSaved?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState<BranchMappingData[]>([]);
  const [sheetColumns, setSheetColumns] = useState<SheetColumn[]>([]);
  const [activeBranch, setActiveBranch] = useState('');
  const [localMapping, setLocalMapping] = useState<Record<string, string>>({});
  const [hasSavedMappings, setHasSavedMappings] = useState(true);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(
    async (opts?: { suggest?: boolean }) => {
      if (!ready) return;
      setLoading(true);
      try {
        const qs = opts?.suggest ? '?suggest=1' : '';
        const res = await portalFetch(`/api/portal/integrations/google-sheets/field-mapping${qs}`);
        const d = await res.json().catch(() => ({}));
        if (!res.ok) {
          showToast(d.error || 'Velden laden mislukt', 'error');
          return;
        }
        const loaded: BranchMappingData[] = d.branches || [];
        setBranches(loaded);
        setSheetColumns(d.sheet_columns || []);
        setHasSavedMappings(d.has_saved_mappings !== false);
        const slug = activeBranch || loaded[0]?.slug || '';
        if (slug && !activeBranch) setActiveBranch(slug);
        const current = loaded.find((x) => x.slug === (activeBranch || slug));
        if (current) setLocalMapping(current.mapping);
        if (!opts?.suggest) setDirty(false);
        if (opts?.suggest) {
          setDirty(true);
          showToast('Kolommen automatisch gekoppeld — controleer en sla op');
        }
      } finally {
        setLoading(false);
      }
    },
    [ready, showToast, activeBranch],
  );

  useEffect(() => {
    void load();
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = branches.find((b) => b.slug === activeBranch);
  const portalFields = active?.portal_fields ?? [];
  const showSuggestBanner =
    (!hasSavedMappings || active?.mapping_source === 'suggested' || dirty) &&
    sheetColumns.length > 0;

  const save = async () => {
    if (!activeBranch) return;
    setSaving(true);
    try {
      const res = await portalFetch('/api/portal/integrations/google-sheets/field-mapping', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch: activeBranch, mapping: localMapping }),
      });
      if (res.ok) {
        showToast('Veldkoppeling opgeslagen');
        setDirty(false);
        setHasSavedMappings(true);
        await load();
        onSaved?.();
      } else {
        const d = await res.json();
        showToast(d.error || 'Opslaan mislukt', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  if (!ready) return null;

  return (
    <div className="mt-6 border-t border-slate-100 pt-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Veldkoppeling</h4>
          <p className="mt-0.5 max-w-prose text-xs text-slate-500">
            Koppel elk portaalveld aan een kolom in je spreadsheet (rij 1 = koppen).
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => void load({ suggest: true })}
            disabled={loading}
            className={T.btnSecondary}
          >
            <SparklesIcon className="h-4 w-4" />
            Auto-koppelen
          </button>
          <button type="button" onClick={() => void load()} disabled={loading} className={T.btnGhost}>
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {branches.length > 1 && (
        <div className={`mb-4 ${T.pillGroup} flex-wrap`}>
          {branches.map((b) => (
            <button
              key={b.slug}
              type="button"
              onClick={() => {
                setActiveBranch(b.slug);
                setLocalMapping(b.mapping);
                setDirty(false);
              }}
              className={`${T.pillItem} ${activeBranch === b.slug ? T.pillActive : T.pillIdle}`}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      {showSuggestBanner && !loading && (
        <div className="mb-4 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-xs text-amber-900">
          <p className="font-medium">Kolommen uit je spreadsheet geladen</p>
          <p className="mt-0.5 text-amber-800/90">
            Controleer de koppelingen en sla op om synchronisatie te starten.
          </p>
        </div>
      )}

      {loading && portalFields.length === 0 ? (
        <div className="h-32 animate-pulse rounded-xl bg-slate-50" />
      ) : sheetColumns.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">
          Geen kolommen gevonden in rij 1. Zorg dat de eerste rij koppen bevat.
        </p>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-slate-100 md:block">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Portaalveld</th>
                  <th className="px-3 py-2.5 font-medium">Spreadsheet-kolom</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {portalFields.map((pf) => (
                  <tr key={pf.key}>
                    <td className="px-3 py-2.5">
                      <span className="font-medium text-slate-800">{pf.label}</span>
                      {pf.group === 'branch' && (
                        <span className="ml-1 text-[10px] text-slate-400">(branche)</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        value={localMapping[pf.key] || ''}
                        onChange={(e) => {
                          setDirty(true);
                          setLocalMapping((m) => ({ ...m, [pf.key]: e.target.value }));
                        }}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                      >
                        <option value="">— Niet koppelen —</option>
                        {sheetColumns.map((col) => (
                          <option key={col.id} value={col.id}>
                            {col.display}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {portalFields.map((pf) => (
              <div key={pf.key} className="rounded-xl border border-slate-100 p-3">
                <p className="mb-2 text-sm font-medium text-slate-900">{pf.label}</p>
                <select
                  value={localMapping[pf.key] || ''}
                  onChange={(e) => {
                    setDirty(true);
                    setLocalMapping((m) => ({ ...m, [pf.key]: e.target.value }));
                  }}
                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                >
                  <option value="">— Niet koppelen —</option>
                  {sheetColumns.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.display}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !activeBranch}
            className={`${T.btnPrimary} mt-4 w-full sm:w-auto`}
          >
            {saving ? 'Opslaan…' : 'Veldkoppeling opslaan'}
          </button>
        </>
      )}
    </div>
  );
}
