'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  PaperAirplaneIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  EnvelopeIcon,
  ChatBubbleLeftEllipsisIcon,
  AdjustmentsHorizontalIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';

type Step = 1 | 2 | 3 | 4;

type RecipientType = 'prospect' | 'customer';

export interface ComposeRecipientRef {
  type: RecipientType;
  id: string;
  /** Optionele preview-naam in de UI; server bouwt zelf de echte data op. */
  label?: string;
}

interface TemplateOption {
  key: string;
  label: string;
  type:
    | 'boolean'
    | 'multiselect'
    | 'select'
    | 'text'
    | 'textarea'
    | 'number'
    | 'richtext';
  description?: string;
  default?: unknown;
  placeholder?: string;
  source?: 'branches';
  showWhen?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
}

interface TemplateSummary {
  key: string;
  label: string;
  description: string;
  applicable_to: ('prospect' | 'customer')[];
  scope: 'marketing' | 'nurture' | 'pricing' | 'all';
  options: TemplateOption[];
}

interface BranchOption {
  slug: string;
  name: string;
}

interface PreviewItem {
  recipient: { id: string; type: RecipientType; email: string; name: string; company: string };
  subject: string;
  html: string;
  text: string;
  warnings: string[];
  opted_out: boolean;
}

interface PreviewResponse {
  template_key: string;
  from: string;
  reply_to: string;
  counts: {
    requested: number;
    resolved: number;
    forbidden: number;
    invalid: number;
    opted_out: number;
    sendable: number;
  };
  forbidden: ComposeRecipientRef[];
  invalid: ComposeRecipientRef[];
  opted_out_emails: string[];
  previews: PreviewItem[];
}

interface SendSyncResponse {
  success: boolean;
  partial?: boolean;
  job_id?: string;
  counts?: {
    requested: number;
    resolved: number;
    sent?: number;
    failed?: number;
    opt_out?: number;
    forbidden: number;
    invalid: number;
  };
  errors?: { recipient_id: string; type: string; email: string; error: string }[];
  polling_url?: string;
}

interface JobStatus {
  id: string;
  total: number;
  sent: number;
  failed: number;
  opt_out: number;
  status: 'queued' | 'running' | 'done' | 'error';
  error: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  initialRecipients: ComposeRecipientRef[];
  /** Standaard template selectie, optioneel */
  defaultTemplateKey?: string;
  /** Callback wanneer er minstens 1 mail succesvol verstuurd is */
  onSent?: () => void;
}

const SCOPE_LABELS: Record<string, string> = {
  marketing: 'Commercieel',
  pricing: 'Prijsinfo',
  nurture: 'Opvolging',
  all: 'Algemeen',
};

const APPLICABLE_LABEL = (a: ('prospect' | 'customer')[]) => {
  if (a.length === 2) return 'Beide';
  return a[0] === 'prospect' ? 'Prospects' : 'Klanten';
};

export function ComposeMailDrawer({
  open,
  onClose,
  initialRecipients,
  defaultTemplateKey,
  onSent,
}: Props) {
  const [step, setStep] = useState<Step>(1);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>(defaultTemplateKey || '');
  const [optionValues, setOptionValues] = useState<Record<string, unknown>>({});
  const [subjectOverride, setSubjectOverride] = useState('');
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [recipients, setRecipients] = useState<ComposeRecipientRef[]>(initialRecipients);
  const [showRecipientPicker, setShowRecipientPicker] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<SendSyncResponse | null>(null);
  const [job, setJob] = useState<JobStatus | null>(null);
  const [testStatus, setTestStatus] = useState<string | null>(null);

  const selected = useMemo(
    () => templates.find(t => t.key === selectedKey) || null,
    [templates, selectedKey],
  );

  // Reset bij openen.
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setSubjectOverride('');
    setOptionValues({});
    setSelectedKey(defaultTemplateKey || '');
    setRecipients(initialRecipients);
    setShowRecipientPicker(initialRecipients.length === 0);
    setPreview(null);
    setPreviewIdx(0);
    setError(null);
    setSendResult(null);
    setJob(null);
    setTestStatus(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Templates en branches laden bij eerste open.
  useEffect(() => {
    if (!open) return;
    let active = true;
    (async () => {
      try {
        const [tplRes, brRes] = await Promise.all([
          adminFetch('/api/admin/emails/templates'),
          adminFetch('/api/admin/branches'),
        ]);
        if (!active) return;
        if (tplRes.ok) {
          const j = await tplRes.json();
          setTemplates(j.templates || []);
        }
        if (brRes.ok) {
          const j = await brRes.json();
          setBranches((j.branches || []) as BranchOption[]);
        }
      } catch (err) {
        console.error('compose:init', err);
      }
    })();
    return () => {
      active = false;
    };
  }, [open]);

  // Default option values invullen wanneer template wisselt.
  useEffect(() => {
    if (!selected) return;
    setOptionValues(prev => {
      const next = { ...prev };
      for (const opt of selected.options) {
        if (next[opt.key] === undefined && opt.default !== undefined) {
          next[opt.key] = opt.default;
        }
      }
      return next;
    });
    setSubjectOverride('');
  }, [selected]);

  // Filter beschikbare templates op basis van geselecteerde recipient-types.
  const filteredTemplates = useMemo(() => {
    const types = new Set(recipients.map(r => r.type));
    if (types.size === 0) return templates;
    return templates.filter(t => Array.from(types).every(rt => t.applicable_to.includes(rt)));
  }, [templates, recipients]);

  const recipientCounts = useMemo(() => {
    const p = recipients.filter(r => r.type === 'prospect').length;
    const c = recipients.filter(r => r.type === 'customer').length;
    return { p, c };
  }, [recipients]);

  const recipientsBody = useMemo(() => {
    return {
      prospects: recipients.filter(r => r.type === 'prospect').map(r => r.id),
      customers: recipients.filter(r => r.type === 'customer').map(r => r.id),
    };
  }, [recipients]);

  const loadPreview = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      const res = await adminFetch('/api/admin/emails/compose/preview', {
        method: 'POST',
        body: JSON.stringify({
          template_key: selected.key,
          options: optionValues,
          subject_override: subjectOverride || undefined,
          recipient_ids: recipientsBody,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as PreviewResponse | { error?: string };
      if (!res.ok) {
        throw new Error((j as { error?: string }).error || 'Voorbeeld kon niet geladen worden');
      }
      setPreview(j as PreviewResponse);
      setPreviewIdx(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fout bij laden voorbeeld');
    } finally {
      setLoading(false);
    }
  }, [selected, optionValues, subjectOverride, recipientsBody]);

  // Laad preview bij entry van stap 3.
  useEffect(() => {
    if (step === 3 && selected && !preview && !loading) {
      void loadPreview();
    }
  }, [step, selected, preview, loading, loadPreview]);

  async function sendTest() {
    if (!selected) return;
    setTestStatus('Bezig met versturen…');
    try {
      const sample = recipients[0]
        ? { type: recipients[0].type, id: recipients[0].id }
        : null;
      const res = await adminFetch('/api/admin/emails/compose/test', {
        method: 'POST',
        body: JSON.stringify({
          template_key: selected.key,
          options: optionValues,
          subject_override: subjectOverride || undefined,
          sample_recipient: sample,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error || 'Test mislukt');
      setTestStatus('Test verstuurd naar je eigen inbox.');
    } catch (err) {
      setTestStatus(err instanceof Error ? err.message : 'Test mislukt');
    }
  }

  async function actuallySend() {
    if (!selected) return;
    setSending(true);
    setError(null);
    setSendResult(null);
    setJob(null);
    try {
      const res = await adminFetch('/api/admin/emails/compose/send', {
        method: 'POST',
        body: JSON.stringify({
          template_key: selected.key,
          options: optionValues,
          subject_override: subjectOverride || undefined,
          recipient_ids: recipientsBody,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as SendSyncResponse | { error?: string };
      if (!res.ok) {
        throw new Error((j as { error?: string }).error || 'Verzenden mislukt');
      }
      setSendResult(j as SendSyncResponse);
      if (onSent) onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verzenden mislukt');
    } finally {
      setSending(false);
    }
  }

  // Job-poller voor bulk-jobs (>100 ontvangers).
  useEffect(() => {
    if (!sendResult?.job_id) return;
    let active = true;
    const jobId = sendResult.job_id;
    const poll = async () => {
      try {
        const res = await adminFetch(`/api/admin/emails/jobs/${jobId}`);
        if (!res.ok) return;
        const j = (await res.json()) as { job: JobStatus };
        if (!active) return;
        setJob(j.job);
        if (j.job.status === 'done' || j.job.status === 'error') return;
      } catch {
        /* swallow */
      }
      setTimeout(poll, 2000);
    };
    void poll();
    return () => {
      active = false;
    };
  }, [sendResult?.job_id]);

  // ESC sluit drawer.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sending) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, sending]);

  function nextStep() {
    if (step === 1 && !selected) return;
    if (step === 2 && !validateOptions()) return;
    if (step < 4) setStep((step + 1) as Step);
  }
  function prevStep() {
    if (step > 1) setStep((step - 1) as Step);
  }

  function validateOptions(): boolean {
    if (!selected) return false;
    if (selected.key === 'custom') {
      const sub = String(optionValues.subject_override || '').trim();
      const body = String(optionValues.body || '').trim();
      if (!sub) {
        setError('Vul een onderwerp in.');
        return false;
      }
      if (!body) {
        setError('Vul een bericht in.');
        return false;
      }
    }
    if (
      ['pricing_overview', 'proposal'].includes(selected.key) &&
      (!Array.isArray(optionValues.branches) || (optionValues.branches as string[]).length === 0)
    ) {
      setError('Kies minstens één branche bij de opties.');
      return false;
    }
    setError(null);
    return true;
  }

  const stepLabels = ['Sjabloon', 'Opties', 'Voorbeeld', 'Versturen'];

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Sluiten"
            className="flex-1 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => !sending && onClose()}
          />
          <motion.aside
            className="w-full max-w-3xl bg-slate-50 shadow-2xl flex flex-col"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
          >
            <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <EnvelopeIcon className="w-5 h-5 text-slate-500" />
                  Mail opstellen
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {recipientCounts.p > 0 && `${recipientCounts.p} prospect${recipientCounts.p === 1 ? '' : 's'}`}
                  {recipientCounts.p > 0 && recipientCounts.c > 0 && ' · '}
                  {recipientCounts.c > 0 && `${recipientCounts.c} klant${recipientCounts.c === 1 ? '' : 'en'}`}
                  {recipientCounts.p === 0 && recipientCounts.c === 0 && 'Geen ontvangers gekozen'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => !sending && onClose()}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
                aria-label="Sluiten"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <Stepper labels={stepLabels} current={step} />

            <div className="flex-1 overflow-y-auto px-6 py-6">
              {error && (
                <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 flex items-start gap-2">
                  <ExclamationTriangleIcon className="w-4 h-4 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {step === 1 && showRecipientPicker && (
                <RecipientPicker
                  recipients={recipients}
                  onAdd={r => {
                    if (recipients.some(x => x.id === r.id && x.type === r.type)) return;
                    setRecipients(prev => [...prev, r]);
                  }}
                  onRemove={(id, type) =>
                    setRecipients(prev => prev.filter(r => !(r.id === id && r.type === type)))
                  }
                  onContinue={() => setShowRecipientPicker(false)}
                />
              )}
              {step === 1 && !showRecipientPicker && (
                <>
                  {recipients.length > 0 && initialRecipients.length === 0 && (
                    <button
                      type="button"
                      onClick={() => setShowRecipientPicker(true)}
                      className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
                    >
                      <UsersIcon className="w-4 h-4" />
                      {recipients.length} ontvanger(s) — wijzigen
                    </button>
                  )}
                  <TemplateGrid
                    templates={filteredTemplates}
                    selectedKey={selectedKey}
                    onPick={k => {
                      setSelectedKey(k);
                      setError(null);
                    }}
                  />
                </>
              )}

              {step === 2 && selected && (
                <OptionsForm
                  template={selected}
                  values={optionValues}
                  onChange={(k, v) =>
                    setOptionValues(prev => ({ ...prev, [k]: v }))
                  }
                  branches={branches}
                />
              )}

              {step === 3 && selected && (
                <PreviewPanel
                  loading={loading}
                  preview={preview}
                  selectedIdx={previewIdx}
                  onSelect={setPreviewIdx}
                  subjectOverride={subjectOverride}
                  onSubjectChange={setSubjectOverride}
                  onReload={loadPreview}
                  onSendTest={sendTest}
                  testStatus={testStatus}
                />
              )}

              {step === 4 && selected && (
                <SendPanel
                  preview={preview}
                  sending={sending}
                  result={sendResult}
                  job={job}
                  onSend={actuallySend}
                  onClose={onClose}
                />
              )}
            </div>

            <div className="flex items-center justify-between px-6 py-4 bg-white border-t border-slate-200">
              <button
                type="button"
                onClick={prevStep}
                disabled={step === 1 || sending}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-30"
              >
                <ArrowLeftIcon className="w-4 h-4" /> Vorige
              </button>
              {step < 4 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  disabled={
                    (step === 1 && !selected) ||
                    sending ||
                    recipients.length === 0
                  }
                  className="inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40"
                >
                  Volgende <ArrowRightIcon className="w-4 h-4" />
                </button>
              ) : sendResult ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800"
                >
                  Sluiten
                </button>
              ) : (
                <button
                  type="button"
                  onClick={actuallySend}
                  disabled={sending}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-40"
                >
                  <PaperAirplaneIcon className="w-4 h-4" />
                  {sending ? 'Bezig…' : `Verstuur naar ${preview?.counts.sendable ?? recipients.length}`}
                </button>
              )}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Stepper({ labels, current }: { labels: string[]; current: Step }) {
  return (
    <ol className="flex items-center gap-1 px-6 py-3 bg-white border-b border-slate-200">
      {labels.map((label, i) => {
        const idx = (i + 1) as Step;
        const active = idx === current;
        const done = idx < current;
        return (
          <li key={label} className="flex items-center gap-2 text-xs">
            <span
              className={`flex items-center justify-center w-6 h-6 rounded-full font-semibold ${
                done
                  ? 'bg-emerald-100 text-emerald-700'
                  : active
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-500'
              }`}
            >
              {done ? '✓' : idx}
            </span>
            <span className={active ? 'font-semibold text-slate-900' : 'text-slate-500'}>
              {label}
            </span>
            {i < labels.length - 1 && <span className="mx-2 text-slate-300">›</span>}
          </li>
        );
      })}
    </ol>
  );
}

function TemplateGrid({
  templates,
  selectedKey,
  onPick,
}: {
  templates: TemplateSummary[];
  selectedKey: string;
  onPick: (key: string) => void;
}) {
  if (templates.length === 0) {
    return <p className="text-sm text-slate-500">Geen geschikte templates voor deze ontvangers.</p>;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {templates.map(t => {
        const sel = t.key === selectedKey;
        return (
          <button
            type="button"
            key={t.key}
            onClick={() => onPick(t.key)}
            className={`text-left rounded-xl border p-4 transition-all ${
              sel
                ? 'border-slate-900 bg-white shadow-sm ring-2 ring-slate-900/10'
                : 'border-slate-200 bg-white hover:border-slate-400'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-semibold text-slate-900">{t.label}</span>
              <span className="shrink-0 text-[10px] uppercase tracking-wide font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                {APPLICABLE_LABEL(t.applicable_to)}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">{t.description}</p>
            <div className="mt-3 flex items-center gap-2 text-[10px]">
              <span className="px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-200">
                Scope: {SCOPE_LABELS[t.scope] || t.scope}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-200">
                {t.options.length} optie{t.options.length === 1 ? '' : 's'}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function OptionsForm({
  template,
  values,
  onChange,
  branches,
}: {
  template: TemplateSummary;
  values: Record<string, unknown>;
  onChange: (k: string, v: unknown) => void;
  branches: BranchOption[];
}) {
  const visibleOptions = useMemo(
    () =>
      template.options.filter(opt => {
        if (!opt.showWhen) return true;
        const v = values[opt.showWhen];
        if (Array.isArray(v)) return v.length > 0;
        return Boolean(v);
      }),
    [template.options, values],
  );

  return (
    <div className="space-y-5">
      <div className="rounded-lg bg-slate-100 px-4 py-3 text-xs text-slate-600 flex items-start gap-2">
        <AdjustmentsHorizontalIcon className="w-4 h-4 mt-0.5 text-slate-500" />
        <p>
          Pas de mail aan voor deze ontvangers. Onbekende merge-tags worden automatisch verwijderd
          en als waarschuwing getoond bij het voorbeeld.
        </p>
      </div>
      {visibleOptions.map(opt => (
        <OptionInput
          key={opt.key}
          option={opt}
          value={values[opt.key]}
          onChange={v => onChange(opt.key, v)}
          branches={branches}
        />
      ))}
    </div>
  );
}

function OptionInput({
  option,
  value,
  onChange,
  branches,
}: {
  option: TemplateOption;
  value: unknown;
  onChange: (v: unknown) => void;
  branches: BranchOption[];
}) {
  const id = `opt-${option.key}`;
  if (option.type === 'boolean') {
    const checked = value === true || value === 1 || value === 'true';
    return (
      <label className="flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
        />
        <span>
          <span className="text-sm font-medium text-slate-900 block">{option.label}</span>
          {option.description && (
            <span className="text-xs text-slate-500">{option.description}</span>
          )}
        </span>
      </label>
    );
  }

  if (option.type === 'multiselect' && option.source === 'branches') {
    const arr = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div>
        <label htmlFor={id} className="text-sm font-medium text-slate-900 block mb-1">
          {option.label}
        </label>
        {option.description && <p className="text-xs text-slate-500 mb-2">{option.description}</p>}
        <div className="flex flex-wrap gap-1.5">
          {branches.map(b => {
            const sel = arr.includes(b.slug);
            return (
              <button
                type="button"
                key={b.slug}
                onClick={() => {
                  const next = sel ? arr.filter(s => s !== b.slug) : [...arr, b.slug];
                  onChange(next);
                }}
                className={`text-xs px-3 py-1.5 rounded-full border transition ${
                  sel
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white border-slate-200 hover:border-slate-400 text-slate-700'
                }`}
              >
                {b.name}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (option.type === 'select') {
    const v = typeof value === 'string' ? value : option.default ? String(option.default) : '';
    return (
      <div>
        <label htmlFor={id} className="text-sm font-medium text-slate-900 block mb-1">
          {option.label}
        </label>
        {option.description && <p className="text-xs text-slate-500 mb-2">{option.description}</p>}
        <select
          id={id}
          value={v}
          onChange={e => onChange(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
        >
          {(option.options || []).map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (option.type === 'number') {
    const v = typeof value === 'number' ? value : Number(value || option.default || 0);
    return (
      <div>
        <label htmlFor={id} className="text-sm font-medium text-slate-900 block mb-1">
          {option.label}
        </label>
        {option.description && <p className="text-xs text-slate-500 mb-2">{option.description}</p>}
        <input
          id={id}
          type="number"
          value={Number.isFinite(v) ? v : 0}
          min={option.min}
          max={option.max}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="w-full max-w-[200px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
        />
      </div>
    );
  }

  if (option.type === 'textarea' || option.type === 'richtext') {
    const v = typeof value === 'string' ? value : '';
    return (
      <div>
        <label htmlFor={id} className="text-sm font-medium text-slate-900 block mb-1">
          {option.label}
        </label>
        {option.description && <p className="text-xs text-slate-500 mb-2">{option.description}</p>}
        <textarea
          id={id}
          value={v}
          rows={option.type === 'richtext' ? 8 : 3}
          placeholder={option.placeholder}
          onChange={e => onChange(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-900 focus:outline-none font-mono"
        />
        {option.type === 'richtext' && (
          <p className="mt-1 text-[11px] text-slate-400">
            HTML toegestaan (p, br, strong, em, a, ul, ol, li). Merge-tags zoals{' '}
            <code className="text-slate-600">{'{{first_name}}'}</code>,{' '}
            <code className="text-slate-600">{'{{company_name}}'}</code>,{' '}
            <code className="text-slate-600">{'{{am_first_name}}'}</code>.
          </p>
        )}
      </div>
    );
  }

  // text fallback
  const v = typeof value === 'string' ? value : '';
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-slate-900 block mb-1">
        {option.label}
      </label>
      {option.description && <p className="text-xs text-slate-500 mb-2">{option.description}</p>}
      <input
        id={id}
        type="text"
        value={v}
        placeholder={option.placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
      />
    </div>
  );
}

function PreviewPanel({
  loading,
  preview,
  selectedIdx,
  onSelect,
  subjectOverride,
  onSubjectChange,
  onReload,
  onSendTest,
  testStatus,
}: {
  loading: boolean;
  preview: PreviewResponse | null;
  selectedIdx: number;
  onSelect: (i: number) => void;
  subjectOverride: string;
  onSubjectChange: (s: string) => void;
  onReload: () => void;
  onSendTest: () => void;
  testStatus: string | null;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const item = preview?.previews[selectedIdx];
  useEffect(() => {
    if (!iframeRef.current || !item) return;
    const doc = iframeRef.current.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(item.html);
    doc.close();
  }, [item]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-sm text-slate-500">Voorbeeld laden…</div>
      </div>
    );
  }
  if (!preview) {
    return (
      <div className="text-sm text-slate-500">
        Geen voorbeeld geladen.{' '}
        <button onClick={onReload} className="underline">
          Probeer opnieuw
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <CountChip label="Verzendt" value={preview.counts.sendable} tone="green" />
        <CountChip label="Uitgeschr." value={preview.counts.opted_out} tone="amber" />
        <CountChip label="Geen toegang" value={preview.counts.forbidden} tone="rose" />
        <CountChip label="Ongeldig" value={preview.counts.invalid} tone="rose" />
      </div>

      <div className="bg-white border border-slate-200 rounded-lg">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <span className="text-xs text-slate-500 shrink-0">Onderwerp:</span>
          <input
            type="text"
            value={subjectOverride || item?.subject || ''}
            onChange={e => onSubjectChange(e.target.value)}
            placeholder={item?.subject || 'Onderwerp…'}
            className="flex-1 text-sm font-semibold text-slate-900 bg-transparent border-0 focus:outline-none focus:ring-0 p-0"
          />
          <button
            type="button"
            onClick={onReload}
            className="text-xs text-slate-500 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-100"
          >
            Ververs
          </button>
        </div>
        <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-3 text-xs">
          <span className="text-slate-500">Van:</span>
          <span className="text-slate-900">{preview.from}</span>
          <span className="text-slate-300">·</span>
          <span className="text-slate-500">Reply-To:</span>
          <span className="text-slate-900">{preview.reply_to}</span>
        </div>

        {preview.previews.length > 1 && (
          <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-1 overflow-x-auto">
            {preview.previews.map((p, i) => (
              <button
                key={p.recipient.id}
                type="button"
                onClick={() => onSelect(i)}
                className={`px-2 py-1 rounded text-xs whitespace-nowrap ${
                  i === selectedIdx
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {p.recipient.name || p.recipient.email}
                {p.opted_out && <span className="ml-1 text-amber-400">⚠</span>}
              </button>
            ))}
          </div>
        )}

        {item?.warnings && item.warnings.length > 0 && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-800 space-y-0.5">
            {item.warnings.map((w, i) => (
              <p key={i}>⚠ {w}</p>
            ))}
          </div>
        )}

        {item?.opted_out && (
          <div className="px-4 py-2 bg-rose-50 border-b border-rose-100 text-xs text-rose-800">
            Deze ontvanger heeft zich uitgeschreven en wordt overgeslagen bij verzending.
          </div>
        )}

        <iframe
          ref={iframeRef}
          title="email-preview"
          className="w-full bg-white"
          style={{ height: 520 }}
        />
      </div>

      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSendTest}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm"
          >
            <ChatBubbleLeftEllipsisIcon className="w-4 h-4" />
            Test naar mezelf
          </button>
          {testStatus && <span className="text-xs text-slate-500">{testStatus}</span>}
        </div>
        <span className="text-xs text-slate-500 inline-flex items-center gap-1">
          <EyeIcon className="w-3.5 h-3.5" /> Voorbeeld {selectedIdx + 1} van {preview.previews.length}
        </span>
      </div>
    </div>
  );
}

function CountChip({ label, value, tone }: { label: string; value: number; tone: 'green' | 'amber' | 'rose' }) {
  const map = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
  };
  return (
    <div className={`rounded-lg border px-3 py-2 ${map[tone]}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

function SendPanel({
  preview,
  sending,
  result,
  job,
  onSend,
  onClose,
}: {
  preview: PreviewResponse | null;
  sending: boolean;
  result: SendSyncResponse | null;
  job: JobStatus | null;
  onSend: () => void;
  onClose: () => void;
}) {
  if (result?.job_id) {
    const total = job?.total ?? preview?.counts.sendable ?? 0;
    const done = (job?.sent ?? 0) + (job?.failed ?? 0) + (job?.opt_out ?? 0);
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="font-semibold text-slate-900">Bulk-verzending bezig</h3>
          <p className="text-sm text-slate-500 mt-1">
            Job-ID <code>{result.job_id.slice(0, 8)}</code>. We sturen door op de achtergrond.
          </p>
          <div className="mt-4 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-2 flex gap-4 text-xs text-slate-600">
            <span>✓ Verzonden: {job?.sent ?? 0}</span>
            <span>✗ Mislukt: {job?.failed ?? 0}</span>
            <span>↷ Uitgeschr.: {job?.opt_out ?? 0}</span>
            <span className="ml-auto">{pct}%</span>
          </div>
          {job?.status === 'done' && (
            <div className="mt-4 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
              Klaar — {job.sent} verstuurd, {job.failed} mislukt, {job.opt_out} uitgeschreven.
            </div>
          )}
          {job?.status === 'error' && (
            <div className="mt-4 rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-800">
              Job gefaald: {job.error || 'onbekende fout'}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (result) {
    const c = result.counts;
    const success = result.success && !result.partial;
    return (
      <div className="space-y-4">
        <div
          className={`rounded-xl border p-6 ${
            success
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-amber-50 border-amber-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <CheckCircleIcon
              className={`w-7 h-7 ${success ? 'text-emerald-600' : 'text-amber-600'}`}
            />
            <h3 className="text-lg font-semibold text-slate-900">
              {success ? 'Allemaal verstuurd!' : 'Deels verstuurd'}
            </h3>
          </div>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            <Stat label="Verzonden" value={c?.sent ?? 0} />
            <Stat label="Mislukt" value={c?.failed ?? 0} />
            <Stat label="Uitgeschr." value={c?.opt_out ?? 0} />
            <Stat label="Geen toegang" value={c?.forbidden ?? 0} />
          </div>
          {result.errors && result.errors.length > 0 && (
            <details className="mt-4">
              <summary className="text-xs cursor-pointer text-slate-600 hover:text-slate-900">
                {result.errors.length} foutmelding{result.errors.length === 1 ? '' : 'en'}
              </summary>
              <ul className="mt-2 space-y-1 text-xs">
                {result.errors.map((e, i) => (
                  <li key={i} className="text-slate-700">
                    <strong>{e.email}</strong>: {e.error}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <button
            type="button"
            onClick={onClose}
            className="mt-5 inline-flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800"
          >
            Klaar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="font-semibold text-slate-900">Klaar om te versturen?</h3>
        <p className="text-sm text-slate-500 mt-1">
          We versturen vanaf jouw mailbox; replies komen direct bij jou binnen.
          {(preview?.counts.opted_out ?? 0) > 0 && (
            <> {preview?.counts.opted_out} ontvanger(s) zijn uitgeschreven en worden overgeslagen.</>
          )}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <Stat label="Verzendt naar" value={preview?.counts.sendable ?? 0} highlight />
          <Stat label="Wordt overgeslagen" value={(preview?.counts.opted_out ?? 0) + (preview?.counts.invalid ?? 0)} />
        </div>
        <button
          type="button"
          onClick={onSend}
          disabled={sending || (preview?.counts.sendable ?? 0) === 0}
          className="mt-5 inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-40"
        >
          <PaperAirplaneIcon className="w-4 h-4" />
          {sending ? 'Bezig…' : 'Definitief versturen'}
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-3 ${highlight ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'}`}>
      <div className="text-[10px] uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

interface SearchHit {
  id: string;
  type: RecipientType;
  label: string;
  email: string | null;
  meta?: string;
}

function RecipientPicker({
  recipients,
  onAdd,
  onRemove,
  onContinue,
}: {
  recipients: ComposeRecipientRef[];
  onAdd: (r: ComposeRecipientRef) => void;
  onRemove: (id: string, type: RecipientType) => void;
  onContinue: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [filterType, setFilterType] = useState<'both' | 'prospect' | 'customer'>('both');

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    let active = true;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const hits: SearchHit[] = [];
        const reqs: Promise<unknown>[] = [];
        if (filterType !== 'customer') {
          reqs.push(
            adminFetch(
              `/api/admin/prospects?search=${encodeURIComponent(query)}&limit=10`,
            )
              .then(r => r.json())
              .then(j => {
                const items = j.prospects || j.items || [];
                for (const p of items) {
                  if (!p.email) continue;
                  hits.push({
                    id: p.id,
                    type: 'prospect',
                    label: p.contact_person || p.company_name,
                    email: p.email,
                    meta: p.company_name,
                  });
                }
              })
              .catch(() => {}),
          );
        }
        if (filterType !== 'prospect') {
          reqs.push(
            adminFetch(
              `/api/admin/customers?search=${encodeURIComponent(query)}&limit=10`,
            )
              .then(r => r.json())
              .then(j => {
                const items = j.customers || [];
                for (const c of items) {
                  if (!c.email) continue;
                  hits.push({
                    id: c.id,
                    type: 'customer',
                    label: c.contact_person || c.name,
                    email: c.email,
                    meta: c.name,
                  });
                }
              })
              .catch(() => {}),
          );
        }
        await Promise.all(reqs);
        if (active) setResults(hits);
      } finally {
        if (active) setSearching(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query, filterType]);

  const isAdded = (h: SearchHit) =>
    recipients.some(r => r.id === h.id && r.type === h.type);

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-slate-100 px-4 py-3 text-xs text-slate-600 flex items-start gap-2">
        <UsersIcon className="w-4 h-4 mt-0.5 text-slate-500" />
        <p>Zoek prospects en/of klanten om aan deze mailing toe te voegen.</p>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Naam, bedrijf of e-mail…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
          />
        </div>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value as typeof filterType)}
          className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
        >
          <option value="both">Beide</option>
          <option value="prospect">Prospects</option>
          <option value="customer">Klanten</option>
        </select>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white max-h-72 overflow-y-auto">
        {searching && <p className="p-3 text-xs text-slate-500">Zoeken…</p>}
        {!searching && query.trim().length < 2 && (
          <p className="p-3 text-xs text-slate-500">Typ minstens 2 tekens om te zoeken.</p>
        )}
        {!searching && query.trim().length >= 2 && results.length === 0 && (
          <p className="p-3 text-xs text-slate-500">Geen resultaten.</p>
        )}
        {results.map(h => (
          <button
            type="button"
            key={`${h.type}-${h.id}`}
            onClick={() => onAdd({ type: h.type, id: h.id, label: h.label })}
            disabled={isAdded(h)}
            className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 flex items-center gap-2 disabled:opacity-50"
          >
            <span
              className={`text-[10px] uppercase font-bold tracking-wide rounded px-1.5 py-0.5 ${
                h.type === 'prospect'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {h.type === 'prospect' ? 'Prospect' : 'Klant'}
            </span>
            <span className="font-medium text-slate-900 text-sm">{h.label}</span>
            {h.meta && <span className="text-xs text-slate-500 truncate">{h.meta}</span>}
            {isAdded(h) ? (
              <span className="ml-auto text-xs text-slate-400">Toegevoegd</span>
            ) : (
              <PlusIcon className="ml-auto w-4 h-4 text-slate-400" />
            )}
          </button>
        ))}
      </div>

      {recipients.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-700 mb-2">
            {recipients.length} ontvanger{recipients.length === 1 ? '' : 's'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {recipients.map(r => (
              <span
                key={`${r.type}-${r.id}`}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
              >
                <span className="text-[9px] uppercase font-bold opacity-60">
                  {r.type === 'prospect' ? 'P' : 'K'}
                </span>
                {r.label || r.id.slice(0, 6)}
                <button
                  type="button"
                  onClick={() => onRemove(r.id, r.type)}
                  className="text-slate-400 hover:text-slate-700 ml-1"
                  aria-label="Verwijderen"
                >
                  <XMarkIcon className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onContinue}
        disabled={recipients.length === 0}
        className="inline-flex items-center gap-1 rounded-lg bg-slate-900 hover:bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
      >
        Doorgaan met {recipients.length} ontvanger{recipients.length === 1 ? '' : 's'} →
      </button>
    </div>
  );
}
