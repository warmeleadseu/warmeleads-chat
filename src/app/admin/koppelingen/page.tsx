'use client';

import { useState, useEffect, useCallback } from 'react';
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
  BuildingOfficeIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

interface Customer { id: string; name: string; branches: string[]; }
interface WebhookKey {
  id: string; key: string; label: string; branch: string; customer_id: string;
  customers?: { id: string; name: string } | null;
  is_active: boolean; last_used_at: string | null; request_count: number; created_at: string;
}

const THUISBATTERIJ_FIELDS = [
  { key: 'naam_klant', label: 'Naam klant', required: true },
  { key: 'email', label: 'E-mailadres', required: false },
  { key: 'telefoonnummer', label: 'Telefoonnummer', required: false },
  { key: 'postcode', label: 'Postcode', required: false },
  { key: 'huisnummer', label: 'Huisnummer', required: false },
  { key: 'plaatsnaam', label: 'Plaatsnaam', required: false },
  { key: 'provincie', label: 'Provincie', required: false },
  { key: 'zonnepanelen', label: 'Zonnepanelen', required: false },
  { key: 'dynamisch_contract', label: 'Dynamisch contract', required: false },
  { key: 'stroomverbruik', label: 'Stroomverbruik', required: false },
  { key: 'budget', label: 'Budget', required: false },
  { key: 'reden_thuisbatterij', label: 'Reden thuisbatterij', required: false },
];

const AIRCO_FIELDS = [
  { key: 'naam_klant', label: 'Naam klant', required: true },
  { key: 'email', label: 'E-mailadres', required: false },
  { key: 'telefoonnummer', label: 'Telefoonnummer', required: false },
  { key: 'postcode', label: 'Postcode', required: false },
  { key: 'huisnummer', label: 'Huisnummer', required: false },
  { key: 'plaatsnaam', label: 'Plaatsnaam', required: false },
  { key: 'provincie', label: 'Provincie', required: false },
  { key: 'type_airco', label: 'Type airco', required: false },
  { key: 'koelen_verwarmen', label: 'Koelen/verwarmen', required: false },
  { key: 'hoeveel_ruimtes', label: 'Hoeveel ruimtes', required: false },
  { key: 'zakelijk', label: 'Zakelijk', required: false },
  { key: 'koop_of_huur', label: 'Koop of huur', required: false },
  { key: 'boorwerkzaamheden_toegestaan', label: 'Boorwerkzaamheden toegestaan', required: false },
];

export default function KoppelingenPage() {
  const { user } = useAdmin();
  const [keys, setKeys] = useState<WebhookKey[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [activeInstructions, setActiveInstructions] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [keysRes, custRes] = await Promise.all([
      adminFetch('/api/admin/webhook/keys'),
      adminFetch('/api/admin/customers'),
    ]);
    if (keysRes.ok) { const d = await keysRes.json(); setKeys(d.keys || []); }
    if (custRes.ok) { const d = await custRes.json(); setCustomers(d.customers || []); }
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
      setTestResult({ id: keyId, success: false, message: 'Test mislukt — probeer het opnieuw' });
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
            Maak per klant en campagne een koppeling aan. Je krijgt dan een stap-voor-stap handleiding
            om je Zapier zap in te stellen. Leads komen dan automatisch in het CRM en klantportaal terecht.
          </p>
        </div>
      </div>

      {/* Koppelingen grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-brand-purple" />
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
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                        <BuildingOfficeIcon className="h-3 w-3" />
                        {k.customers?.name || 'Geen klant'}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusColor}`}>
                        {statusLabel}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${k.branch === 'thuisbatterij' ? 'bg-emerald-50 text-emerald-600' : 'bg-sky-50 text-sky-600'}`}>
                        {k.branch}
                      </span>
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
                    className="flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-medium text-brand-purple transition hover:bg-brand-purple/5"
                  >
                    <DocumentDuplicateIcon className="h-3.5 w-3.5" />
                    {hasLeads ? 'Zapier instructies' : 'Instellen'}
                  </button>
                  <div className="h-8 w-px bg-slate-100" />
                  <button
                    onClick={() => testWebhookFromPanel(k.id)}
                    disabled={testing === k.id}
                    className="flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-medium text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50"
                  >
                    {testing === k.id ? (
                      <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <BoltIcon className="h-3.5 w-3.5" />
                    )}
                    Test
                  </button>
                  <div className="h-8 w-px bg-slate-100" />
                  <button
                    onClick={() => deleteKey(k.id, k.label)}
                    className="flex items-center justify-center px-4 py-3 text-xs text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Instructions panel */}
                <AnimatePresence>
                  {activeInstructions === k.id && (
                    <InstructionsPanel
                      webhookKey={k}
                      webhookUrl={webhookUrl}
                      copied={copied}
                      onCopy={copy}
                      onClose={() => setActiveInstructions(null)}
                      onTest={() => testWebhookFromPanel(k.id)}
                      testing={testing === k.id}
                      testResult={testResult?.id === k.id ? testResult : null}
                    />
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

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
            customers={customers}
            onClose={() => setShowWizard(false)}
            onCreated={onCreated}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ───────── Instructions Panel ───────── */

function InstructionsPanel({
  webhookKey,
  webhookUrl,
  copied,
  onCopy,
  onClose,
  onTest,
  testing,
  testResult,
}: {
  webhookKey: WebhookKey;
  webhookUrl: string;
  copied: string | null;
  onCopy: (text: string, id: string) => void;
  onClose: () => void;
  onTest: () => void;
  testing: boolean;
  testResult: { id: string; success: boolean; message: string } | null;
}) {
  const fields = webhookKey.branch === 'thuisbatterij' ? THUISBATTERIJ_FIELDS : AIRCO_FIELDS;
  const headerValue = `X-API-Key: ${webhookKey.key}`;

  const copyAll = () => {
    const lines = [
      '=== ZAPIER KOPPELING ===',
      `Koppeling: ${webhookKey.label}`,
      `Klant: ${webhookKey.customers?.name || '—'}`,
      `Branche: ${webhookKey.branch}`,
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
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden border-t border-slate-100"
    >
      <div className="bg-slate-50/70 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-900">Zapier instellen — stap voor stap</h4>
          <div className="flex items-center gap-2">
            <button
              onClick={copyAll}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50"
            >
              {copied === `all-${webhookKey.id}` ? (
                <><CheckIcon className="h-3 w-3 text-emerald-500" /> Gekopieerd!</>
              ) : (
                <><ClipboardDocumentIcon className="h-3 w-3" /> Kopieer alles</>
              )}
            </button>
            <button onClick={onClose} className="rounded p-1 text-slate-400 hover:text-slate-600">
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Step 1 */}
        <div className="mb-4">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-purple text-[10px] font-bold text-white">1</span>
            <p className="text-xs font-semibold text-slate-800">Voeg een actie toe in je Zap</p>
          </div>
          <p className="ml-7 text-xs text-slate-500">
            Zoek naar <span className="font-medium text-slate-700">&quot;Webhooks by Zapier&quot;</span> en kies <span className="font-medium text-slate-700">&quot;POST&quot;</span> als actie.
          </p>
        </div>

        {/* Step 2 */}
        <div className="mb-4">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-purple text-[10px] font-bold text-white">2</span>
            <p className="text-xs font-semibold text-slate-800">Plak deze URL</p>
          </div>
          <div className="ml-7">
            <CopyField value={webhookUrl} id={`url-${webhookKey.id}`} copied={copied} onCopy={onCopy} />
          </div>
        </div>

        {/* Step 3 */}
        <div className="mb-4">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-purple text-[10px] font-bold text-white">3</span>
            <p className="text-xs font-semibold text-slate-800">Voeg deze header toe</p>
          </div>
          <div className="ml-7 space-y-1.5">
            <div className="flex gap-2">
              <div className="flex-1">
                <p className="mb-0.5 text-[10px] font-medium text-slate-400">Key</p>
                <CopyField value="X-API-Key" id={`hkey-${webhookKey.id}`} copied={copied} onCopy={onCopy} />
              </div>
              <div className="flex-1">
                <p className="mb-0.5 text-[10px] font-medium text-slate-400">Value</p>
                <CopyField value={webhookKey.key} id={`hval-${webhookKey.id}`} copied={copied} onCopy={onCopy} mono />
              </div>
            </div>
            <p className="text-[10px] text-slate-400">
              In Zapier: scroll naar &quot;Headers&quot; en voeg bovenstaande key + value toe.
            </p>
          </div>
        </div>

        {/* Step 4 */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-purple text-[10px] font-bold text-white">4</span>
            <p className="text-xs font-semibold text-slate-800">Map deze velden bij &quot;Data&quot;</p>
          </div>
          <div className="ml-7">
            <p className="mb-2 text-[10px] text-slate-500">
              In Zapier onder &quot;Data&quot;: vul links de <span className="font-medium">key</span> in en rechts de waarde uit je trigger.
            </p>
            <div className="rounded-lg border border-slate-200 bg-white">
              <div className="grid grid-cols-[1fr_1fr_auto] gap-0 border-b border-slate-100 px-3 py-1.5 text-[10px] font-semibold text-slate-500">
                <span>Zapier key</span>
                <span>Omschrijving</span>
                <span className="w-7" />
              </div>
              <div className="divide-y divide-slate-50">
                {fields.map(f => (
                  <div key={f.key} className="grid grid-cols-[1fr_1fr_auto] items-center gap-0 px-3 py-1.5">
                    <code className="text-[11px] font-mono text-brand-purple">{f.key}</code>
                    <span className="text-[11px] text-slate-600">
                      {f.label}
                      {f.required && <span className="ml-1 text-red-400">*</span>}
                    </span>
                    <button
                      onClick={() => onCopy(f.key, `field-${webhookKey.id}-${f.key}`)}
                      className="flex h-6 w-6 items-center justify-center rounded text-slate-300 hover:bg-slate-50 hover:text-slate-500"
                    >
                      {copied === `field-${webhookKey.id}-${f.key}` ? (
                        <CheckIcon className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <ClipboardDocumentIcon className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-2 text-[10px] text-slate-400">
              * = verplicht. Overige velden zijn optioneel — stuur alleen wat je hebt.
            </p>
          </div>
        </div>

        {/* Step 5: Test */}
        <div className="mt-5 rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">5</span>
            <p className="text-xs font-semibold text-slate-800">Test de verbinding</p>
          </div>
          <p className="mb-3 ml-7 text-[10px] text-slate-500">
            Klaar met instellen? Test hier of alles werkt. Er wordt een test-lead aangemaakt die je kunt verwijderen.
          </p>

          <AnimatePresence mode="wait">
            {testResult?.success ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="ml-7"
              >
                <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <CheckCircleIcon className="h-5 w-5 shrink-0 text-emerald-500" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-700">Verbinding werkt!</p>
                    <p className="text-[11px] text-emerald-600">{testResult.message} — dit venster sluit automatisch.</p>
                  </div>
                </div>
              </motion.div>
            ) : testResult && !testResult.success ? (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="ml-7 space-y-2"
              >
                <div className="flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                  <ExclamationTriangleIcon className="h-5 w-5 shrink-0 text-red-400" />
                  <div>
                    <p className="text-sm font-semibold text-red-700">Test mislukt</p>
                    <p className="text-[11px] text-red-600">{testResult.message}</p>
                  </div>
                </div>
                <button
                  onClick={onTest}
                  disabled={testing}
                  className="ml-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  <ArrowPathIcon className={`h-3.5 w-3.5 ${testing ? 'animate-spin' : ''}`} />
                  Opnieuw testen
                </button>
              </motion.div>
            ) : (
              <motion.div key="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="ml-7">
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
    </motion.div>
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
    <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
      <span className={`min-w-0 flex-1 truncate text-[11px] text-slate-700 ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
      <button
        onClick={() => onCopy(value, id)}
        className="shrink-0 rounded p-0.5 text-slate-400 hover:text-brand-purple"
      >
        {copied === id ? (
          <CheckIcon className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <ClipboardDocumentIcon className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}

/* ───────── Create Wizard ───────── */

function CreateWizard({
  customers,
  onClose,
  onCreated,
}: {
  customers: Customer[];
  onClose: () => void;
  onCreated: (keyId: string) => void;
}) {
  const [step, setStep] = useState(1);
  const [customerId, setCustomerId] = useState('');
  const [branch, setBranch] = useState('');
  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const selectedCustomer = customers.find(c => c.id === customerId);

  const create = async () => {
    if (!label || !customerId || !branch) return;
    setCreating(true);
    setError('');
    try {
      const res = await adminFetch('/api/admin/webhook/keys', {
        method: 'POST',
        body: JSON.stringify({ label, branch, customer_id: customerId }),
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
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Nieuwe koppeling</h2>
            <p className="text-xs text-slate-500">Stap {step} van 3</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Progress */}
        <div className="flex gap-1 px-6 pt-4">
          {[1, 2, 3].map(s => (
            <div key={s} className={`h-1 flex-1 rounded-full transition ${s <= step ? 'bg-brand-purple' : 'bg-slate-200'}`} />
          ))}
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>
          )}

          {/* Step 1: Choose customer */}
          {step === 1 && (
            <div>
              <h3 className="mb-1 text-sm font-semibold text-slate-800">Voor welke klant is deze koppeling?</h3>
              <p className="mb-4 text-xs text-slate-500">Leads die binnenkomen via deze koppeling worden automatisch aan deze klant toegewezen.</p>
              {customers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 py-8 text-center">
                  <BuildingOfficeIcon className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                  <p className="text-sm text-slate-500">Maak eerst een klant aan via &quot;Klanten&quot;.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {customers.filter(c => c.branches && c.branches.length > 0).map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setCustomerId(c.id); setStep(2); }}
                      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                        customerId === c.id
                          ? 'border-brand-purple/30 bg-brand-purple/5'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-800">{c.name}</p>
                        <div className="mt-0.5 flex gap-1">
                          {c.branches.map(b => (
                            <span key={b} className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${b === 'thuisbatterij' ? 'bg-emerald-50 text-emerald-600' : 'bg-sky-50 text-sky-600'}`}>
                              {b}
                            </span>
                          ))}
                        </div>
                      </div>
                      <ChevronRightIcon className="h-4 w-4 text-slate-400" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Choose branch */}
          {step === 2 && selectedCustomer && (
            <div>
              <h3 className="mb-1 text-sm font-semibold text-slate-800">Welke branche?</h3>
              <p className="mb-4 text-xs text-slate-500">Leads worden automatisch als deze branche opgeslagen.</p>
              <div className="space-y-2">
                {selectedCustomer.branches.map(b => (
                  <button
                    key={b}
                    onClick={() => {
                      setBranch(b);
                      setLabel(`${selectedCustomer.name} — ${b === 'thuisbatterij' ? 'Thuisbatterij' : 'Airco'}`);
                      setStep(3);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3.5 text-left transition ${
                      branch === b
                        ? 'border-brand-purple/30 bg-brand-purple/5'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${b === 'thuisbatterij' ? 'bg-emerald-50' : 'bg-sky-50'}`}>
                        <BoltIcon className={`h-4 w-4 ${b === 'thuisbatterij' ? 'text-emerald-600' : 'text-sky-600'}`} />
                      </div>
                      <span className="text-sm font-medium text-slate-800 capitalize">{b}</span>
                    </div>
                    <ChevronRightIcon className="h-4 w-4 text-slate-400" />
                  </button>
                ))}
              </div>
              <button onClick={() => setStep(1)} className="mt-4 text-xs text-slate-500 hover:text-slate-700">
                ← Terug
              </button>
            </div>
          )}

          {/* Step 3: Name + confirm */}
          {step === 3 && (
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

              {/* Summary */}
              <div className="mb-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Samenvatting</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Klant</span>
                    <span className="font-medium text-slate-800">{selectedCustomer?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Branche</span>
                    <span className="font-medium capitalize text-slate-800">{branch}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setStep(2)} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
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
