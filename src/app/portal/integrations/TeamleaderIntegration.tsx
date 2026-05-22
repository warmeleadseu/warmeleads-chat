'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { portalFetch } from '@/lib/portalAuth';
import { PortalSection, T } from '../_ui';
import {
  LinkIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowTopRightOnSquareIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { TeamleaderFieldMapping } from './TeamleaderFieldMapping';

type SyncRow = {
  id: string;
  lead_name: string | null;
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
  last_error_at: string | null;
  connected_at: string | null;
  recent_syncs: SyncRow[];
};

const DEFAULT_DEAL_TEMPLATE = 'Warme Leads — {branch_name} — {naam_klant}';
const MARKETPLACE_URL = 'https://marketplace.focus.teamleader.eu/build';

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

type WizardStep = 1 | 2 | 3;

function deriveWizardStep(status: StatusResponse | null): WizardStep {
  if (!status) return 1;
  if (status.connected) return 3;
  if (status.has_customer_oauth_app || (status.configured && status.has_global_oauth_app)) return 2;
  return 1;
}

export function TeamleaderIntegration({
  showToast,
  oauthHint,
  oauthReason,
  embedded = false,
  onHubRefresh,
}: {
  showToast: (msg: string, type?: 'success' | 'error') => void;
  oauthHint?: string | null;
  oauthReason?: string | null;
  /** Geen eigen sectie-header; bedoeld voor CrmIntegrationHub */
  embedded?: boolean;
  /** Stille hub-refresh (geen volledige loading-skeleton). */
  onHubRefresh?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [pipelinesLoading, setPipelinesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [pipelineId, setPipelineId] = useState('');
  const [dealTemplate, setDealTemplate] = useState(DEFAULT_DEAL_TEMPLATE);
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [setupGuideOpen, setSetupGuideOpen] = useState(false);

  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [savingCreds, setSavingCreds] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const hubRefreshRef = useRef(onHubRefresh);
  hubRefreshRef.current = onHubRefresh;

  const loadStatus = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const res = await portalFetch('/api/portal/integrations/teamleader/status');
      if (res.ok) {
        const d = (await res.json()) as StatusResponse;
        setStatus(d);
        setPipelineId(d.settings?.pipeline_id || '');
        setDealTemplate(d.settings?.deal_title_template || DEFAULT_DEAL_TEMPLATE);
        setSyncEnabled(d.settings?.enabled !== false);
        if (!d.has_customer_oauth_app && !d.connected) setSetupGuideOpen(true);
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  const notifyHub = useCallback(() => {
    hubRefreshRef.current?.();
  }, []);

  const loadPipelines = useCallback(
    async (opts: { force?: boolean; silent?: boolean } = {}) => {
      setPipelinesLoading(true);
      try {
        const qs = opts.force ? '?refresh=1' : '';
        const res = await portalFetch(`/api/portal/integrations/teamleader/pipelines${qs}`);
        const d = await res.json().catch(() => ({}));
        if (res.ok) {
          setPipelines(d.pipelines || []);
        } else if (!opts.silent) {
          showToast(d.error || 'Pipelines laden mislukt', 'error');
        }
      } finally {
        setPipelinesLoading(false);
      }
    },
    [showToast],
  );

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!oauthHint) return;
    if (oauthHint === 'connected') {
      showToast('Teamleader is gekoppeld', 'success');
      void loadStatus({ silent: true });
      notifyHub();
    } else if (oauthHint === 'error') {
      showToast(`Koppelen mislukt: ${describeOauthError(oauthReason)}`, 'error');
    }
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('teamleader');
      url.searchParams.delete('reason');
      if (!url.searchParams.has('tab')) url.searchParams.set('tab', 'integraties');
      window.history.replaceState({}, '', url.toString());
    }
  }, [oauthHint, oauthReason, showToast, loadStatus, notifyHub]);

  useEffect(() => {
    if (status?.connected) void loadPipelines({ silent: true });
  }, [status?.connected, loadPipelines]);

  const needsByoaSetup = useMemo(
    () => !status?.has_customer_oauth_app && !status?.has_global_oauth_app,
    [status],
  );

  const canQuickConnect = useMemo(
    () =>
      Boolean(
        status?.configured &&
          !status.connected &&
          status.has_global_oauth_app &&
          !status.has_customer_oauth_app,
      ),
    [status],
  );

  const wizardStep = deriveWizardStep(status);
  const redirectUri = status?.redirect_uri || '';
  const needsPipeline = Boolean(status?.connected && !status.settings?.pipeline_id && !pipelineId);
  const syncActive = Boolean(status?.connected && pipelineId && syncEnabled);

  const connect = () => {
    window.location.href = '/api/portal/integrations/teamleader/connect';
  };

  const disconnect = async () => {
    if (!confirm('Teamleader ontkoppelen? Automatische synchronisatie stopt.')) return;
    const res = await portalFetch('/api/portal/integrations/teamleader/disconnect', {
      method: 'POST',
    });
    if (res.ok) {
      showToast('Teamleader ontkoppeld');
      await loadStatus();
      notifyHub();
    } else {
      showToast('Ontkoppelen mislukt', 'error');
    }
  };

  const saveCreds = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      showToast('Vul Client ID en Client Secret in', 'error');
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
        showToast('API-gegevens opgeslagen');
        setClientId('');
        setClientSecret('');
        setSetupGuideOpen(false);
        await loadStatus();
        notifyHub();
      } else {
        showToast(d.error || 'Opslaan mislukt', 'error');
      }
    } finally {
      setSavingCreds(false);
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
        notifyHub();
      } else {
        const d = await res.json();
        showToast(d.error || 'Opslaan mislukt', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    if (
      !confirm(
        'Er wordt een testcontact en testdeal in Teamleader aangemaakt (gelabeld als [TEST]). Doorgaan?',
      )
    ) {
      return;
    }
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

  const statusBadge = () => {
    if (status?.connected && syncActive) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Actief
        </span>
      );
    }
    if (status?.connected) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
          Configuratie nodig
        </span>
      );
    }
    if (status?.configured && !status.connected) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-800">
          Klaar om te koppelen
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
        Niet gekoppeld
      </span>
    );
  };

  const panel = loading ? (
    <div className="space-y-3">
      <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
      <div className="h-32 animate-pulse rounded-xl bg-slate-50" />
    </div>
  ) : (
    <>
      {!embedded && (
        <div className="mb-4 flex justify-end">{statusBadge()}</div>
      )}

      {!status?.connected && (
        <SetupStepper
          current={wizardStep}
          needsByoa={needsByoaSetup && !canQuickConnect}
          compact={embedded}
        />
      )}

      {/* ── Setup: BYOA ── */}
      {!status?.connected && (needsByoaSetup || (status?.has_customer_oauth_app && setupGuideOpen)) && (
        <div className="mt-5 space-y-4">
          {needsByoaSetup && (
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
            <button
              type="button"
              onClick={() => setSetupGuideOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {embedded ? 'OAuth-app registreren in Teamleader' : 'Stap 1 — App registreren in Teamleader'}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Eenmalig: maak een private integratie aan in je Teamleader-account.
                </p>
              </div>
              <ChevronRightIcon
                className={`h-5 w-5 shrink-0 text-slate-400 transition ${setupGuideOpen ? 'rotate-90' : ''}`}
              />
            </button>

            {setupGuideOpen && (
              <ol className="mt-4 space-y-3 border-t border-slate-200/80 pt-4 text-sm text-slate-700">
                <SetupStep n={1}>
                  Open de{' '}
                  <a
                    href={MARKETPLACE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 font-medium text-brand-purple hover:underline"
                  >
                    Teamleader Marketplace
                    <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                  </a>{' '}
                  en log in met je Teamleader-account.
                </SetupStep>
                <SetupStep n={2}>
                  Maak een nieuwe integratie aan (bijv. naam: <em>Warme Leads Portaal</em>).
                </SetupStep>
                <SetupStep n={3}>
                  <span className="block">Vul bij Redirect URI exact dit adres in:</span>
                  <CopyField value={redirectUri} copied={copied === 'redirect'} onCopy={() => copy(redirectUri, 'redirect')} />
                </SetupStep>
                <SetupStep n={4}>Kopieer de Client ID en Client Secret en vul ze hieronder in.</SetupStep>
              </ol>
            )}
          </div>
          )}

          <div className="space-y-3 rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-900">
              {status?.has_customer_oauth_app ? 'API-gegevens bijwerken' : 'API-gegevens'}
            </p>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Client ID</label>
              <input
                type="text"
                autoComplete="off"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Plak je Client ID"
                className={`${T.input} font-mono text-xs`}
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
                  placeholder="Plak je Client Secret"
                  className={`${T.input} pr-11 font-mono text-xs`}
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:text-slate-700"
                  aria-label={showSecret ? 'Verbergen' : 'Tonen'}
                >
                  {showSecret ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void saveCreds()}
              disabled={savingCreds || !clientId.trim() || !clientSecret.trim()}
              className={`${T.btnPrimary} w-full sm:w-auto`}
            >
              {savingCreds ? 'Opslaan…' : 'Opslaan en doorgaan'}
            </button>
          </div>
        </div>
      )}

      {/* ── Saved credentials (BYOA, not connected) ── */}
      {!status?.connected && status?.has_customer_oauth_app && (
        <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-3">
          <span className="flex items-center gap-2 text-sm text-emerald-800">
            <CheckCircleIcon className="h-4 w-4 text-emerald-600" />
            API-gegevens zijn opgeslagen
          </span>
          <button
            type="button"
            onClick={() => setSetupGuideOpen(true)}
            className="text-xs font-medium text-emerald-700 hover:underline"
          >
            Wijzigen
          </button>
        </div>
      )}

      {/* ── Connect ── */}
      {status?.configured && !status.connected && (
        <div className="mt-5">
          <p className="mb-3 text-sm text-slate-600">
            {canQuickConnect
              ? 'Autoriseer toegang tot je Teamleader-account om de synchronisatie te starten.'
              : 'Autoriseer de koppeling met je Teamleader-account (stap 2).'}
          </p>
          <button type="button" onClick={connect} className={T.btnPrimary}>
            <LinkIcon className="h-4 w-4" />
            Verbinden met Teamleader
          </button>
        </div>
      )}

      {/* ── Connected: settings ── */}
      {status?.connected && (
        <div className="mt-5 space-y-5">
          {needsPipeline && (
            <Alert variant="warning">
              Selecteer een pipeline en sla de instellingen op om synchronisatie te starten.
            </Alert>
          )}
          {syncActive && (
            <Alert variant="success">
              Synchronisatie is actief. Nieuwe leadtoewijzingen worden automatisch doorgestuurd.
            </Alert>
          )}
          {!syncEnabled && (
            <Alert variant="warning">Synchronisatie staat gepauzeerd. Schakel deze weer in om door te sturen.</Alert>
          )}

          <div className="space-y-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label htmlFor="tl-pipeline" className="text-xs font-medium text-slate-700">
                  Pipeline
                </label>
                <button
                  type="button"
                  onClick={() => void loadPipelines({ force: true })}
                  disabled={pipelinesLoading}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 disabled:opacity-50"
                >
                  <ArrowPathIcon className={`h-3.5 w-3.5 ${pipelinesLoading ? 'animate-spin' : ''}`} />
                  Vernieuwen
                </button>
              </div>
              <select
                id="tl-pipeline"
                value={pipelineId}
                onChange={(e) => setPipelineId(e.target.value)}
                disabled={pipelinesLoading}
                className={T.input}
              >
                <option value="">{pipelinesLoading ? 'Laden…' : 'Selecteer pipeline'}</option>
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="tl-template" className="mb-1.5 block text-xs font-medium text-slate-700">
                Deal-titel
              </label>
              <input
                id="tl-template"
                type="text"
                value={dealTemplate}
                onChange={(e) => setDealTemplate(e.target.value)}
                className={T.input}
              />
              <p className={`mt-1.5 ${T.helper}`}>
                Variabelen: {'{branch_name}'}, {'{naam_klant}'}
              </p>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-800">Automatische synchronisatie</p>
                <p className={T.helper}>Tijdelijk pauzeren zonder te ontkoppelen</p>
              </div>
              <Toggle checked={syncEnabled} onChange={setSyncEnabled} />
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => void saveSettings()}
              disabled={saving || !pipelineId}
              className={`${T.btnPrimary} sm:min-w-[140px]`}
            >
              {saving ? 'Opslaan…' : 'Instellingen opslaan'}
            </button>
            <button
              type="button"
              onClick={() => void runTest()}
              disabled={testing || !pipelineId}
              className={T.btnSecondary}
            >
              {testing ? 'Bezig…' : 'Verbinding testen'}
            </button>
            <button type="button" onClick={() => void disconnect()} className={`${T.btnDanger} sm:ml-auto`}>
              Ontkoppelen
            </button>
          </div>

          {status.last_error && (
            <Alert variant="error">
              <span className="font-medium">Laatste fout</span>
              {status.last_error_at && (
                <span className="font-normal text-red-600/80"> · {formatSyncTime(status.last_error_at)}</span>
              )}
              <p className="mt-1 break-words text-xs">{status.last_error}</p>
            </Alert>
          )}

          <TeamleaderFieldMapping
            showToast={showToast}
            connected
            onSaved={notifyHub}
          />

          <SyncHistory
            successCount={status.success_count}
            rows={status.recent_syncs}
            onRefresh={() => void loadStatus()}
          />
        </div>
      )}
    </>
  );

  if (embedded) return panel;

  return (
    <PortalSection
      eyebrow="CRM-koppeling"
      title="Teamleader Focus"
      description="Toegewezen leads worden automatisch als contact en deal in je Teamleader-account geplaatst."
      action={statusBadge()}
    >
      {panel}
    </PortalSection>
  );
}

function SetupStepper({
  current,
  needsByoa,
  compact,
}: {
  current: WizardStep;
  needsByoa: boolean;
  compact?: boolean;
}) {
  const steps = needsByoa
    ? [
        { n: 1 as const, label: 'App registreren' },
        { n: 2 as const, label: 'Autoriseren' },
        { n: 3 as const, label: 'Configureren' },
      ]
    : [
        { n: 2 as const, label: 'Autoriseren' },
        { n: 3 as const, label: 'Configureren' },
      ];

  if (compact) {
    return (
      <div className="mb-4 flex flex-wrap gap-2">
        {steps.map((step) => {
          const done = current > step.n;
          const active = current === step.n;
          return (
            <span
              key={step.n}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                done
                  ? 'bg-emerald-50 text-emerald-700'
                  : active
                    ? 'bg-brand-purple/10 text-brand-purple'
                    : 'bg-slate-100 text-slate-500'
              }`}
            >
              {step.label}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-0">
      {steps.map((step, i) => {
        const done = current > step.n;
        const active = current === step.n;
        return (
          <div key={step.n} className="flex items-center">
            <div
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
                done
                  ? 'bg-emerald-50 text-emerald-700'
                  : active
                    ? 'bg-brand-purple/10 text-brand-purple'
                    : 'bg-slate-100 text-slate-500'
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  done ? 'bg-emerald-500 text-white' : active ? 'bg-brand-purple text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {done ? <CheckIcon className="h-3 w-3" /> : step.n}
              </span>
              {step.label}
            </div>
            {i < steps.length - 1 && (
              <ChevronRightIcon className="mx-1 hidden h-4 w-4 text-slate-300 sm:block" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function SetupStep({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700">
        {n}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </li>
  );
}

function CopyField({
  value,
  copied,
  onCopy,
}: {
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="mt-2 flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-2.5">
      <code className="min-w-0 flex-1 break-all font-mono text-[11px] text-slate-700">{value}</code>
      <button
        type="button"
        onClick={onCopy}
        className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
        aria-label="Kopiëren"
      >
        {copied ? <CheckIcon className="h-4 w-4 text-emerald-500" /> : <ClipboardDocumentIcon className="h-4 w-4" />}
      </button>
    </div>
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
    <div className="border-t border-slate-100 pt-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Synchronisatiehistorie</p>
        <button type="button" onClick={onRefresh} className={T.btnGhost}>
          <ArrowPathIcon className="h-3.5 w-3.5" />
          Vernieuwen
        </button>
      </div>
      <p className="mb-3 text-xs text-slate-500">{successCount} geslaagde synchronisatie(s)</p>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
          Nog geen synchronisaties
        </p>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-slate-100 md:block">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Lead</th>
                  <th className="px-3 py-2.5 font-medium">Datum</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 text-right font-medium">Deal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="max-w-[160px] truncate px-3 py-2.5 font-medium text-slate-800">
                      {row.lead_name || '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">
                      {formatSyncTime(row.created_at)}
                    </td>
                    <td className="px-3 py-2.5">
                      <SyncStatusBadge status={row.status} error={row.error_message} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {row.teamleader_deal_id && (
                        <a
                          href={`https://focus.teamleader.eu/deals/${row.teamleader_deal_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-brand-purple hover:underline"
                        >
                          Openen
                          <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 md:hidden">
            {rows.map((row) => (
              <div key={row.id} className="rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{row.lead_name || 'Lead'}</p>
                    <p className="text-xs text-slate-500">{formatSyncTime(row.created_at)}</p>
                  </div>
                  <SyncStatusBadge status={row.status} error={row.error_message} />
                </div>
                {row.status === 'failed' && row.error_message && (
                  <p className="mt-2 break-words text-xs text-red-600">{row.error_message}</p>
                )}
                {row.teamleader_deal_id && (
                  <a
                    href={`https://focus.teamleader.eu/deals/${row.teamleader_deal_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-purple"
                  >
                    Deal in Teamleader
                    <ArrowTopRightOnSquareIcon className="h-3 w-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function describeOauthError(reason?: string | null): string {
  if (!reason) return 'onbekende fout';
  if (reason === 'no_oauth_config') return 'stel eerst je API-gegevens in';
  if (reason === 'invalid_state') return 'sessie verlopen, probeer opnieuw';
  if (reason === 'missing_code') return 'autorisatie niet voltooid';
  if (reason === 'access_denied') return 'toegang geweigerd in Teamleader';
  if (/invalid_client/i.test(reason)) return 'Client ID of Secret onjuist';
  if (/invalid_grant/i.test(reason)) return 'autorisatie verlopen, koppel opnieuw';
  if (/redirect/i.test(reason)) return 'Redirect URI komt niet overeen';
  return reason;
}

function SyncStatusBadge({ status, error }: { status: string; error: string | null }) {
  if (status === 'success') {
    return (
      <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
        Geslaagd
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span
        className="inline-flex max-w-[100px] truncate rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700"
        title={error || undefined}
      >
        Mislukt
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Bezig</span>
  );
}
