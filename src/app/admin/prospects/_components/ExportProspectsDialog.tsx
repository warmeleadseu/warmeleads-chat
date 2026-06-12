'use client';

import { useEffect, useState } from 'react';
import { ArrowDownTrayIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';
import { prospectsExportFilenameBase } from '@/lib/prospectsExport';

export interface ExportProspectsDialogProps {
  open: boolean;
  onClose: () => void;
  /** Aantal prospects in de huidige filters (voor user feedback). */
  filterCount: number;
  /** Selectie van prospect-ids; leeg = exporteer huidige filters. */
  selectedIds: string[];
  /** Filterwaardes uit de prospects-lijst, 1-op-1 doorgestuurd naar de API. */
  filters: {
    search?: string;
    status?: string;
    account_manager_id?: string;
    branch?: string;
    source?: string;
    has_open_tasks?: '1' | null;
  };
  onExported?: (count: number) => void;
}

type ExportFormat = 'csv' | 'xlsx';
type ExportScope = 'filters' | 'selection';

export function ExportProspectsDialog({
  open,
  onClose,
  filterCount,
  selectedIds,
  filters,
  onExported,
}: ExportProspectsDialogProps) {
  const hasSelection = selectedIds.length > 0;
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const [scope, setScope] = useState<ExportScope>(hasSelection ? 'selection' : 'filters');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setScope(hasSelection ? 'selection' : 'filters');
    setError(null);
  }, [open, hasSelection]);

  if (!open) return null;

  const expectedCount = scope === 'selection' ? selectedIds.length : filterCount;

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { format };
      if (scope === 'selection') {
        body.prospect_ids = selectedIds;
      } else {
        if (filters.search) body.search = filters.search;
        if (filters.status && filters.status !== 'all') body.status = filters.status;
        if (filters.account_manager_id && filters.account_manager_id !== 'all') {
          body.account_manager_id = filters.account_manager_id;
        }
        if (filters.branch && filters.branch !== 'all') body.branch = filters.branch;
        if (filters.source && filters.source !== 'all') body.source = filters.source;
        if (filters.has_open_tasks) body.has_open_tasks = filters.has_open_tasks;
      }

      const res = await adminFetch('/api/admin/prospects/export', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Export mislukt (${res.status})`);
      }

      const exportedCount = Number(res.headers.get('X-Export-Count') || '0') || expectedCount;
      const cappedHeader = res.headers.get('X-Export-Capped');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${prospectsExportFilenameBase()}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      onExported?.(exportedCount);
      onClose();

      if (cappedHeader === 'true') {
        // Niet blocking — alleen melden via console; we sluiten al de modal.
        console.warn(
          '[prospects-export] resultaat is afgekapt op de bovengrens. Verfijn filters om de resterende rijen te exporteren.',
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export mislukt');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <ArrowDownTrayIcon className="h-5 w-5 text-brand-purple" />
              Prospects exporteren
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {scope === 'selection'
                ? `${selectedIds.length.toLocaleString('nl-NL')} geselecteerd`
                : `${filterCount.toLocaleString('nl-NL')} in huidige filters`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100"
            aria-label="Sluiten"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
              {error}
            </div>
          )}

          {hasSelection && (
            <fieldset>
              <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Wat exporteren?
              </legend>
              <div className="mt-2 grid gap-2">
                <label
                  className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${
                    scope === 'selection'
                      ? 'border-brand-purple/40 bg-brand-purple/5 text-slate-900 ring-1 ring-inset ring-brand-purple/20'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="prospects-export-scope"
                    value="selection"
                    checked={scope === 'selection'}
                    onChange={() => setScope('selection')}
                    className="mt-1 h-4 w-4 text-brand-purple focus:ring-brand-purple/30"
                  />
                  <span>
                    <span className="font-medium">Alleen selectie</span>
                    <span className="ml-1 text-slate-500">
                      ({selectedIds.length.toLocaleString('nl-NL')})
                    </span>
                  </span>
                </label>
                <label
                  className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${
                    scope === 'filters'
                      ? 'border-brand-purple/40 bg-brand-purple/5 text-slate-900 ring-1 ring-inset ring-brand-purple/20'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="prospects-export-scope"
                    value="filters"
                    checked={scope === 'filters'}
                    onChange={() => setScope('filters')}
                    className="mt-1 h-4 w-4 text-brand-purple focus:ring-brand-purple/30"
                  />
                  <span>
                    <span className="font-medium">Alle in huidige filters</span>
                    <span className="ml-1 text-slate-500">
                      ({filterCount.toLocaleString('nl-NL')})
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>
          )}

          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Bestandsformaat
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm ${
                  format === 'xlsx'
                    ? 'border-brand-purple/40 bg-brand-purple/5 text-slate-900 ring-1 ring-inset ring-brand-purple/20'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="prospects-export-format"
                  value="xlsx"
                  checked={format === 'xlsx'}
                  onChange={() => setFormat('xlsx')}
                  className="h-4 w-4 text-brand-purple focus:ring-brand-purple/30"
                />
                <span>
                  <span className="font-medium">Excel</span>
                  <span className="ml-1 text-xs text-slate-500">.xlsx</span>
                </span>
              </label>
              <label
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm ${
                  format === 'csv'
                    ? 'border-brand-purple/40 bg-brand-purple/5 text-slate-900 ring-1 ring-inset ring-brand-purple/20'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="prospects-export-format"
                  value="csv"
                  checked={format === 'csv'}
                  onChange={() => setFormat('csv')}
                  className="h-4 w-4 text-brand-purple focus:ring-brand-purple/30"
                />
                <span>
                  <span className="font-medium">CSV</span>
                  <span className="ml-1 text-xs text-slate-500">.csv</span>
                </span>
              </label>
            </div>
          </fieldset>

          <p className="text-xs text-slate-500">
            De export bevat alle relevante velden (bedrijf, contact, locatie, branches, status,
            AM, datums, notities). Bestandsnaam:{' '}
            <code className="rounded bg-slate-100 px-1 text-[11px]">
              {prospectsExportFilenameBase()}.{format}
            </code>
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={exporting}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Annuleren
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || expectedCount === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-white hover:bg-brand-purple/90 disabled:opacity-50"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            {exporting ? 'Exporteren...' : `Exporteer ${expectedCount.toLocaleString('nl-NL')}`}
          </button>
        </div>
      </div>
    </div>
  );
}
