'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdmin } from '../adminContext';
import { adminFetch } from '@/lib/adminAuth';
import {
  PlusIcon,
  TrashIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  LinkIcon,
  BoltIcon,
  XMarkIcon,
  ChevronRightIcon,
  SignalIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  DocumentDuplicateIcon,
  InformationCircleIcon,
  SparklesIcon,
  CurrencyEuroIcon,
  EyeIcon,
  EyeSlashIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

interface WebhookKey {
  id: string; key: string; label: string; branch: string; customer_id: string;
  customers?: { id: string; name: string } | null;
  is_active: boolean; last_used_at: string | null; request_count: number; created_at: string;
}
interface BranchFieldConfig { id: string; key: string; label: string; field_type: string; options: string[]; is_required: boolean; sort_order: number; }
interface BranchConfig { id: string; slug: string; name: string; color: string; is_active: boolean; branch_fields: BranchFieldConfig[]; }

const BRANCH_COLOR_MAP: Record<string, { light: string; text: string }> = {
  emerald: { light: 'bg-emerald-50', text: 'text-emerald-600' },
  sky: { light: 'bg-sky-50', text: 'text-sky-600' },
  amber: { light: 'bg-amber-50', text: 'text-amber-600' },
  purple: { light: 'bg-purple-50', text: 'text-purple-600' },
  rose: { light: 'bg-rose-50', text: 'text-rose-600' },
  cyan: { light: 'bg-cyan-50', text: 'text-cyan-600' },
  lime: { light: 'bg-lime-50', text: 'text-lime-600' },
  indigo: { light: 'bg-indigo-50', text: 'text-indigo-600' },
  teal: { light: 'bg-teal-50', text: 'text-teal-600' },
  slate: { light: 'bg-slate-50', text: 'text-slate-600' },
};

export default function KoppelingenPage() {
  const { user } = useAdmin();
  const [keys, setKeys] = useState<WebhookKey[]>([]);
  const [branchesList, setBranchesList] = useState<BranchConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [activeInstructions, setActiveInstructions] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);
  const [activeBackfill, setActiveBackfill] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [keysRes, branchRes] = await Promise.all([
      adminFetch('/api/admin/webhook/keys'),
      adminFetch('/api/admin/branches'),
    ]);
    if (keysRes.ok) { const d = await keysRes.json(); setKeys(d.keys || []); }
    if (branchRes.ok) { const d = await branchRes.json(); setBranchesList(d.branches || []); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const deleteKey = async (id: string, label: string) => {
    if (!confirm(`Koppeling "${label}" verwijderen? De Zapier zap zal dan stoppen met werken.`)) return;
    await adminFetch('/api/admin/webhook/keys', { method: 'DELETE', body: JSON.stringify({ id }) });
    fetchData();
  };

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/admin/webhook/leads` : '';

  const getTimeSince = (date: string | null) => {
    if (!date) return null;
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m geleden`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}u geleden`;
    const days = Math.floor(hours / 24);
    return `${days}d geleden`;
  };

  const testWebhookFromPanel = async (keyId: string) => {
    setTesting(keyId);
    setTestResult(null);
    try {
      const res = await adminFetch('/api/admin/webhook/test', {
        method: 'POST',
        body: JSON.stringify({ key_id: keyId }),
      });
      const data = await res.json();
      const result = { id: keyId, success: data.success, message: data.success ? data.message : data.error };
      setTestResult(result);
      if (data.success) {
        fetchData();
        setTimeout(() => {
          setActiveInstructions(null);
          setTimeout(() => setTestResult(null), 500);
        }, 2500);
      }
    } catch {
      setTestResult({ id: keyId, success: false, message: 'Test mislukt. Probeer het opnieuw.' });
    }
    setTesting(null);
  };

  const onCreated = (keyId: string) => {
    setShowWizard(false);
    fetchData();
    setActiveInstructions(keyId);
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Koppelingen</h1>
          <p className="mt-0.5 text-sm text-slate-500">Verbind je Zapier zaps om leads automatisch binnen te krijgen</p>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-button-gradient px-3.5 py-2 text-sm font-bold text-white shadow-sm"
        >
          <PlusIcon className="h-4 w-4" /> Nieuwe koppeling
        </button>
      </div>

      {/* Info banner */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
        <InformationCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />
        <div className="text-sm text-blue-800">
          <p className="font-medium">Hoe werkt het?</p>
          <p className="mt-0.5 text-blue-600">
            Maak per branche/campagne een koppeling aan. Leads worden automatisch verdeeld naar klanten
            met een actieve batch via het distributiesysteem. Je krijgt een stap-voor-stap handleiding om je Zapier zap in te stellen.
          </p>
        </div>
      </div>

      {/* Koppelingen grid */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <div className="h-4 w-36 animate-pulse rounded bg-slate-100" />
                  <div className="mt-2 h-3 w-24 animate-pulse rounded bg-slate-50" />
                </div>
                <div className="h-5 w-14 animate-pulse rounded-full bg-slate-100" />
              </div>
              <div className="mt-4 h-3 w-28 animate-pulse rounded bg-slate-50" />
            </div>
          ))}
        </div>
      ) : keys.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <LinkIcon className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="font-medium text-slate-600">Nog geen koppelingen</p>
          <p className="mt-1 text-sm text-slate-400">Maak je eerste koppeling aan om leads automatisch te ontvangen.</p>
          <button
            onClick={() => setShowWizard(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-button-gradient px-4 py-2 text-sm font-bold text-white shadow-sm"
          >
            <PlusIcon className="h-4 w-4" /> Eerste koppeling aanmaken
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {keys.map(k => {
            const hasLeads = k.request_count > 0;
            const isRecent = k.last_used_at && (Date.now() - new Date(k.last_used_at).getTime()) < 7 * 24 * 60 * 60 * 1000;
            const statusLabel = hasLeads ? 'Actief' : 'Nieuw';
            const statusColor = hasLeads
              ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
              : 'bg-amber-50 text-amber-600 border-amber-200';
            const dotColor = isRecent ? 'bg-emerald-400' : hasLeads ? 'bg-emerald-400' : 'bg-amber-400';

            return (
              <div key={k.id} className="group rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
                <div className="p-5">
                  {/* Header */}
                  <div className="mb-3 flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
                        <h3 className="truncate text-sm font-semibold text-slate-900">{k.label}</h3>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusColor}`}>
                        {statusLabel}
                      </span>
                      {(() => {
                        const bc = branchesList.find(b => b.slug === k.branch);
                        const c = BRANCH_COLOR_MAP[bc?.color || 'slate'] || BRANCH_COLOR_MAP.slate;
                        return (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${c.light} ${c.text}`}>
                            {bc?.name || k.branch}
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="mb-4 flex items-center gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <SignalIcon className="h-3 w-3" />
                      {k.request_count} leads ontvangen
                    </span>
                    {k.last_used_at && (
                      <span>Laatst: {getTimeSince(k.last_used_at)}</span>
                    )}
                  </div>

                  {/* Test result (shown on card only when instructions panel is closed) */}
                  <AnimatePresence>
                    {testResult?.id === k.id && activeInstructions !== k.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mb-3 overflow-hidden"
                      >
                        <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
                          testResult.success
                            ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border border-red-200 bg-red-50 text-red-700'
                        }`}>
                          {testResult.success
                            ? <CheckCircleIcon className="h-4 w-4" />
                            : <ExclamationTriangleIcon className="h-4 w-4" />
                          }
                          {testResult.message}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Actions */}
                <div className="flex items-center border-t border-slate-100">
                  <button
                    onClick={() => setActiveInstructions(activeInstructions === k.id ? null : k.id)}
                    className="flex flex-1 items-center justify-center gap-1.5 py-3.5 text-sm font-medium text-brand-purple transition hover:bg-brand-purple/5"
                  >
                    <DocumentDuplicateIcon className="h-4 w-4" />
                    {hasLeads ? 'Instructies' : 'Instellen'}
                  </button>
                  <div className="h-8 w-px bg-slate-100" />
                  <button
                    onClick={() => setActiveBackfill(activeBackfill === k.id ? null : k.id)}
                    className="flex flex-1 items-center justify-center gap-1.5 py-3.5 text-sm font-medium text-amber-600 transition hover:bg-amber-50"
                  >
                    <ClockIcon className="h-4 w-4" />
                    Historisch
                  </button>
                  <div className="h-8 w-px bg-slate-100" />
                  <button
                    onClick={() => testWebhookFromPanel(k.id)}
                    disabled={testing === k.id}
                    className="flex flex-1 items-center justify-center gap-1.5 py-3.5 text-sm font-medium text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50"
                  >
                    {testing === k.id ? (
                      <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    ) : (
                      <BoltIcon className="h-4 w-4" />
                    )}
                    Test
                  </button>
                  <div className="h-8 w-px bg-slate-100" />
                  <button
                    onClick={() => deleteKey(k.id, k.label)}
                    className="flex items-center justify-center px-5 py-3.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Instructions slide-over */}
      <AnimatePresence>
        {activeInstructions && (() => {
          const k = keys.find(x => x.id === activeInstructions);
          if (!k) return null;
          return (
            <InstructionsPanel
              webhookKey={k}
              webhookUrl={webhookUrl}
              copied={copied}
              onCopy={copy}
              onClose={() => setActiveInstructions(null)}
              onTest={() => testWebhookFromPanel(k.id)}
              testing={testing === k.id}
              testResult={testResult?.id === k.id ? testResult : null}
              branchesList={branchesList}
            />
          );
        })()}
      </AnimatePresence>

      {/* Backfill panel */}
      <AnimatePresence>
        {activeBackfill && (() => {
          const k = keys.find(x => x.id === activeBackfill);
          if (!k) return null;
          return (
            <BackfillPanel
              webhookKey={k}
              branchesList={branchesList}
              onClose={() => setActiveBackfill(null)}
              onDone={() => { setActiveBackfill(null); fetchData(); }}
            />
          );
        })()}
      </AnimatePresence>

      {/* Meta Ads koppeling */}
      <MetaAdsSection />

      <TeamleaderOAuthSection />

      {/* Admin account */}
      <div className="mt-10 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Admin account</h2>
        <div className="grid gap-2 text-sm sm:grid-cols-3">
          <div><span className="text-slate-500">Naam:</span> <span className="font-medium text-slate-800">{user.name}</span></div>
          <div><span className="text-slate-500">E-mail:</span> <span className="font-medium text-slate-800">{user.email}</span></div>
          <div><span className="text-slate-500">Rol:</span> <span className="font-medium capitalize text-slate-800">{user.role}</span></div>
        </div>
      </div>

      {/* Wizard modal */}
      <AnimatePresence>
        {showWizard && (
          <CreateWizard
            branchesList={branchesList}
            onClose={() => setShowWizard(false)}
            onCreated={onCreated}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ───────── Teamleader OAuth (Warme Leads-app, klanten koppelen zelf) ───────── */

function TeamleaderOAuthSection() {
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [redirectUri, setRedirectUri] = useState('');
  const [status, setStatus] = useState<{
    configured: boolean;
    redirect_uri: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/admin/integrations/teamleader/status');
      if (res.ok) setStatus(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { void fetchStatus(); }, [fetchStatus]);

  const save = async () => {
    if (!clientId && !clientSecret && !redirectUri) return;
    setSaving(true);
    setSaved(false);
    try {
      const tasks: Promise<Response>[] = [];
      if (clientId.trim()) {
        tasks.push(
          adminFetch('/api/admin/settings', {
            method: 'PUT',
            body: JSON.stringify({ key: 'teamleader_client_id', value: clientId.trim() }),
          }),
        );
      }
      if (clientSecret.trim()) {
        tasks.push(
          adminFetch('/api/admin/settings', {
            method: 'PUT',
            body: JSON.stringify({ key: 'teamleader_client_secret', value: clientSecret.trim() }),
          }),
        );
      }
      if (redirectUri.trim()) {
        tasks.push(
          adminFetch('/api/admin/settings', {
            method: 'PUT',
            body: JSON.stringify({ key: 'teamleader_redirect_uri', value: redirectUri.trim() }),
          }),
        );
      }
      await Promise.all(tasks);
      setClientId('');
      setClientSecret('');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      fetchStatus();
    } catch { /* ignore */ }
    setSaving(false);
  };

  const prodCallback =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/portal/integrations/teamleader/callback`
      : 'https://warmeleads.eu/api/portal/integrations/teamleader/callback';

  return (
    <div className="mt-10 rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50">
            <LinkIcon className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Teamleader Focus (klantportaal)</h2>
            <p className="text-xs text-slate-500">
              Eén OAuth-app voor Warme Leads — klanten koppelen hun eigen Teamleader-account in het portaal
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4 text-sm text-blue-900">
          <p className="font-medium">Hoe het werkt</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-blue-800">
            <li>
              Maak <strong>één</strong> integratie op{' '}
              <a
                href="https://marketplace.focus.teamleader.eu/build"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline"
              >
                Teamleader Marketplace
              </a>{' '}
              (naam: Warme Leads).
            </li>
            <li>
              Whitelist deze redirect URI (exact, geen spaties/newlines):{' '}
              <code className="mt-1 block break-all rounded bg-white px-2 py-1 font-mono text-[11px] text-violet-700">
                {prodCallback}
              </code>
            </li>
            <li>Plak hieronder de Client ID en Client Secret van die app (één keer).</li>
            <li>
              Klanten (bijv. Sergio) gaan in het portaal → Account → <strong>Koppel Teamleader</strong> — hun
              tokens worden per klant opgeslagen; jij hoeft geen IDs per klant te beheren.
            </li>
          </ol>
        </div>

        {loading ? (
          <div className="h-20 animate-pulse rounded-lg bg-slate-50" />
        ) : status?.configured ? (
          <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
            <div className="text-sm">
              <p className="font-medium text-emerald-800">OAuth-app geconfigureerd</p>
              <p className="mt-0.5 break-all text-xs text-emerald-700">
                Redirect: {status.redirect_uri || prodCallback}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <InformationCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <p className="text-sm text-amber-800">
              Nog geen credentials. Zonder Client ID/Secret kunnen klanten Teamleader nog niet koppelen in het portaal.
            </p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-500">Client ID</label>
            <input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder={status?.configured ? 'Laat leeg om niet te wijzigen' : 'Van Marketplace-buildpagina'}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/20"
              autoComplete="off"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-500">Client Secret</label>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder={status?.configured ? '••••••••' : 'Geheim van Marketplace'}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 pr-10 text-sm outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/20"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
              >
                {showSecret ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Redirect URI (optioneel; default = productie-URL hierboven)
            </label>
            <input
              value={redirectUri}
              onChange={(e) => setRedirectUri(e.target.value)}
              placeholder={status?.redirect_uri || prodCallback}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 font-mono text-xs outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/20"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || (!clientId.trim() && !clientSecret.trim() && !redirectUri.trim())}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-button-gradient px-4 py-2 text-sm font-bold text-white shadow-sm disabled:opacity-50"
        >
          {saving ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : null}
          {saved ? 'Opgeslagen!' : 'Credentials opslaan'}
        </button>
      </div>
    </div>
  );
}

/* ───────── Meta Ads Connection ───────── */

function MetaAdsSection() {
  const [token, setToken] = useState('');
  const [adAccountId, setAdAccountId] = useState('');
  const [status, setStatus] = useState<{ configured: boolean; tokenValid?: boolean; tokenName?: string; tokenError?: string; adAccountId?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ ok: boolean; adRowsSynced?: number; leadsUpdated?: number; errors?: string[] } | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/admin/meta-sync');
      if (res.ok) setStatus(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const saveCredentials = async () => {
    if (!token && !adAccountId) return;
    setSaving(true);
    setSaved(false);
    try {
      const promises: Promise<Response>[] = [];
      if (token) {
        promises.push(adminFetch('/api/admin/settings', {
          method: 'PUT', body: JSON.stringify({ key: 'meta_access_token', value: token }),
        }));
      }
      if (adAccountId) {
        promises.push(adminFetch('/api/admin/settings', {
          method: 'PUT', body: JSON.stringify({ key: 'meta_ad_account_id', value: adAccountId }),
        }));
      }
      await Promise.all(promises);
      setToken('');
      setAdAccountId('');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      fetchStatus();
    } catch { /* ignore */ }
    setSaving(false);
  };

  const runSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await adminFetch('/api/admin/meta-sync', {
        method: 'POST',
        body: JSON.stringify({ days: 7 }),
      });
      const data = await res.json();
      setSyncResult(data);
      fetchStatus();
    } catch {
      setSyncResult({ ok: false, errors: ['Sync mislukt. Probeer het opnieuw.'] });
    }
    setSyncing(false);
  };

  return (
    <div className="mt-10 rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
            <CurrencyEuroIcon className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Meta Ads: Leadkosten</h2>
            <p className="text-xs text-slate-500">Koppel je Meta ad account om automatisch CPL per lead te berekenen</p>
          </div>
        </div>
      </div>

      <div className="p-5">
        {/* Status */}
        {loading ? (
          <div className="space-y-3">
            <div className="h-4 w-48 animate-pulse rounded bg-slate-100" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-slate-50" />
          </div>
        ) : (
          <>
            {/* Connection status */}
            {status?.configured ? (
              <div className={`mb-4 flex items-start gap-3 rounded-lg border p-3 ${
                status.tokenValid
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-red-200 bg-red-50'
              }`}>
                {status.tokenValid ? (
                  <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                ) : (
                  <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
                )}
                <div className="text-sm">
                  {status.tokenValid ? (
                    <>
                      <p className="font-medium text-emerald-700">Verbonden met Meta</p>
                      <p className="text-xs text-emerald-600">
                        Account: {status.tokenName || '-'} &middot; Ad Account: {status.adAccountId}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-red-700">Token ongeldig of verlopen</p>
                      <p className="text-xs text-red-600">{status.tokenError}</p>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <InformationCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                <div className="text-sm">
                  <p className="font-medium text-amber-700">Nog niet geconfigureerd</p>
                  <p className="text-xs text-amber-600">
                    Vul je Meta access token en ad account ID in om leadkosten automatisch te synchen.
                  </p>
                </div>
              </div>
            )}

            {/* Credentials form */}
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Meta Access Token (System User)</label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={token}
                    onChange={e => setToken(e.target.value)}
                    placeholder={status?.configured ? '••••••••••••••••••••' : 'Plak je token hier...'}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 pr-10 text-sm text-slate-900 outline-none transition focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
                  >
                    {showToken ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Ad Account ID</label>
                <input
                  value={adAccountId}
                  onChange={e => setAdAccountId(e.target.value)}
                  placeholder={status?.configured ? (status.adAccountId || 'act_123456789') : 'act_123456789'}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/20"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={saveCredentials}
                  disabled={saving || (!token && !adAccountId)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-button-gradient px-4 py-2 text-sm font-bold text-white shadow-sm disabled:opacity-50"
                >
                  {saving ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : null}
                  {saved ? 'Opgeslagen!' : 'Opslaan'}
                </button>

                {status?.configured && status?.tokenValid && (
                  <button
                    onClick={runSync}
                    disabled={syncing}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    <ArrowPathIcon className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? 'Syncing...' : 'Nu synchroniseren (7 dagen)'}
                  </button>
                )}
              </div>
            </div>

            {/* Sync result */}
            <AnimatePresence>
              {syncResult && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className={`mt-3 rounded-lg border p-3 text-sm ${syncResult.ok ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                    {syncResult.ok ? (
                      <div>
                        <p className="font-medium text-emerald-700">Sync voltooid</p>
                        <p className="text-xs text-emerald-600">
                          {syncResult.adRowsSynced} advertentierijen gesynct &middot; {syncResult.leadsUpdated} leads bijgewerkt met kosten
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium text-red-700">Sync mislukt</p>
                        {syncResult.errors?.map((e, i) => (
                          <p key={i} className="text-xs text-red-600">{e}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Info */}
            <div className="mt-4 rounded-lg bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-500">Hoe werkt het?</p>
              <ul className="mt-1 space-y-0.5 text-xs text-slate-400">
                <li>1. De campagne-kosten worden 4x per dag opgehaald uit Meta (09:00, 12:00, 15:00, 16:00)</li>
                <li>2. Bruto CPL = totale campagne-spend / aantal leads in ons CRM</li>
                <li>3. Effectieve CPL = spend / netto-toewijzingen. <strong>Goedgekeurde reclamaties</strong> tellen niet als netto-levering (de Meta-spend blijft volledig staan en we leveren een gratis vervanglead), dus eff. CPL is altijd ≥ bruto CPL × gem. toewijzingen.</li>
                <li>4. Stuur vanuit Zapier de velden <code className="rounded bg-white px-1 py-0.5 font-mono text-brand-purple">campaign_id</code>, <code className="rounded bg-white px-1 py-0.5 font-mono text-brand-purple">adset_id</code> en <code className="rounded bg-white px-1 py-0.5 font-mono text-brand-purple">ad_id</code> mee</li>
                <li>5. Kosten tellen pas mee vanaf de activatiedatum van de eerste batch per branche</li>
                <li>6. De AI optimizer pauzeert/scaleert ads op de <strong>netto</strong>-CPL — slechte kwaliteit (veel reclamaties) wordt automatisch afgestraft.</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ───────── Instructions Panel (slide-over) ───────── */

function InstructionsPanel({
  webhookKey,
  webhookUrl,
  copied,
  onCopy,
  onClose,
  onTest,
  testing,
  testResult,
  branchesList,
}: {
  webhookKey: WebhookKey;
  webhookUrl: string;
  copied: string | null;
  onCopy: (text: string, id: string) => void;
  onClose: () => void;
  onTest: () => void;
  testing: boolean;
  testResult: { id: string; success: boolean; message: string } | null;
  branchesList: BranchConfig[];
}) {
  const branchConfig = branchesList.find(b => b.slug === webhookKey.branch);
  const branchFields = branchConfig?.branch_fields || [];
  const fields = [
    { key: 'naam_klant', label: 'Naam klant', required: true },
    { key: 'email', label: 'E-mailadres', required: false },
    { key: 'telefoonnummer', label: 'Telefoonnummer', required: false },
    { key: 'postcode', label: 'Postcode', required: false },
    { key: 'huisnummer', label: 'Huisnummer', required: false },
    { key: 'plaatsnaam', label: 'Plaatsnaam', required: false },
    { key: 'provincie', label: 'Provincie', required: false },
    ...branchFields.map(f => ({ key: f.key, label: f.label, required: f.is_required })),
    { key: 'ad_id', label: 'Meta Ad ID (voor leadkosten)', required: false },
    { key: 'adset_id', label: 'Meta Adset ID', required: false },
    { key: 'campaign_id', label: 'Meta Campaign ID', required: false },
  ];

  const copyAll = () => {
    const branchName = branchesList.find(b => b.slug === webhookKey.branch)?.name || webhookKey.branch;
    const lines = [
      '=== ZAPIER KOPPELING ===',
      `Koppeling: ${webhookKey.label}`,
      `Branche: ${branchName}`,
      '',
      '--- STAP 2: Webhook URL ---',
      webhookUrl,
      '',
      '--- STAP 3: Header ---',
      `Key: X-API-Key`,
      `Value: ${webhookKey.key}`,
      '',
      '--- STAP 4: Velden ---',
      ...fields.map(f => `${f.label}: ${f.key}${f.required ? ' (verplicht)' : ''}`),
    ];
    onCopy(lines.join('\n'), `all-${webhookKey.id}`);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-lg flex-col bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="shrink-0 border-b border-slate-100 bg-white">
          <div className="h-[3px] bg-warmeleads-gradient" />
          <div className="flex items-center justify-between px-5 py-4 sm:px-6">
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-slate-900 sm:text-lg">Zapier instellen</h2>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-medium text-slate-700">{webhookKey.label}</span>
                <span className="text-slate-300">&middot;</span>
                {(() => {
                  const bc = branchesList.find(b => b.slug === webhookKey.branch);
                  const c = BRANCH_COLOR_MAP[bc?.color || 'slate'] || BRANCH_COLOR_MAP.slate;
                  return (
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${c.light} ${c.text}`}>
                      {bc?.name || webhookKey.branch}
                    </span>
                  );
                })()}
              </div>
            </div>
            <div className="ml-3 flex shrink-0 items-center gap-2">
              <button
                onClick={copyAll}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
              >
                {copied === `all-${webhookKey.id}` ? (
                  <><CheckIcon className="h-3.5 w-3.5 text-emerald-500" /> Gekopieerd</>
                ) : (
                  <><ClipboardDocumentIcon className="h-3.5 w-3.5" /> Kopieer alles</>
                )}
              </button>
              <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-6 px-5 py-5 sm:px-6">

            {/* Step 1 */}
            <StepBlock step={1} title="Voeg een actie toe in je Zap">
              <p className="text-sm text-slate-600">
                Zoek naar <span className="font-semibold text-slate-800">&quot;Webhooks by Zapier&quot;</span> en kies <span className="font-semibold text-slate-800">&quot;POST&quot;</span> als actie.
              </p>
            </StepBlock>

            {/* Step 2 */}
            <StepBlock step={2} title="Plak deze URL">
              <p className="mb-2 text-sm text-slate-600">Vul dit in bij het veld &quot;URL&quot; in Zapier:</p>
              <CopyField value={webhookUrl} id={`url-${webhookKey.id}`} copied={copied} onCopy={onCopy} />
            </StepBlock>

            {/* Step 3 */}
            <StepBlock step={3} title="Voeg deze header toe">
              <p className="mb-3 text-sm text-slate-600">
                Scroll in Zapier naar &quot;Headers&quot; en voeg deze key + value toe:
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-500">Key</p>
                  <CopyField value="X-API-Key" id={`hkey-${webhookKey.id}`} copied={copied} onCopy={onCopy} />
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-500">Value</p>
                  <CopyField value={webhookKey.key} id={`hval-${webhookKey.id}`} copied={copied} onCopy={onCopy} mono />
                </div>
              </div>
            </StepBlock>

            {/* Step 4 */}
            <StepBlock step={4} title={'Map deze velden bij "Data"'}>
              <p className="mb-3 text-sm text-slate-600">
                Vul in Zapier onder &quot;Data&quot; links de <span className="font-semibold text-slate-800">key</span> in en rechts de bijbehorende waarde uit je trigger.
              </p>
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_32px] border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                  <span>Zapier key</span>
                  <span>Omschrijving</span>
                  <span />
                </div>
                <div className="divide-y divide-slate-50">
                  {fields.map(f => (
                    <div key={f.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_32px] items-center px-3 py-2">
                      <code className="break-all text-xs font-mono text-brand-purple">{f.key}</code>
                      <span className="text-xs text-slate-600">
                        {f.label}
                        {f.required && <span className="ml-1 text-red-400">*</span>}
                      </span>
                      <button
                        onClick={() => onCopy(f.key, `field-${webhookKey.id}-${f.key}`)}
                        className="flex h-7 w-7 items-center justify-center rounded text-slate-300 transition hover:bg-slate-50 hover:text-slate-500"
                      >
                        {copied === `field-${webhookKey.id}-${f.key}` ? (
                          <CheckIcon className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <ClipboardDocumentIcon className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                * = verplicht veld. Overige velden zijn optioneel. Stuur alleen wat je hebt.
              </p>
            </StepBlock>

            {/* Step 5: Test */}
            <div className="rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/50 p-5">
              <div className="mb-1.5 flex items-center gap-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">5</span>
                <p className="text-sm font-bold text-slate-900">Test de verbinding</p>
              </div>
              <p className="mb-4 ml-[34px] text-sm text-slate-600">
                Klaar met instellen? Test hier of alles goed werkt. Er wordt een test-lead aangemaakt die je daarna kunt verwijderen.
              </p>

              <div className="ml-[34px]">
                <AnimatePresence mode="wait">
                  {testResult?.success ? (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                    >
                      <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                        <CheckCircleIcon className="h-5 w-5 shrink-0 text-emerald-500" />
                        <div>
                          <p className="text-sm font-semibold text-emerald-700">Verbinding werkt!</p>
                          <p className="text-xs text-emerald-600">{testResult.message}. Dit venster sluit automatisch.</p>
                        </div>
                      </div>
                    </motion.div>
                  ) : testResult && !testResult.success ? (
                    <motion.div
                      key="error"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="space-y-3"
                    >
                      <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                        <ExclamationTriangleIcon className="h-5 w-5 shrink-0 text-red-400" />
                        <div>
                          <p className="text-sm font-semibold text-red-700">Test mislukt</p>
                          <p className="text-xs text-red-600">{testResult.message}</p>
                        </div>
                      </div>
                      <button
                        onClick={onTest}
                        disabled={testing}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        <ArrowPathIcon className={`h-3.5 w-3.5 ${testing ? 'animate-spin' : ''}`} />
                        Opnieuw testen
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div key="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <button
                        onClick={onTest}
                        disabled={testing}
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-50"
                      >
                        {testing ? (
                          <ArrowPathIcon className="h-4 w-4 animate-spin" />
                        ) : (
                          <BoltIcon className="h-4 w-4" />
                        )}
                        {testing ? 'Testen...' : 'Test verbinding'}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

          </div>
        </div>
      </motion.div>
    </>
  );
}

/* ───────── Step Block ───────── */

function StepBlock({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-purple text-xs font-bold text-white">{step}</span>
        <p className="text-sm font-bold text-slate-900">{title}</p>
      </div>
      <div className="ml-[34px]">{children}</div>
    </div>
  );
}

/* ───────── Copy Field ───────── */

function CopyField({
  value,
  id,
  copied,
  onCopy,
  mono,
}: {
  value: string;
  id: string;
  copied: string | null;
  onCopy: (text: string, id: string) => void;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
      <span className={`min-w-0 flex-1 break-all text-sm text-slate-800 ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </span>
      <button
        onClick={() => onCopy(value, id)}
        className="mt-0.5 shrink-0 rounded p-1 text-slate-400 transition hover:bg-white hover:text-brand-purple"
      >
        {copied === id ? (
          <CheckIcon className="h-4 w-4 text-emerald-500" />
        ) : (
          <ClipboardDocumentIcon className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}

/* ───────── Create Wizard ───────── */

function CreateWizard({
  branchesList,
  onClose,
  onCreated,
}: {
  branchesList: BranchConfig[];
  onClose: () => void;
  onCreated: (keyId: string) => void;
}) {
  const [step, setStep] = useState(1);
  const [branch, setBranch] = useState('');
  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const activeBranches = branchesList.filter(b => b.is_active);
  const selectedBranch = branchesList.find(b => b.slug === branch);

  const create = async () => {
    if (!label || !branch) return;
    setCreating(true);
    setError('');
    try {
      const res = await adminFetch('/api/admin/webhook/keys', {
        method: 'POST',
        body: JSON.stringify({ label, branch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Aanmaken mislukt');
      onCreated(data.webhook_key.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Aanmaken mislukt');
    }
    setCreating(false);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="fixed inset-x-4 top-[10vh] z-[60] mx-auto max-w-lg rounded-2xl bg-white shadow-2xl sm:inset-x-auto"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Nieuwe koppeling</h2>
            <p className="text-xs text-slate-500">Stap {step} van 2</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-1 px-6 pt-4">
          {[1, 2].map(s => (
            <div key={s} className={`h-1 flex-1 rounded-full transition ${s <= step ? 'bg-brand-purple' : 'bg-slate-200'}`} />
          ))}
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>
          )}

          {step === 1 && (
            <div>
              <h3 className="mb-1 text-sm font-semibold text-slate-800">Voor welke branche is deze koppeling?</h3>
              <p className="mb-4 text-xs text-slate-500">Leads die binnenkomen worden als deze branche opgeslagen en automatisch verdeeld naar klanten met een actieve batch.</p>
              {activeBranches.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 py-8 text-center">
                  <BoltIcon className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                  <p className="text-sm text-slate-500">Maak eerst een branche aan via &quot;Branches&quot;.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeBranches.map(b => {
                    const bc = BRANCH_COLOR_MAP[b.color] || BRANCH_COLOR_MAP.slate;
                    return (
                      <button
                        key={b.slug}
                        onClick={() => {
                          setBranch(b.slug);
                          setLabel(`${b.name}`);
                          setStep(2);
                        }}
                        className={`flex w-full items-center justify-between rounded-xl border px-4 py-3.5 text-left transition ${
                          branch === b.slug
                            ? 'border-brand-purple/30 bg-brand-purple/5'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${bc.light}`}>
                            <BoltIcon className={`h-4 w-4 ${bc.text}`} />
                          </div>
                          <span className="text-sm font-medium text-slate-800">{b.name}</span>
                        </div>
                        <ChevronRightIcon className="h-4 w-4 text-slate-400" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <h3 className="mb-1 text-sm font-semibold text-slate-800">Geef de koppeling een naam</h3>
              <p className="mb-4 text-xs text-slate-500">Bijvoorbeeld de campagne of het kanaal (bijv. &quot;Facebook - Thuisbatterij NL&quot;).</p>

              <input
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="Bijv. Facebook - Thuisbatterij NL"
                className="mb-4 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/20"
                autoFocus
              />

              <div className="mb-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Samenvatting</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Branche</span>
                    <span className="font-medium text-slate-800">{selectedBranch?.name || branch}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Distributie</span>
                    <span className="text-xs text-slate-600">Automatisch naar klanten met actieve batch</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
                  Terug
                </button>
                <button
                  onClick={create}
                  disabled={creating || !label}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-button-gradient py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {creating ? (
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  ) : (
                    <SparklesIcon className="h-4 w-4" />
                  )}
                  {creating ? 'Aanmaken...' : 'Koppeling aanmaken'}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}

/* ─── Backfill Panel ─────────────────────────────────────────── */
interface MetaForm { id: string; name: string; status: string }
interface BackfillResult { ok: boolean; fetched: number; imported: number; skipped: number; errors: number; error?: string; permissionError?: boolean; errorDetails?: string[] }
interface BackfillRun { id: string; count: number; branch: string; form_id: string; form_name: string; date_from: string | null; date_to: string | null; imported_at: string }
interface PreviewField { meta_name: string; sample_value: string; suggested: string }
interface CrmFieldOption { key: string; label: string }

function BackfillPanel({
  webhookKey,
  branchesList,
  onClose,
  onDone,
}: {
  webhookKey: WebhookKey;
  branchesList: BranchConfig[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [forms, setForms] = useState<MetaForm[]>([]);
  const [loadingForms, setLoadingForms] = useState(true);
  const [formsError, setFormsError] = useState('');
  const [selectedForm, setSelectedForm] = useState('');
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0]; });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);

  // Step 2: mapping
  type Step = 'select' | 'mapping' | 'importing' | 'done';
  const [step, setStep] = useState<Step>('select');
  const [previewFields, setPreviewFields] = useState<PreviewField[]>([]);
  const [standardCrmFields, setStandardCrmFields] = useState<CrmFieldOption[]>([]);
  const [customCrmFields, setCustomCrmFields] = useState<CrmFieldOption[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  // Step 3: import
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BackfillResult | null>(null);

  // History
  const [history, setHistory] = useState<BackfillRun[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [undoing, setUndoing] = useState<string | null>(null);

  const fetchHistory = useCallback(() => {
    setLoadingHistory(true);
    adminFetch(`/api/admin/backfill?webhook_key_id=${encodeURIComponent(webhookKey.id)}&branch=${encodeURIComponent(webhookKey.branch)}`)
      .then(r => r.json())
      .then(d => setHistory(d.runs || []))
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [webhookKey.id, webhookKey.branch]);

  useEffect(() => {
    setLoadingForms(true);
    setFormsError('');
    adminFetch(`/api/admin/meta-forms?branch=${encodeURIComponent(webhookKey.branch)}`)
      .then(r => r.json())
      .then(d => { if (d.error) setFormsError(d.error); else setForms(d.forms || []); })
      .catch(() => setFormsError('Kon formulieren niet ophalen'))
      .finally(() => setLoadingForms(false));
    fetchHistory();
  }, [fetchHistory]);

  const branchName = branchesList.find(b => b.slug === webhookKey.branch)?.name || webhookKey.branch;

  const loadPreview = async () => {
    if (!selectedForm) return;
    setPreviewLoading(true);
    setPreviewError('');
    try {
      const res = await adminFetch('/api/admin/backfill', {
        method: 'POST',
        body: JSON.stringify({ form_id: selectedForm, branch: webhookKey.branch, date_from: dateFrom, date_to: dateTo, preview: true }),
      });
      const data = await res.json();
      if (data.error) { setPreviewError(data.error); setPreviewLoading(false); return; }
      setPreviewFields(data.fields || []);
      setStandardCrmFields(data.standard_crm_fields || []);
      setCustomCrmFields(data.custom_crm_fields || []);
      const initialMapping: Record<string, string> = {};
      for (const f of data.fields || []) {
        initialMapping[f.meta_name] = f.suggested || '';
      }
      setFieldMapping(initialMapping);
      setStep('mapping');
    } catch { setPreviewError('Kon preview niet laden'); }
    setPreviewLoading(false);
  };

  const runImport = async () => {
    setRunning(true);
    setResult(null);
    setStep('importing');
    try {
      const res = await adminFetch('/api/admin/backfill', {
        method: 'POST',
        body: JSON.stringify({
          form_id: selectedForm, branch: webhookKey.branch,
          date_from: dateFrom, date_to: dateTo,
          webhook_key_id: webhookKey.id, field_mapping: fieldMapping,
        }),
      });
      const data = await res.json();
      setResult(data);
      setStep('done');
      if (data.ok && data.imported > 0) { fetchHistory(); setTimeout(onDone, 3000); }
    } catch {
      setResult({ ok: false, fetched: 0, imported: 0, skipped: 0, errors: 1, error: 'Verzoek mislukt' });
      setStep('done');
    }
    setRunning(false);
  };

  const allCrmOptions = useMemo(() => {
    const opts = [...standardCrmFields];
    if (customCrmFields.length > 0) {
      opts.push({ key: '_divider', label: '── Branche velden ──' });
      opts.push(...customCrmFields);
    }
    return opts;
  }, [standardCrmFields, customCrmFields]);

  const canGoBack = step === 'mapping' || step === 'done';

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-md flex-col bg-white shadow-2xl"
      >
        <div className="shrink-0 border-b border-slate-100">
          <div className="h-[3px] bg-warmeleads-gradient" />
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              {canGoBack && (
                <button onClick={() => { setStep('select'); setResult(null); }} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                </button>
              )}
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {step === 'mapping' ? 'Veld mapping' : step === 'importing' ? 'Importeren...' : 'Historische leads ophalen'}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">{webhookKey.label} &middot; {branchName}</p>
              </div>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          {/* Step indicator */}
          <div className="flex border-t border-slate-50 px-5 py-2">
            {['Selecteer', 'Mapping', 'Importeren'].map((label, i) => {
              const active = (step === 'select' && i === 0) || (step === 'mapping' && i === 1) || ((step === 'importing' || step === 'done') && i === 2);
              const done = (i === 0 && step !== 'select') || (i === 1 && (step === 'importing' || step === 'done'));
              return (
                <div key={label} className="flex flex-1 items-center gap-1.5">
                  <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${done ? 'bg-emerald-500 text-white' : active ? 'bg-brand-purple text-white' : 'bg-slate-100 text-slate-400'}`}>
                    {done ? '✓' : i + 1}
                  </div>
                  <span className={`text-[11px] font-medium ${active || done ? 'text-slate-700' : 'text-slate-400'}`}>{label}</span>
                  {i < 2 && <div className={`mx-1 h-px flex-1 ${done ? 'bg-emerald-300' : 'bg-slate-100'}`} />}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* ═══ STEP 1: Select form + dates ═══ */}
          {step === 'select' && (
            <>
              <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3">
                <p className="text-xs text-blue-700">
                  Selecteer een formulier en periode. Daarna kun je de veldmapping controleren voordat de leads worden geïmporteerd.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Facebook Lead Formulier</label>
                {loadingForms ? (
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-400">
                    <ArrowPathIcon className="h-4 w-4 animate-spin" /> Formulieren ophalen uit Meta...
                  </div>
                ) : formsError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">{formsError}</div>
                ) : forms.length === 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
                    Geen lead formulieren gevonden. Zorg dat er actieve Lead Ads draaien.
                  </div>
                ) : (
                  <select value={selectedForm} onChange={e => setSelectedForm(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/30">
                    <option value="">Selecteer een formulier...</option>
                    {forms.map(f => <option key={f.id} value={f.id}>{f.name} ({f.id})</option>)}
                  </select>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Periode</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-500">Van</label>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} max={dateTo}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/30" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-500">Tot en met</label>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} min={dateFrom} max={new Date().toISOString().split('T')[0]}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple/30" />
                  </div>
                </div>
                <div className="mt-2 flex gap-1.5">
                  {[
                    { label: 'Gisteren', fn: () => { const d = new Date(); d.setDate(d.getDate() - 1); const s = d.toISOString().split('T')[0]; setDateFrom(s); setDateTo(s); } },
                    { label: '7 dagen', fn: () => { const d = new Date(); d.setDate(d.getDate() - 7); setDateFrom(d.toISOString().split('T')[0]); setDateTo(new Date().toISOString().split('T')[0]); } },
                    { label: '14 dagen', fn: () => { const d = new Date(); d.setDate(d.getDate() - 14); setDateFrom(d.toISOString().split('T')[0]); setDateTo(new Date().toISOString().split('T')[0]); } },
                    { label: '30 dagen', fn: () => { const d = new Date(); d.setDate(d.getDate() - 30); setDateFrom(d.toISOString().split('T')[0]); setDateTo(new Date().toISOString().split('T')[0]); } },
                  ].map(q => (
                    <button key={q.label} onClick={q.fn}
                      className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-500 transition hover:border-brand-purple hover:bg-brand-purple/5 hover:text-brand-purple">
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>

              {previewError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{previewError}</div>
              )}

              <button onClick={loadPreview}
                disabled={!selectedForm || previewLoading || !dateFrom || !dateTo || dateFrom > dateTo}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-button-gradient px-4 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-50">
                {previewLoading ? (
                  <><ArrowPathIcon className="h-4 w-4 animate-spin" /> Preview laden...</>
                ) : (
                  <><ClockIcon className="h-4 w-4" /> Volgende: veld mapping</>
                )}
              </button>

              {/* History */}
              {!loadingHistory && history.length > 0 && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Eerdere imports</label>
                  <div className="space-y-2">
                    {history.map(run => {
                      const date = new Date(run.imported_at);
                      const dateStr = date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                      const periodStr = run.date_from
                        ? run.date_from === run.date_to
                          ? new Date(run.date_from).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
                          : `${new Date(run.date_from).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} – ${new Date(run.date_to!).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}`
                        : '';
                      return (
                        <div key={run.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2.5">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-800">{run.count} lead{run.count !== 1 ? 's' : ''} geïmporteerd</p>
                            <p className="mt-0.5 truncate text-[11px] text-slate-500">{dateStr}{periodStr ? ` · ${periodStr}` : ''}</p>
                          </div>
                          <button
                            onClick={async () => {
                              if (!confirm(`Weet je zeker dat je deze ${run.count} leads wilt verwijderen?`)) return;
                              setUndoing(run.id);
                              try {
                                const res = await adminFetch('/api/admin/backfill', { method: 'DELETE', body: JSON.stringify({ run_id: run.id }) });
                                const d = await res.json();
                                if (d.ok) { setHistory(h => h.filter(r => r.id !== run.id)); onDone(); }
                              } catch { /* ok */ }
                              setUndoing(null);
                            }}
                            disabled={undoing === run.id}
                            className="ml-3 shrink-0 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50">
                            {undoing === run.id
                              ? <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                              : <span className="flex items-center gap-1"><TrashIcon className="h-3.5 w-3.5" /> Verwijderen</span>}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {loadingHistory && <div className="flex items-center gap-2 text-xs text-slate-400"><ArrowPathIcon className="h-3.5 w-3.5 animate-spin" /> Importhistorie laden...</div>}
            </>
          )}

          {/* ═══ STEP 2: Field mapping ═══ */}
          {step === 'mapping' && (
            <>
              <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-3">
                <p className="text-xs text-amber-700">
                  Controleer hieronder hoe elk Meta-veld wordt gemapt naar een CRM-veld. Pas aan waar nodig en klik op &quot;Importeren&quot;.
                </p>
              </div>

              <div className="space-y-3">
                {previewFields.map(f => (
                  <div key={f.meta_name} className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-700">{f.meta_name}</p>
                        <p className="mt-0.5 truncate text-[11px] text-slate-400">Voorbeeld: <span className="text-slate-600">{f.sample_value || '(leeg)'}</span></p>
                      </div>
                      <span className="shrink-0 text-slate-300">→</span>
                    </div>
                    <select
                      value={fieldMapping[f.meta_name] || ''}
                      onChange={e => setFieldMapping(m => ({ ...m, [f.meta_name]: e.target.value }))}
                      className={`w-full rounded-lg border px-2.5 py-2 text-sm outline-none focus:ring-1 focus:ring-brand-purple/30 ${
                        fieldMapping[f.meta_name] === '_skip' ? 'border-slate-200 bg-slate-50 text-slate-400'
                          : fieldMapping[f.meta_name] ? 'border-emerald-200 bg-emerald-50/30 text-emerald-700'
                          : 'border-red-200 bg-red-50/30 text-red-600'
                      }`}
                    >
                      <option value="">- Niet gekoppeld -</option>
                      {allCrmOptions.map(opt =>
                        opt.key === '_divider'
                          ? <option key={opt.key} disabled className="text-slate-400">{opt.label}</option>
                          : <option key={opt.key} value={opt.key}>{opt.label}</option>
                      )}
                    </select>
                  </div>
                ))}
              </div>

              <button onClick={runImport} disabled={running}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-button-gradient px-4 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-50">
                <CheckCircleIcon className="h-4 w-4" /> Mapping bevestigen &amp; importeren
              </button>
            </>
          )}

          {/* ═══ STEP 3: Importing / Done ═══ */}
          {(step === 'importing' || step === 'done') && (
            <>
              {running && (
                <div className="flex flex-col items-center gap-3 py-8">
                  <ArrowPathIcon className="h-8 w-8 animate-spin text-brand-purple" />
                  <p className="text-sm font-medium text-slate-600">Leads worden geïmporteerd en verrijkt...</p>
                  <p className="text-[11px] text-slate-400">Dit kan even duren bij veel leads</p>
                </div>
              )}

              {result && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  {result.error ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                      <p className="text-sm font-medium text-red-700">{result.error}</p>
                      {result.permissionError && (
                        <div className="mt-2 text-xs text-red-600">
                          <p className="font-medium">Hoe op te lossen:</p>
                          <ol className="ml-4 mt-1 list-decimal space-y-1">
                            <li>Ga naar Meta Business Manager → Business Settings</li>
                            <li>Klik op System Users → selecteer je System User</li>
                            <li>Klik op &quot;Add Assets&quot; → selecteer je Page</li>
                            <li>Zorg dat &quot;Leads Retrieval&quot; (leads_retrieve) is aangevinkt</li>
                            <li>Genereer een nieuw token met deze permissie</li>
                          </ol>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
                        <CheckCircleIcon className="h-5 w-5" /> Import voltooid
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-3">
                        <div className="rounded-lg bg-white p-2.5 text-center shadow-sm">
                          <p className="text-lg font-bold text-slate-900">{result.fetched}</p>
                          <p className="text-[11px] text-slate-500">Opgehaald</p>
                        </div>
                        <div className="rounded-lg bg-white p-2.5 text-center shadow-sm">
                          <p className="text-lg font-bold text-emerald-600">{result.imported}</p>
                          <p className="text-[11px] text-slate-500">Geïmporteerd</p>
                        </div>
                        <div className="rounded-lg bg-white p-2.5 text-center shadow-sm">
                          <p className="text-lg font-bold text-amber-600">{result.skipped}</p>
                          <p className="text-[11px] text-slate-500">Overgeslagen</p>
                        </div>
                      </div>
                      {result.errors > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-red-600">{result.errors} lead(s) niet verwerkt</p>
                          {result.errorDetails?.map((e, i) => (
                            <p key={i} className="mt-1 rounded bg-red-50 px-2 py-1 text-[11px] text-red-600">{e}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <button onClick={() => { setStep('select'); setResult(null); }}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
                    Nog een import doen
                  </button>
                </motion.div>
              )}
            </>
          )}

        </div>
      </motion.div>
    </>
  );
}
