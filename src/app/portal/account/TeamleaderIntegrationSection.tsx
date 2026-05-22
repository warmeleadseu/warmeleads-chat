'use client';

import { useCallback, useEffect, useState } from 'react';
import { portalFetch } from '@/lib/portalAuth';
import {
  LinkIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PuzzlePieceIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowTopRightOnSquareIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

type SyncRow = {
  id: string;
  lead_name: string | null;
  branch: string | null;
  status: string;
  teamleader_deal_id: string | null;
  error_message: string | null;
  created_at: string;
};

type Pipeline = { id: string; name: string };

type StatusResponse = {
  configured: boolean;
  oauth_source: 'customer' | 'global' | null;
  has_customer_oauth_app: boolean;
  has_global_oauth_app: boolean;
  redirect_uri: string;
  connected: boolean;
  settings: {
    enabled?: boolean;
    pipeline_id?: string | null;
    pipeline_name?: string | null;
    deal_title_template?: string | null;
  } | null;
  success_count: number;
  last_error: string | null;
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

export function TeamleaderIntegrationSection({
  isOwner,
  showToast,
  oauthHint,
  oauthReason,
}: {
  isOwner: boolean;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  oauthHint?: string | null;
  oauthReason?: string | null;
}) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [pipelinesLoading, setPipelinesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [pipelineId, setPipelineId] = useState('');
  const [dealTemplate, setDealTemplate] = useState('');
  const [syncEnabled, setSyncEnabled] = useState(true);

  const [credsOpen, setCredsOpen] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [savingCreds, setSavingCreds] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await portalFetch('/api/portal/integrations/teamleader/status');
      if (res.ok) {
        const d = (await res.json()) as StatusResponse;
        setStatus(d);
        setPipelineId(d.settings?.pipeline_id || '');
        setDealTemplate(
          d.settings?.deal_title_template || 'Warme Leads — {branch_name} — {naam_klant}',
        );
        setSyncEnabled(d.settings?.enabled !== false);
        if (!d.configured) setCredsOpen(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPipelines = useCallback(async () => {
    setPipelinesLoading(true);
    try {
      const res = await portalFetch('/api/portal/integrations/teamleader/pipelines');
      if (res.ok) {
        const d = await res.json();
        setPipelines(d.pipelines || []);
      }
    } finally {
      setPipelinesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOwner) return;
    void loadStatus();
  }, [isOwner, loadStatus]);

  useEffect(() => {
    if (oauthHint === 'connected') {
      showToast('Teamleader succesvol gekoppeld', 'success');
      void loadStatus();
    }
    if (oauthHint === 'error') {
      const reasonLabel = describeOauthError(oauthReason);
      showToast(`Teamleader koppelen mislukt: ${reasonLabel}`, 'error');
    }
  }, [oauthHint, oauthReason, showToast, loadStatus]);

  useEffect(() => {
    if (status?.connected) void loadPipelines();
  }, [status?.connected, loadPipelines]);

  if (!isOwner) return null;

  const connect = () => {
    window.location.href = '/api/portal/integrations/teamleader/connect';
  };

  const disconnect = async () => {
    if (!confirm('Teamleader ontkoppelen? Automatische sync stopt direct.')) return;
    const res = await portalFetch('/api/portal/integrations/teamleader/disconnect', {
      method: 'POST',
    });
    if (res.ok) {
      showToast('Teamleader ontkoppeld');
      await loadStatus();
    } else {
      showToast('Ontkoppelen mislukt', 'error');
    }
  };

  const saveCreds = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      showToast('Vul zowel Client ID als Client Secret in', 'error');
      return;
    }
    setSavingCreds(true);
    try {
      const res = await portalFetch('/api/portal/integrations/teamleader/credentials', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId.trim(),
          client_secret: clientSecret.trim(),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast('Teamleader-app credentials opgeslagen');
        setClientId('');
        setClientSecret('');
        await loadStatus();
      } else {
        showToast(d.error || 'Opslaan mislukt', 'error');
      }
    } finally {
      setSavingCreds(false);
    }
  };

  const removeCreds = async () => {
    if (!confirm('Eigen Teamleader-app credentials verwijderen?')) return;
    const res = await portalFetch('/api/portal/integrations/teamleader/credentials', {
      method: 'DELETE',
    });
    if (res.ok) {
      showToast('Eigen credentials verwijderd');
      await loadStatus();
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const selected = pipelines.find((p) => p.id === pipelineId);
      const res = await portalFetch('/api/portal/integrations/teamleader/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pipeline_id: pipelineId || null,
          pipeline_name: selected?.name ?? null,
          deal_title_template: dealTemplate.trim() || null,
          enabled: syncEnabled,
        }),
      });
      if (res.ok) {
        showToast('Instellingen opgeslagen');
        await loadStatus();
      } else {
        const d = await res.json();
        showToast(d.error || 'Opslaan mislukt', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    setTesting(true);
    try {
      const res = await portalFetch('/api/portal/integrations/teamleader/test', {
        method: 'POST',
      });
      const d = await res.json();
      if (res.ok) showToast('Testdeal aangemaakt in Teamleader');
      else showToast(d.error || 'Test mislukt', 'error');
    } finally {
      setTesting(false);
    }
  };

  const copy = (value: string, key: string) => {
    if (typeof navigator === 'undefined') return;
    navigator.clipboard.writeText(value).then(() => {
      setCopied(key);
      window.setTimeout(() => setCopied(null), 2000);
    });
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-100" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-48 animate-pulse rounded bg-slate-50" />
          </div>
        </div>
        <div className="h-24 animate-pulse rounded-lg bg-slate-50" />
      </div>
    );
  }

  const redirectUri = status?.redirect_uri || '';
  const needsPipeline = status?.connected && !status.settings?.pipeline_id && !pipelineId;
  const syncReady = status?.connected && !!pipelineId && syncEnabled;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-slate-100 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50">
              <PuzzlePieceIcon className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Teamleader Focus</h3>
              <p className="mt-0.5 max-w-prose text-xs leading-relaxed text-slate-500">
                Verbind <strong>jouw eigen</strong> Teamleader-account. Alleen leads die aan jouw portaal
                zijn toegewezen worden als contact + deal doorgestuurd. Warme Leads heeft géén Teamleader
                nodig — jij maakt zelf een gratis private integratie aan in je eigen Teamleader.
              </p>
            </div>
          </div>
          {status?.connected ? (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              <CheckCircleIcon className="h-3.5 w-3.5" />
              Verbonden
            </span>
          ) : status?.has_customer_oauth_app ? (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
              Klaar om te koppelen
            </span>
          ) : (
            <span className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
              Nog niet ingesteld
            </span>
          )}
        </div>
      </div>

      <div className="space-y-5 p-5">
        {/* Stap 1 — eigen Teamleader-app */}
        {!status?.has_customer_oauth_app && (
          <div className="space-y-3 rounded-xl border border-violet-100 bg-violet-50/40 p-4">
            <div className="flex items-start gap-2">
              <InformationCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
              <div>
                <p className="text-sm font-semibold text-slate-900">Stap 1 — Maak een Teamleader-integratie aan</p>
                <p className="mt-1 text-xs text-slate-600">
                  Dit is gratis en gebeurt in je eigen Teamleader Focus. Het kost ongeveer een minuut.
                </p>
              </div>
            </div>

            <ol className="space-y-2 text-sm text-slate-700">
              <li className="flex gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">
                  1
                </span>
                <span>
                  Open{' '}
                  <a
                    href="https://marketplace.focus.teamleader.eu/build"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 font-medium text-violet-700 hover:underline"
                  >
                    Teamleader Marketplace → Build
                    <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                  </a>{' '}
                  en log in met je eigen Teamleader-account.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">
                  2
                </span>
                <span>
                  Klik op <strong>Create integration</strong>, naam: <em>Warme Leads</em>.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">
                  3
                </span>
                <span className="min-w-0">
                  Bij <strong>Redirect URI</strong> exact deze waarde plakken:
                  <div className="mt-2 flex items-start gap-2 rounded-lg border border-violet-200 bg-white p-2">
                    <code className="min-w-0 flex-1 break-all font-mono text-[11px] text-violet-700">
                      {redirectUri}
                    </code>
                    <button
                      type="button"
                      onClick={() => copy(redirectUri, 'redirect')}
                      className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                      aria-label="Kopieer redirect URI"
                    >
                      {copied === 'redirect' ? (
                        <CheckIcon className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <ClipboardDocumentIcon className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">
                  4
                </span>
                <span>
                  Bewaar de integratie en kopieer de <strong>Client ID</strong> en <strong>Client Secret</strong>.
                  Hieronder plak je ze in dit portaal.
                </span>
              </li>
            </ol>
          </div>
        )}

        {/* Credentials form */}
        {(!status?.has_customer_oauth_app || credsOpen) && (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">
                {status?.has_customer_oauth_app
                  ? 'Eigen Teamleader-app credentials bijwerken'
                  : 'Stap 2 — Plak je Client ID en Secret'}
              </p>
              {status?.has_customer_oauth_app && (
                <button
                  type="button"
                  onClick={() => setCredsOpen(false)}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  Verbergen
                </button>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Client ID</label>
              <input
                type="text"
                inputMode="text"
                autoComplete="off"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="bijv. 1a2b3c4d-5e6f-7g8h-9i0j-..."
                className="min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-xs outline-none focus:border-brand-purple/40 focus:ring-2 focus:ring-brand-purple/15"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Client Secret</label>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder="••••••••••••••••"
                  className="min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2.5 pr-11 font-mono text-xs outline-none focus:border-brand-purple/40 focus:ring-2 focus:ring-brand-purple/15"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-2 text-slate-400 hover:text-slate-700"
                  aria-label={showSecret ? 'Secret verbergen' : 'Secret tonen'}
                >
                  {showSecret ? (
                    <EyeSlashIcon className="h-4 w-4" />
                  ) : (
                    <EyeIcon className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Wordt versleuteld opgeslagen. Newlines worden automatisch gestript.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => void saveCreds()}
                disabled={savingCreds || !clientId.trim() || !clientSecret.trim()}
                className="min-h-11 flex-1 rounded-xl bg-brand-purple px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-purple/90 disabled:opacity-50"
              >
                {savingCreds ? 'Opslaan…' : 'Credentials opslaan'}
              </button>
              {status?.has_customer_oauth_app && (
                <button
                  type="button"
                  onClick={() => void removeCreds()}
                  className="min-h-11 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Verwijderen
                </button>
              )}
            </div>
          </div>
        )}

        {status?.has_customer_oauth_app && !credsOpen && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-sm text-emerald-800">
            <span className="flex items-center gap-2">
              <CheckCircleIcon className="h-4 w-4 text-emerald-600" />
              Eigen Teamleader-app credentials zijn opgeslagen.
            </span>
            <button
              type="button"
              onClick={() => setCredsOpen(true)}
              className="text-xs font-medium text-emerald-700 hover:underline"
            >
              Wijzigen
            </button>
          </div>
        )}

        {/* Connect button */}
        {status?.configured && !status.connected && (
          <button
            type="button"
            onClick={connect}
            className="flex min-h-11 w-full items-center justify-center rounded-xl bg-brand-purple px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-purple/90 sm:w-auto sm:px-6"
          >
            Stap 3 — Koppel mijn Teamleader-account
          </button>
        )}

        {/* Connected state */}
        {status?.connected && (
          <>
            {needsPipeline && (
              <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
                <p>Kies een pipeline en sla op — anders worden leads nog niet doorgestuurd.</p>
              </div>
            )}

            {syncReady && (
              <div className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                <CheckCircleIcon className="h-5 w-5 shrink-0" />
                <p>Sync is actief. Nieuwe toewijzingen gaan automatisch naar Teamleader.</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="tl-pipeline"
                  className="mb-1.5 block text-xs font-medium text-slate-700"
                >
                  Pipeline
                </label>
                <select
                  id="tl-pipeline"
                  value={pipelineId}
                  onChange={(e) => setPipelineId(e.target.value)}
                  disabled={pipelinesLoading}
                  className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-purple/40 focus:ring-2 focus:ring-brand-purple/15 disabled:opacity-60"
                >
                  <option value="">{pipelinesLoading ? 'Pipelines laden…' : 'Kies een pipeline…'}</option>
                  {pipelines.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                {status.settings?.pipeline_name && !pipelineId && (
                  <p className="mt-1 text-xs text-slate-400">
                    Opgeslagen: {status.settings.pipeline_name}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="tl-template"
                  className="mb-1.5 block text-xs font-medium text-slate-700"
                >
                  Deal-titel
                </label>
                <input
                  id="tl-template"
                  type="text"
                  value={dealTemplate}
                  onChange={(e) => setDealTemplate(e.target.value)}
                  className="min-h-11 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-purple/40 focus:ring-2 focus:ring-brand-purple/15"
                />
                <p className="mt-1.5 text-xs text-slate-400">
                  Placeholders: <code className="rounded bg-slate-100 px-1">{'{branch_name}'}</code>,{' '}
                  <code className="rounded bg-slate-100 px-1">{'{naam_klant}'}</code>
                </p>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">Automatische sync</p>
                  <p className="text-xs text-slate-500">Pauzeer tijdelijk zonder te ontkoppelen</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={syncEnabled}
                  onClick={() => setSyncEnabled(!syncEnabled)}
                  className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors ${
                    syncEnabled ? 'bg-brand-purple' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-6 w-6 rounded-full bg-white shadow transition-transform ${
                      syncEnabled ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => void saveSettings()}
                disabled={saving || !pipelineId}
                className="min-h-11 flex-1 rounded-xl bg-brand-purple px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 sm:flex-none sm:px-6"
              >
                {saving ? 'Opslaan…' : 'Instellingen opslaan'}
              </button>
              <button
                type="button"
                onClick={() => void runTest()}
                disabled={testing || !pipelineId}
                className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 disabled:opacity-50 sm:flex-none"
              >
                {testing ? 'Testen…' : 'Testdeal'}
              </button>
              <button
                type="button"
                onClick={() => void disconnect()}
                className="min-h-11 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 sm:ml-auto"
              >
                Ontkoppelen
              </button>
            </div>

            {status.last_error && (
              <div className="flex gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-800">
                <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
                <div>
                  <p className="font-medium">Laatste fout</p>
                  <p className="mt-0.5 text-xs leading-relaxed">{status.last_error}</p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{status.success_count} succesvolle sync(s)</span>
              <button
                type="button"
                onClick={() => void loadStatus()}
                className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-slate-600 hover:bg-slate-100"
              >
                <ArrowPathIcon className="h-3.5 w-3.5" />
                Vernieuwen
              </button>
            </div>

            {status.recent_syncs.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Laatste syncs
                </p>
                <div className="hidden overflow-hidden rounded-xl border border-slate-100 md:block">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-3 py-2 font-medium">Lead</th>
                        <th className="px-3 py-2 font-medium">Tijd</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium text-right">Teamleader</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {status.recent_syncs.map((row) => (
                        <tr key={row.id}>
                          <td className="max-w-[140px] truncate px-3 py-2 font-medium text-slate-800">
                            {row.lead_name || '—'}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-500">
                            {formatSyncTime(row.created_at)}
                          </td>
                          <td className="px-3 py-2">
                            <SyncStatusBadge status={row.status} error={row.error_message} />
                          </td>
                          <td className="px-3 py-2 text-right">
                            {row.teamleader_deal_id && (
                              <a
                                href={`https://focus.teamleader.eu/deals/${row.teamleader_deal_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-brand-purple hover:underline"
                              >
                                <LinkIcon className="h-4 w-4" />
                                Deal
                              </a>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="space-y-2 md:hidden">
                  {status.recent_syncs.map((row) => (
                    <div
                      key={row.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {row.lead_name || 'Onbekende lead'}
                        </p>
                        <p className="text-xs text-slate-500">{formatSyncTime(row.created_at)}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <SyncStatusBadge status={row.status} error={row.error_message} />
                        {row.teamleader_deal_id && (
                          <a
                            href={`https://focus.teamleader.eu/deals/${row.teamleader_deal_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-brand-purple"
                          >
                            Open deal
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {status?.oauth_source === 'global' && !status.has_customer_oauth_app && !status.connected && (
          <p className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs text-slate-500">
            Warme Leads heeft een centrale Teamleader-koppeling beschikbaar. Je kunt direct koppelen, of
            kies hierboven voor een eigen Teamleader-integratie.
          </p>
        )}
      </div>
    </div>
  );
}

function describeOauthError(reason?: string | null): string {
  if (!reason) return 'onbekende fout';
  if (reason === 'no_oauth_config') return 'voer eerst je Client ID/Secret in';
  if (reason === 'invalid_state') return 'sessie verlopen — probeer opnieuw';
  if (reason === 'missing_code') return 'Teamleader stuurde geen autorisatiecode terug';
  if (reason === 'access_denied') return 'toestemming in Teamleader geweigerd';
  return reason;
}

function SyncStatusBadge({ status, error }: { status: string; error: string | null }) {
  if (status === 'success') {
    return (
      <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
        OK
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span
        className="inline-flex max-w-[120px] truncate rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700"
        title={error || undefined}
      >
        Fout
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
      Bezig
    </span>
  );
}
