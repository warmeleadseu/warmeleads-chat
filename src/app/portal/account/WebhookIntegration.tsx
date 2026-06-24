'use client';

import { useCallback, useEffect, useState } from 'react';
import { LockClosedIcon, BoltIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { portalFetch } from '@/lib/portalAuth';
import { PortalSection, T } from '../_ui';

type SourceField = { key: string; defaultTarget: string; label: string };
type FieldMapping = { source: string; target: string; enabled: boolean };

type WebhookConfig = {
  enabled: boolean;
  url: string;
  branches: string[];
  has_token: boolean;
  token_hint: string | null;
  sync_ready: boolean;
  available_branches: string[];
  available_fields: SourceField[];
  field_mappings: FieldMapping[];
  last_delivery: { status: string; at: string; error: string | null } | null;
};

const BRANCH_LABELS: Record<string, string> = {
  isolatie: 'Isolatie',
  thuisbatterij: 'Thuisbatterij',
  airco: 'Airco',
  zonnepanelen: 'Zonnepanelen',
  warmtepomp: 'Warmtepomp',
};

function branchLabel(slug: string): string {
  return BRANCH_LABELS[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1);
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('nl-NL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function WebhookIntegration({
  isOwner,
  showToast,
}: {
  isOwner: boolean;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [config, setConfig] = useState<WebhookConfig | null>(null);

  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [branches, setBranches] = useState<string[]>([]);
  const [fields, setFields] = useState<SourceField[]>([]);
  const [mappings, setMappings] = useState<Record<string, { target: string; enabled: boolean }>>(
    {},
  );

  const applyConfig = useCallback((c: WebhookConfig) => {
    setConfig(c);
    setUrl(c.url);
    setBranches(c.branches);
    setFields(c.available_fields ?? []);
    const map: Record<string, { target: string; enabled: boolean }> = {};
    for (const m of c.field_mappings ?? []) map[m.source] = { target: m.target, enabled: m.enabled };
    setMappings(map);
    setToken('');
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await portalFetch('/api/portal/integrations/webhook');
      if (res.ok) {
        applyConfig((await res.json()) as WebhookConfig);
      } else {
        const d = await res.json().catch(() => ({}));
        showToast((d as { error?: string }).error || 'Webhook laden mislukt', 'error');
      }
    } catch {
      showToast('Webhook laden mislukt', 'error');
    } finally {
      setLoading(false);
    }
  }, [applyConfig, showToast]);

  useEffect(() => {
    if (isOwner) void load();
    else setLoading(false);
  }, [isOwner, load]);

  const toggleBranch = (slug: string) => {
    setBranches((prev) =>
      prev.includes(slug) ? prev.filter((b) => b !== slug) : [...prev, slug],
    );
  };

  const toggleField = (key: string, defaultTarget: string) => {
    setMappings((prev) => {
      const cur = prev[key] ?? { target: defaultTarget, enabled: false };
      return { ...prev, [key]: { ...cur, enabled: !cur.enabled } };
    });
  };

  const setFieldTarget = (key: string, target: string) => {
    setMappings((prev) => {
      const cur = prev[key] ?? { target: '', enabled: true };
      return { ...prev, [key]: { ...cur, target } };
    });
  };

  const save = async (nextEnabled?: boolean) => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        url,
        branches,
        field_mappings: fields.map((f) => {
          const m = mappings[f.key] ?? { target: f.defaultTarget, enabled: false };
          return {
            source: f.key,
            target: m.target.trim() || f.defaultTarget,
            enabled: m.enabled,
          };
        }),
      };
      if (token.trim().length > 0) body.token = token.trim();
      if (typeof nextEnabled === 'boolean') body.enabled = nextEnabled;

      const res = await portalFetch('/api/portal/integrations/webhook', {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        applyConfig(d as WebhookConfig);
        showToast('Webhook-instellingen opgeslagen');
      } else {
        showToast((d as { error?: string }).error || 'Opslaan mislukt', 'error');
      }
    } catch {
      showToast('Opslaan mislukt', 'error');
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    setTesting(true);
    try {
      const body: Record<string, unknown> = {};
      if (url.trim()) body.url = url.trim();
      if (token.trim()) body.token = token.trim();
      const res = await portalFetch('/api/portal/integrations/webhook/test', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const d = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        status?: number;
        error?: string;
      };
      if (res.ok && d.ok) {
        showToast(`Test geslaagd (HTTP ${d.status})`);
      } else {
        showToast(d.error || `Test mislukt${d.status ? ` (HTTP ${d.status})` : ''}`, 'error');
      }
    } catch {
      showToast('Test mislukt', 'error');
    } finally {
      setTesting(false);
    }
  };

  if (!isOwner) {
    return (
      <PortalSection
        title="Geen toegang"
        description="Alleen de accounteigenaar kan de webhook-koppeling beheren."
      >
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <LockClosedIcon className="h-6 w-6 text-slate-400" />
          </div>
          <p className="max-w-sm text-sm text-slate-600">
            Vraag de eigenaar van dit account om de webhook in te stellen.
          </p>
        </div>
      </PortalSection>
    );
  }

  if (loading) {
    return (
      <PortalSection eyebrow="Koppeling" title="Lead-webhook">
        <div className="space-y-3">
          <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-32 animate-pulse rounded-xl bg-slate-50" />
        </div>
      </PortalSection>
    );
  }

  const enabled = config?.enabled ?? false;
  const availableBranches = config?.available_branches ?? [];

  const statusBadge = enabled ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Actief
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
      Uitgeschakeld
    </span>
  );

  return (
    <PortalSection
      eyebrow="Koppeling"
      title="Lead-webhook"
      description="Stuur elke nieuwe toegewezen lead automatisch als JSON naar je eigen endpoint."
      action={statusBadge}
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
          <BoltIcon className="h-5 w-5 shrink-0 text-brand-purple" />
          <p className="text-xs text-slate-500">
            Wij doen een <code className="rounded bg-slate-200/70 px-1">POST</code> met JSON naar
            jouw URL. Vul je token alleen in als jouw endpoint een{' '}
            <code className="rounded bg-slate-200/70 px-1">Authorization: Bearer</code>-header
            vereist (Softr-workflows bijvoorbeeld niet). Mislukte afleveringen worden automatisch
            opnieuw geprobeerd.
          </p>
        </div>

        <div>
          <label htmlFor="webhook-url" className="mb-1.5 block text-xs font-medium text-slate-700">
            Webhook-URL
          </label>
          <input
            id="webhook-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://jouwdomein.nl/api/leads"
            className={T.input}
          />
        </div>

        <div>
          <label htmlFor="webhook-token" className="mb-1.5 block text-xs font-medium text-slate-700">
            Bearer-token <span className="font-normal text-slate-400">(optioneel)</span>
          </label>
          <input
            id="webhook-token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={
              config?.has_token
                ? `Token ingesteld (${config.token_hint}) — laat leeg om te behouden`
                : 'Leeg laten als je endpoint geen token vereist'
            }
            autoComplete="off"
            className={T.input}
          />
        </div>

        {availableBranches.length > 0 && (
          <div>
            <p className="mb-1.5 block text-xs font-medium text-slate-700">Branches</p>
            <p className="mb-2 text-[11px] text-slate-400">
              Laat alles uit om álle branches te versturen.
            </p>
            <div className="flex flex-wrap gap-2">
              {availableBranches.map((slug) => {
                const active = branches.includes(slug);
                return (
                  <button
                    key={slug}
                    type="button"
                    onClick={() => toggleBranch(slug)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border-2 px-3 py-2 text-sm font-semibold transition ${
                      active
                        ? 'border-brand-purple bg-brand-purple/5 text-brand-purple'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {active && <CheckCircleIcon className="h-4 w-4" />}
                    {branchLabel(slug)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {fields.length > 0 && (
          <div>
            <p className="mb-1.5 block text-xs font-medium text-slate-700">Velden &amp; JSON-keys</p>
            <p className="mb-2 text-[11px] text-slate-400">
              Vink aan welke gegevens we sturen en bepaal de veldnaam (JSON-key) die jouw systeem
              verwacht.
            </p>
            <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
              {fields.map((f) => {
                const m = mappings[f.key] ?? { target: f.defaultTarget, enabled: false };
                return (
                  <div key={f.key} className="flex items-center gap-3 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={m.enabled}
                      onChange={() => toggleField(f.key, f.defaultTarget)}
                      className="h-4 w-4 shrink-0 rounded border-slate-300 text-brand-purple focus:ring-brand-purple"
                    />
                    <span className="w-36 shrink-0 truncate text-sm text-slate-700 sm:w-44">
                      {f.label}
                    </span>
                    <input
                      type="text"
                      value={m.target}
                      onChange={(e) => setFieldTarget(f.key, e.target.value)}
                      disabled={!m.enabled}
                      placeholder={f.defaultTarget}
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-sm text-slate-900 outline-none transition focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/20 disabled:bg-slate-50 disabled:text-slate-400"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {config?.last_delivery && (
          <div className="rounded-xl border border-slate-100 bg-white px-4 py-3 text-xs">
            <span className="font-medium text-slate-700">Laatste aflevering: </span>
            <span
              className={
                config.last_delivery.status === 'success'
                  ? 'text-emerald-600'
                  : config.last_delivery.status === 'failed'
                    ? 'text-red-600'
                    : 'text-slate-500'
              }
            >
              {config.last_delivery.status}
            </span>
            <span className="text-slate-400"> · {formatDateTime(config.last_delivery.at)}</span>
            {config.last_delivery.error && (
              <p className="mt-1 text-[11px] text-red-500">{config.last_delivery.error}</p>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className={T.btnPrimary}
          >
            {saving ? 'Bezig…' : 'Opslaan'}
          </button>
          <button
            type="button"
            onClick={() => void runTest()}
            disabled={testing}
            className={T.btnSecondary}
          >
            {testing ? 'Testen…' : 'Test versturen'}
          </button>
          {enabled ? (
            <button
              type="button"
              onClick={() => void save(false)}
              disabled={saving}
              className={`${T.btnGhost} ml-auto`}
            >
              Uitschakelen
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void save(true)}
              disabled={saving}
              className={`${T.btnSecondary} ml-auto`}
            >
              Inschakelen
            </button>
          )}
        </div>
      </div>
    </PortalSection>
  );
}
