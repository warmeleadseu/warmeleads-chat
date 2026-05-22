'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { portalFetch } from '@/lib/portalAuth';
import { T } from '../_ui';
import {
  LinkIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline';
import { GoogleSheetsFieldMapping } from './GoogleSheetsFieldMapping';

type SyncRow = {
  id: string;
  lead_name: string | null;
  status: string;
  sheet_range: string | null;
  error_message: string | null;
  created_at: string;
};

type StatusResponse = {
  oauth_configured: boolean;
  api_key_configured?: boolean;
  server_ready?: boolean;
  connected: boolean;
  spreadsheet_configured: boolean;
  field_mapping_configured: boolean;
  sync_ready: boolean;
  settings: {
    enabled?: boolean;
    spreadsheet_url?: string | null;
    sheet_name?: string | null;
    sheet_gid?: number | null;
  } | null;
  success_count: number;
  last_error: string | null;
  last_error_at: string | null;
  recent_syncs: SyncRow[];
};

function formatSyncTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('nl-NL', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function GoogleSheetsIntegration({
  showToast,
  oauthHint,
  oauthReason,
  embedded = false,
  onHubRefresh,
}: {
  showToast: (msg: string, type?: 'success' | 'error') => void;
  oauthHint?: string | null;
  oauthReason?: string | null;
  embedded?: boolean;
  /** Stille hub-refresh (geen volledige loading-skeleton). */
  onHubRefresh?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState('');
  const [sheetTabs, setSheetTabs] = useState<Array<{ sheet_id: number; title: string }>>([]);
  const [selectedSheetId, setSelectedSheetId] = useState<number | ''>('');
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncEnabled, setSyncEnabled] = useState(true);

  const hubRefreshRef = useRef(onHubRefresh);
  hubRefreshRef.current = onHubRefresh;

  const loadStatus = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const res = await portalFetch('/api/portal/integrations/google-sheets/status');
      if (res.ok) {
        const d = (await res.json()) as StatusResponse;
        setStatus(d);
        setSpreadsheetUrl(d.settings?.spreadsheet_url || '');
        setSyncEnabled(d.settings?.enabled !== false);
        if (d.settings?.sheet_gid != null) {
          setSelectedSheetId(d.settings.sheet_gid);
        }
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  const notifyHub = useCallback(() => {
    hubRefreshRef.current?.();
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!oauthHint) return;
    if (oauthHint === 'connected') {
      showToast('Google-account gekoppeld', 'success');
      void loadStatus({ silent: true });
      notifyHub();
    } else if (oauthHint === 'error') {
      showToast(`Koppelen mislukt: ${describeOauthError(oauthReason)}`, 'error');
    }
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('sheets');
      url.searchParams.delete('sheets_reason');
      url.searchParams.delete('reason');
      if (!url.searchParams.has('tab')) url.searchParams.set('tab', 'integraties');
      window.history.replaceState({}, '', url.toString());
    }
  }, [oauthHint, oauthReason, showToast, loadStatus, notifyHub]);

  const connectGoogle = () => {
    window.location.href = '/api/portal/integrations/google-sheets/connect';
  };

  const disconnect = async () => {
    if (!confirm('Google Sheets ontkoppelen? Automatische synchronisatie stopt.')) return;
    const res = await portalFetch('/api/portal/integrations/google-sheets/disconnect', {
      method: 'POST',
    });
    if (res.ok) {
      showToast('Google Sheets ontkoppeld');
      await loadStatus();
      notifyHub();
    } else {
      showToast('Ontkoppelen mislukt', 'error');
    }
  };

  const loadSpreadsheet = async () => {
    if (!spreadsheetUrl.trim()) {
      showToast('Vul een spreadsheet-URL in', 'error');
      return;
    }
    setLoadingSheet(true);
    try {
      const res = await portalFetch('/api/portal/integrations/google-sheets/spreadsheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheet_url: spreadsheetUrl.trim(),
          sheet_gid: selectedSheetId === '' ? undefined : selectedSheetId,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(d.error || 'Spreadsheet laden mislukt', 'error');
        return;
      }
      setSheetTabs(d.tabs || []);
      if (d.sheet_gid != null) setSelectedSheetId(d.sheet_gid);
      showToast(`Spreadsheet geladen — ${d.columns?.length ?? 0} kolommen gevonden`);
    } finally {
      setLoadingSheet(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await portalFetch('/api/portal/integrations/google-sheets/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheet_url: spreadsheetUrl.trim(),
          sheet_gid: selectedSheetId === '' ? null : selectedSheetId,
          enabled: syncEnabled,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast('Spreadsheet opgeslagen');
        await loadStatus();
        notifyHub();
      } else {
        showToast(d.error || 'Opslaan mislukt', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    if (
      !confirm(
        'Er wordt een testrij onderaan je spreadsheet geplaatst (met [TEST] in de eerste kolom). Doorgaan?',
      )
    ) {
      return;
    }
    setTesting(true);
    try {
      const res = await portalFetch('/api/portal/integrations/google-sheets/test', {
        method: 'POST',
      });
      const d = await res.json();
      if (res.ok) showToast('Testrij toegevoegd aan je spreadsheet');
      else showToast(d.error || 'Test mislukt', 'error');
    } finally {
      setTesting(false);
    }
  };

  const spreadsheetReady = Boolean(status?.spreadsheet_configured);
  const mappingReady = Boolean(status?.field_mapping_configured);

  const panel = loading ? (
    <div className="space-y-3">
      <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
      <div className="h-32 animate-pulse rounded-xl bg-slate-50" />
    </div>
  ) : (
    <div className="space-y-5">
      {status?.api_key_configured === false && (
        <Alert variant="warning">
          De Google Sheets API-key ontbreekt op de server. Neem contact op met Warme Leads.
        </Alert>
      )}

      {!status?.oauth_configured && (
        <Alert variant="warning">
          Google OAuth (Client ID + secret) is nog niet geconfigureerd. Maak in Google Cloud een OAuth-client
          (Web application) met redirect{' '}
          <span className="font-mono text-[11px]">…/api/portal/integrations/google-sheets/callback</span>.
        </Alert>
      )}

      {!status?.connected && (
        <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
          <p className="text-sm font-semibold text-slate-900">Stap 2 — Google-account autoriseren</p>
          <p className="mt-1 text-xs text-slate-500">
            Geef toegang om rijen toe te voegen in spreadsheets waar jij toegang toe hebt.
          </p>
          <button
            type="button"
            onClick={connectGoogle}
            disabled={status?.server_ready === false}
            className={`${T.btnPrimary} mt-4`}
          >
            <LinkIcon className="h-4 w-4" />
            Verbinden met Google
          </button>
        </div>
      )}

      {status?.connected && (
        <>
          <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 text-sm text-emerald-800">
            <CheckCircleIcon className="h-4 w-4 shrink-0 text-emerald-600" />
            Google-account is gekoppeld
          </div>

          <div className="space-y-4 rounded-xl border border-slate-100 p-4">
            <div className="flex items-center gap-2">
              <TableCellsIcon className="h-5 w-5 text-slate-400" />
              <p className="text-sm font-semibold text-slate-900">Stap 3 — Spreadsheet kiezen</p>
            </div>
            <p className="text-xs text-slate-500">
              Plak de URL van je Google Spreadsheet. Rij 1 moet kolomkoppen bevatten.
            </p>
            <div>
              <label htmlFor="gs-url" className="mb-1 block text-xs font-medium text-slate-600">
                Spreadsheet-URL
              </label>
              <input
                id="gs-url"
                type="url"
                value={spreadsheetUrl}
                onChange={(e) => setSpreadsheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className={T.input}
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => void loadSpreadsheet()}
                disabled={loadingSheet || !spreadsheetUrl.trim()}
                className={T.btnSecondary}
              >
                {loadingSheet ? 'Laden…' : 'Kolommen uitlezen'}
              </button>
              <button
                type="button"
                onClick={() => void saveSettings()}
                disabled={saving || !spreadsheetUrl.trim()}
                className={T.btnPrimary}
              >
                {saving ? 'Opslaan…' : 'Spreadsheet opslaan'}
              </button>
            </div>

            {sheetTabs.length > 1 && (
              <div>
                <label htmlFor="gs-tab" className="mb-1 block text-xs font-medium text-slate-600">
                  Werkblad
                </label>
                <select
                  id="gs-tab"
                  value={selectedSheetId}
                  onChange={(e) =>
                    setSelectedSheetId(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className={T.input}
                >
                  {sheetTabs.map((t) => (
                    <option key={t.sheet_id} value={t.sheet_id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {status.settings?.sheet_name && (
              <p className="text-xs text-slate-500">
                Actief werkblad: <span className="font-medium">{status.settings.sheet_name}</span>
              </p>
            )}
          </div>

          {spreadsheetReady && (
            <GoogleSheetsFieldMapping
              showToast={showToast}
              ready={spreadsheetReady}
              onSaved={() => {
                void loadStatus({ silent: true });
                notifyHub();
              }}
            />
          )}

          {spreadsheetReady && mappingReady && (
            <div className="space-y-4 border-t border-slate-100 pt-5">
              {status.sync_ready && (
                <Alert variant="success">
                  Synchronisatie is actief. Nieuwe leadtoewijzingen worden als rij toegevoegd.
                </Alert>
              )}
              {!syncEnabled && (
                <Alert variant="warning">
                  Synchronisatie staat gepauzeerd. Schakel deze weer in om door te sturen.
                </Alert>
              )}

              <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">Automatische synchronisatie</p>
                  <p className={T.helper}>Tijdelijk pauzeren zonder te ontkoppelen</p>
                </div>
                <Toggle checked={syncEnabled} onChange={setSyncEnabled} />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => void saveSettings()}
                  disabled={saving}
                  className={T.btnPrimary}
                >
                  {saving ? 'Opslaan…' : 'Instellingen opslaan'}
                </button>
                <button
                  type="button"
                  onClick={() => void runTest()}
                  disabled={testing}
                  className={T.btnSecondary}
                >
                  {testing ? 'Bezig…' : 'Testrij toevoegen'}
                </button>
                <button
                  type="button"
                  onClick={() => void disconnect()}
                  className={`${T.btnDanger} sm:ml-auto`}
                >
                  Ontkoppelen
                </button>
              </div>

              {status.last_error && (
                <Alert variant="error">
                  <span className="font-medium">Laatste fout</span>
                  {status.last_error_at && (
                    <span className="font-normal text-red-600/80">
                      {' '}
                      · {formatSyncTime(status.last_error_at)}
                    </span>
                  )}
                  <p className="mt-1 break-words text-xs">{status.last_error}</p>
                </Alert>
              )}

              <SyncHistory
                successCount={status.success_count}
                rows={status.recent_syncs}
                onRefresh={() => void loadStatus()}
              />
            </div>
          )}
        </>
      )}
    </div>
  );

  if (embedded) return panel;

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">{panel}</div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-brand-purple' : 'bg-slate-300'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

function Alert({
  variant,
  children,
}: {
  variant: 'success' | 'warning' | 'error';
  children: ReactNode;
}) {
  const styles = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    error: 'border-red-200 bg-red-50 text-red-900',
  };
  const Icon = variant === 'success' ? CheckCircleIcon : ExclamationTriangleIcon;
  return (
    <div className={`flex gap-2.5 rounded-xl border p-3.5 text-sm ${styles[variant]}`}>
      <Icon className="h-5 w-5 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function SyncHistory({
  successCount,
  rows,
  onRefresh,
}: {
  successCount: number;
  rows: SyncRow[];
  onRefresh: () => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Synchronisatiehistorie
        </p>
        <button type="button" onClick={onRefresh} className={T.btnGhost}>
          <ArrowPathIcon className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="mb-3 text-xs text-slate-500">{successCount} geslaagde synchronisatie(s)</p>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">
          Nog geen synchronisaties
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2.5 text-xs"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-800">{row.lead_name || 'Lead'}</p>
                <p className="text-slate-500">{formatSyncTime(row.created_at)}</p>
                {row.status === 'failed' && row.error_message && (
                  <p className="mt-1 text-red-600">{row.error_message}</p>
                )}
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 font-medium ${
                  row.status === 'success'
                    ? 'bg-emerald-50 text-emerald-700'
                    : row.status === 'failed'
                      ? 'bg-red-50 text-red-700'
                      : 'bg-slate-100 text-slate-500'
                }`}
              >
                {row.status === 'success' ? 'OK' : row.status === 'failed' ? 'Fout' : '…'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function describeOauthError(reason?: string | null): string {
  if (!reason) return 'onbekende fout';
  if (reason === 'no_api_key') return 'Google Sheets API-key ontbreekt op de server';
  if (reason === 'no_oauth_config') return 'Google OAuth is niet geconfigureerd';
  if (reason === 'invalid_state') return 'sessie verlopen, probeer opnieuw';
  if (reason === 'token_exchange_failed') return 'token uitwisselen mislukt — probeer opnieuw';
  if (reason === 'missing_code') return 'autorisatie niet voltooid';
  if (reason === 'access_denied') return 'toegang geweigerd in Google';
  if (reason === 'missing_refresh_token') return 'geen refresh token — probeer opnieuw en accepteer alle rechten';
  return reason.length > 120 ? `${reason.slice(0, 120)}…` : reason;
}
