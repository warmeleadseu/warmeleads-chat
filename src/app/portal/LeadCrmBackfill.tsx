'use client';

import { useCallback, useEffect, useState } from 'react';
import { portalFetch } from '@/lib/portalAuth';
import { ArrowDownTrayIcon, ArrowPathIcon, CloudArrowUpIcon } from '@heroicons/react/24/outline';
import type { ExportFilters } from './ExportWizard';
import { MAX_BACKFILL_LEADS } from '@/lib/integrations/backfillLeads';

type IntegrationPrefs = {
  preferred_crm_provider: string | null;
  connections: {
    teamleader: { sync_ready: boolean };
    google_sheets: { sync_ready: boolean };
  };
};

export function useCrmBackfillReady(isOwner: boolean) {
  const [crmLabel, setCrmLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(isOwner);

  useEffect(() => {
    if (!isOwner) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void portalFetch('/api/portal/integrations/preferences')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: IntegrationPrefs | null) => {
        if (cancelled || !d) return;
        const tl = d.connections?.teamleader?.sync_ready;
        const gs = d.connections?.google_sheets?.sync_ready;
        const preferred = d.preferred_crm_provider;
        if (preferred === 'google_sheets' && gs) {
          setCrmLabel('Google Spreadsheets');
        } else if (preferred === 'teamleader' && tl) {
          setCrmLabel('Teamleader');
        } else if (gs && !tl) {
          setCrmLabel('Google Spreadsheets');
        } else if (tl && !gs) {
          setCrmLabel('Teamleader');
        } else if (tl && gs) {
          setCrmLabel('Teamleader');
        } else {
          setCrmLabel(null);
        }
      })
      .catch(() => setCrmLabel(null))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOwner]);

  return { crmLabel, crmReady: !!crmLabel, loading };
}

export function SelectAllLeadsBanner({
  pageCount,
  totalCount,
  selectAllFiltered,
  onSelectAll,
  onClearAll,
}: {
  pageCount: number;
  totalCount: number;
  selectAllFiltered: boolean;
  onSelectAll: () => void;
  onClearAll: () => void;
}) {
  if (totalCount <= pageCount) return null;

  if (selectAllFiltered) {
    return (
      <div className="rounded-lg border border-brand-purple/20 bg-brand-purple/5 px-4 py-2.5 text-sm text-slate-700">
        Alle {totalCount} leads die aan je filters voldoen zijn geselecteerd.{' '}
        <button
          type="button"
          onClick={onClearAll}
          className="font-semibold text-brand-purple underline-offset-2 hover:underline"
        >
          Deselecteer alles
        </button>
      </div>
    );
  }

  if (pageCount === 0) return null;

  return (
    <div className="rounded-lg border border-brand-purple/20 bg-brand-purple/5 px-4 py-2.5 text-sm text-slate-700">
      {pageCount} lead{pageCount === 1 ? '' : 's'} op deze pagina geselecteerd.{' '}
      <button
        type="button"
        onClick={onSelectAll}
        className="font-semibold text-brand-purple underline-offset-2 hover:underline"
      >
        Selecteer alle {totalCount} leads
      </button>
    </div>
  );
}

export function LeadSelectionBar({
  selectedCount,
  crmLabel,
  canExport,
  canAssign,
  canEditStatus,
  teamMembers,
  statusOptions,
  onClear,
  onSync,
  onExport,
  onAssign,
  onBulkStatus,
  syncing,
  assigning,
  statusUpdating,
}: {
  selectedCount: number;
  crmLabel?: string | null;
  canExport: boolean;
  canAssign?: boolean;
  canEditStatus?: boolean;
  teamMembers?: { id: string; name: string }[];
  statusOptions?: { value: string; label: string }[];
  onClear: () => void;
  onSync?: (forceResend: boolean) => void;
  onExport?: () => void;
  onAssign?: (portalUserId: string | null) => void;
  onBulkStatus?: (status: string) => void;
  syncing: boolean;
  assigning?: boolean;
  statusUpdating?: boolean;
}) {
  const [forceResend, setForceResend] = useState(false);
  const busy = syncing || !!assigning || !!statusUpdating;

  if (selectedCount === 0) return null;

  return (
    <div className="sticky bottom-4 z-30 mx-auto flex max-w-3xl flex-col gap-2 rounded-xl border border-brand-purple/20 bg-white p-3 shadow-lg">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-slate-800">
          {selectedCount} lead{selectedCount === 1 ? '' : 's'} geselecteerd
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            disabled={busy}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
          >
            Deselecteer
          </button>
          {canEditStatus && onBulkStatus && statusOptions && statusOptions.length > 0 && (
            <select
              defaultValue=""
              disabled={busy}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                onBulkStatus(v);
                e.target.value = '';
              }}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-brand-purple/50 disabled:opacity-50"
              aria-label="Wijzig status van selectie"
            >
              <option value="" disabled>
                {statusUpdating ? 'Status bijwerken…' : 'Status wijzigen…'}
              </option>
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}
          {canAssign && onAssign && (
            <select
              defaultValue=""
              disabled={busy || !teamMembers?.length}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                onAssign(v === '__unassign__' ? null : v);
                e.target.value = '';
              }}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-brand-purple/50 disabled:opacity-50"
              aria-label="Wijs geselecteerde leads toe"
            >
              <option value="" disabled>
                {assigning ? 'Toewijzen…' : 'Toewijzen aan…'}
              </option>
              <option value="__unassign__">Niet toegewezen</option>
              {(teamMembers || []).map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          )}
          {canExport && onExport && (
            <button
              type="button"
              onClick={onExport}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-purple/30 bg-brand-purple/5 px-3 py-2 text-xs font-semibold text-brand-purple transition hover:bg-brand-purple/10 disabled:opacity-50"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              Exporteer selectie
            </button>
          )}
          {crmLabel && onSync && (
            <button
              type="button"
              onClick={() => onSync(forceResend)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-purple px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-purple/90 disabled:opacity-50"
            >
              {syncing ? (
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
              ) : (
                <CloudArrowUpIcon className="h-4 w-4" />
              )}
              {syncing ? 'Bezig…' : `Stuur naar ${crmLabel}`}
            </button>
          )}
        </div>
      </div>
      {crmLabel && onSync && (
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={forceResend}
            onChange={(e) => setForceResend(e.target.checked)}
            disabled={busy}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-purple focus:ring-brand-purple/30"
          />
          <span>
            Ook opnieuw versturen als deze leads al succesvol zijn gesynchroniseerd naar{' '}
            {crmLabel}. Er worden nieuwe rijen/regels toegevoegd.
          </span>
        </label>
      )}
    </div>
  );
}

function buildLeadsQueryParams(filters: ExportFilters, extra?: Record<string, string>): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.statusFilter !== 'all') params.set('status', filters.statusFilter);
  if (filters.branchFilter !== 'all') params.set('branch', filters.branchFilter);
  if (filters.dateFrom) params.set('from', filters.dateFrom);
  if (filters.dateTo) params.set('to', filters.dateTo);
  if (filters.leadSource !== 'all') params.set('lead_source', filters.leadSource);
  if (filters.search) params.set('search', filters.search);
  if (filters.assignedTo && filters.assignedTo !== 'all') {
    params.set('assigned_to', filters.assignedTo);
  }
  if (filters.provinces) params.set('provincie', filters.provinces);
  if (filters.plaats) params.set('plaats', filters.plaats);
  if (filters.postcodeArea) params.set('postcode_area', filters.postcodeArea);
  if (filters.maxDistanceKm) params.set('max_distance_km', filters.maxDistanceKm);
  if (filters.distanceOriginPlace) {
    params.set('distance_origin_place', filters.distanceOriginPlace);
  }
  if (filters.distanceOriginProvince) {
    params.set('distance_origin_province', filters.distanceOriginProvince);
  }
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      params.set(key, value);
    }
  }
  return params;
}

export function useLeadCrmBackfill(
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void,
) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAllFiltered, setSelectAllFiltered] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const isLeadSelected = useCallback(
    (leadId: string) => selectAllFiltered || selectedIds.has(leadId),
    [selectAllFiltered, selectedIds],
  );

  const toggleLead = useCallback(
    (leadId: string, checked: boolean, pageLeadIds: string[]) => {
      if (selectAllFiltered && !checked) {
        setSelectAllFiltered(false);
        setSelectedIds(new Set(pageLeadIds.filter((id) => id !== leadId)));
        return;
      }
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (checked) next.add(leadId);
        else next.delete(leadId);
        return next;
      });
    },
    [selectAllFiltered],
  );

  const togglePage = useCallback((leadIds: string[], checked: boolean) => {
    if (!checked) {
      setSelectAllFiltered(false);
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of leadIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const selectAllMatching = useCallback(() => {
    setSelectAllFiltered(true);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectAllFiltered(false);
  }, []);

  const runBackfill = useCallback(
    async (
      crmLabel: string,
      options: {
        forceResend?: boolean;
        selectAllFiltered: boolean;
        selectedIds: Set<string>;
        filters: ExportFilters;
        total: number;
      },
    ) => {
      setSyncing(true);
      try {
        let lead_ids: string[];
        if (options.selectAllFiltered) {
          const params = buildLeadsQueryParams(options.filters, { ids_only: '1' });
          const res = await portalFetch(`/api/portal/leads?${params}`);
          const d = await res.json().catch(() => ({}));
          if (!res.ok) {
            showToast(d.error || 'Leads ophalen mislukt', 'error');
            return;
          }
          lead_ids = Array.isArray(d.ids) ? d.ids : [];
        } else {
          lead_ids = [...options.selectedIds];
        }

        if (lead_ids.length === 0) return;

        let totalSynced = 0;
        let totalSkipped = 0;
        let totalFailed = 0;

        for (let i = 0; i < lead_ids.length; i += MAX_BACKFILL_LEADS) {
          const chunk = lead_ids.slice(i, i + MAX_BACKFILL_LEADS);
          const res = await portalFetch('/api/portal/integrations/sync-leads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lead_ids: chunk, force_resend: options.forceResend === true }),
          });
          const d = await res.json().catch(() => ({}));
          if (!res.ok) {
            showToast(d.error || 'Versturen mislukt', 'error');
            return;
          }
          totalSynced += d.synced || 0;
          totalSkipped += d.skipped || 0;
          totalFailed += d.failed || 0;
        }

        const parts: string[] = [];
        if (totalSynced) parts.push(`${totalSynced} verstuurd`);
        if (totalSkipped) parts.push(`${totalSkipped} overgeslagen`);
        if (totalFailed) parts.push(`${totalFailed} mislukt`);
        showToast(
          parts.length > 0
            ? `${parts.join(', ')} naar ${crmLabel}`
            : `Geen leads verstuurd naar ${crmLabel}`,
          totalFailed ? 'error' : 'success',
        );
        if (totalSynced > 0) clearSelection();
      } finally {
        setSyncing(false);
      }
    },
    [showToast, clearSelection],
  );

  return {
    selectedIds,
    selectAllFiltered,
    syncing,
    isLeadSelected,
    toggleLead,
    togglePage,
    selectAllMatching,
    clearSelection,
    runBackfill,
  };
}
