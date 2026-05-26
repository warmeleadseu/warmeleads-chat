'use client';

import { useCallback, useEffect, useState } from 'react';
import { portalFetch } from '@/lib/portalAuth';
import { ArrowPathIcon, CloudArrowUpIcon } from '@heroicons/react/24/outline';

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

export function LeadSelectionBar({
  selectedCount,
  crmLabel,
  onClear,
  onSync,
  syncing,
}: {
  selectedCount: number;
  crmLabel: string;
  onClear: () => void;
  onSync: (forceResend: boolean) => void;
  syncing: boolean;
}) {
  if (selectedCount === 0) return null;

  return (
    <div className="sticky bottom-4 z-30 mx-auto flex max-w-3xl flex-col gap-2 rounded-xl border border-brand-purple/20 bg-white p-3 shadow-lg sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-medium text-slate-800">
        {selectedCount} lead{selectedCount === 1 ? '' : 's'} geselecteerd
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onClear}
          disabled={syncing}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
        >
          Deselecteer
        </button>
        <button
          type="button"
          onClick={() => onSync(false)}
          disabled={syncing}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-purple px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-purple/90 disabled:opacity-50"
        >
          {syncing ? (
            <ArrowPathIcon className="h-4 w-4 animate-spin" />
          ) : (
            <CloudArrowUpIcon className="h-4 w-4" />
          )}
          {syncing ? 'Bezig…' : `Stuur naar ${crmLabel}`}
        </button>
      </div>
    </div>
  );
}

export function useLeadCrmBackfill(
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void,
) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);

  const toggleLead = useCallback((leadId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(leadId);
      else next.delete(leadId);
      return next;
    });
  }, []);

  const togglePage = useCallback((leadIds: string[], checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of leadIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const runBackfill = useCallback(
    async (crmLabel: string, forceResend = false) => {
      const lead_ids = [...selectedIds];
      if (lead_ids.length === 0) return;
      setSyncing(true);
      try {
        const res = await portalFetch('/api/portal/integrations/sync-leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lead_ids, force_resend: forceResend }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) {
          showToast(d.error || 'Versturen mislukt', 'error');
          return;
        }
        const parts: string[] = [];
        if (d.synced) parts.push(`${d.synced} verstuurd`);
        if (d.skipped) parts.push(`${d.skipped} overgeslagen`);
        if (d.failed) parts.push(`${d.failed} mislukt`);
        showToast(
          parts.length > 0
            ? `${parts.join(', ')} naar ${crmLabel}`
            : `Geen leads verstuurd naar ${crmLabel}`,
          d.failed ? 'error' : 'success',
        );
        if (d.synced > 0) clearSelection();
      } finally {
        setSyncing(false);
      }
    },
    [selectedIds, showToast, clearSelection],
  );

  return {
    selectedIds,
    syncing,
    toggleLead,
    togglePage,
    clearSelection,
    runBackfill,
  };
}
