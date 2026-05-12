'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  EnvelopeIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  PaperAirplaneIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  InboxIcon,
  ArrowPathIcon,
  SwatchIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';

/* ── Interfaces ──────────────────────────────────────────── */

interface EmailEntry {
  id: string;
  type: string;
  to_email: string;
  to_name: string | null;
  subject: string;
  status: 'sent' | 'failed';
  error: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  html?: string;
  cc_emails?: string[] | null;
  bcc_emails?: string[] | null;
}

interface TemplateEntry {
  type: string;
  label: string;
  description: string;
  category: 'klant' | 'admin' | 'website';
  subject: string;
  html: string;
}

/* ── Constants ───────────────────────────────────────────── */

const TYPE_LABELS: Record<string, string> = {
  lead_notification: 'Lead notificatie',
  daily_digest: 'Dagelijks overzicht',
  feedback_digest: 'Feedback overzicht',
  weekly_report: 'Weekrapport',
  batch_80pct: 'Batch 80%',
  batch_completed: 'Batch voltooid',
  batch_completed_admin: 'Batch voltooid (admin)',
  batch_reminder: 'Batch herinnering',
  order_confirmation: 'Bestelling bevestigd',
  invoice_open: 'Factuur (open)',
  invoice_paid: 'Factuur (betaald)',
  new_batch_admin: 'Nieuwe batch (admin)',
  mollie_error: 'Mollie fout',
  booking_confirmation: 'Afspraak bevestiging',
  booking_admin: 'Afspraak (admin)',
  booking_cancelled: 'Afspraak geannuleerd',
  portal_reminder: 'Portaal herinnering',
  am_portal_reminder: 'Portaal herinnering',
  test_resend: 'Test verzending',
  unknown: 'Onbekend',
};

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  klant: { label: 'Leadportaal / Klant', color: 'bg-emerald-100 text-emerald-700' },
  admin: { label: 'CRM / Admin', color: 'bg-blue-100 text-blue-700' },
  website: { label: 'Website', color: 'bg-purple-100 text-purple-700' },
};

function typeColor(type: string): string {
  if (type.startsWith('invoice')) return 'bg-purple-100 text-purple-700';
  if (type.startsWith('batch') || type === 'order_confirmation') return 'bg-blue-100 text-blue-700';
  if (type.startsWith('booking')) return 'bg-teal-100 text-teal-700';
  if (type === 'lead_notification') return 'bg-emerald-100 text-emerald-700';
  if (type.includes('digest') || type === 'weekly_report') return 'bg-amber-100 text-amber-700';
  if (type === 'mollie_error') return 'bg-red-100 text-red-700';
  if (type === 'test_resend') return 'bg-indigo-100 text-indigo-700';
  if (type === 'portal_reminder' || type === 'am_portal_reminder') return 'bg-sky-100 text-sky-700';
  return 'bg-slate-100 text-slate-700';
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('nl-NL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/* ── Preview Modal ───────────────────────────────────────── */

function PreviewModal({
  html,
  subject,
  meta,
  onClose,
  onTest,
}: {
  html: string;
  subject: string;
  meta?: { to_email?: string; created_at?: string; status?: string; type?: string; error?: string | null };
  onClose: () => void;
  onTest?: (address: string) => Promise<{ ok: boolean; msg: string }>;
}) {
  const [testAddress, setTestAddress] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleTest = async () => {
    if (!onTest || !testAddress) return;
    setTestSending(true);
    setTestResult(null);
    const result = await onTest(testAddress);
    setTestResult(result);
    setTestSending(false);
  };

  const statusBadge = (s: string) => (
    s === 'sent'
      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700"><CheckCircleIcon className="w-3.5 h-3.5" /> Verzonden</span>
      : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><ExclamationCircleIcon className="w-3.5 h-3.5" /> Mislukt</span>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-3xl max-h-[90vh] bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-5 border-b border-slate-200 bg-slate-50">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-slate-800 truncate">{subject}</h2>
            {meta && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-500">
                {meta.to_email && <span>Aan: <span className="text-slate-700 font-medium">{meta.to_email}</span></span>}
                {meta.created_at && <span>{fmtDate(meta.created_at)}</span>}
                {meta.status && <span className="inline-flex">{statusBadge(meta.status)}</span>}
                {meta.type && <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${typeColor(meta.type)}`}>{TYPE_LABELS[meta.type] || meta.type}</span>}
              </div>
            )}
            {meta?.error && (
              <p className="mt-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5">{meta.error}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors shrink-0">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* HTML Preview */}
        <div className="flex-1 overflow-auto bg-slate-100 p-2">
          <iframe
            srcDoc={html}
            title="Email preview"
            className="w-full border border-slate-200 rounded-xl bg-white"
            style={{ minHeight: '400px', height: '55vh' }}
            sandbox="allow-same-origin"
          />
        </div>

        {/* Test send */}
        {onTest && (
          <div className="p-4 border-t border-slate-200 bg-slate-50">
            <p className="text-xs font-medium text-slate-500 mb-2">Test verzending</p>
            <div className="flex items-center gap-2">
              <input
                type="email"
                value={testAddress}
                onChange={e => setTestAddress(e.target.value)}
                placeholder="E-mailadres invoeren..."
                className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400"
                onKeyDown={e => { if (e.key === 'Enter') handleTest(); }}
              />
              <button
                onClick={handleTest}
                disabled={testSending || !testAddress}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors"
              >
                {testSending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <PaperAirplaneIcon className="w-4 h-4" />
                )}
                Verstuur
              </button>
            </div>
            <AnimatePresence>
              {testResult && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`mt-2 flex items-center gap-1 text-xs font-medium ${testResult.ok ? 'text-emerald-600' : 'text-red-600'}`}
                >
                  {testResult.ok ? <CheckCircleIcon className="w-4 h-4" /> : <ExclamationCircleIcon className="w-4 h-4" />}
                  {testResult.msg}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ── Main Page ───────────────────────────────────────────── */

export default function EmailLogPage() {
  const [tab, setTab] = useState<'templates' | 'log'>('templates');

  // Log state
  const [emails, setEmails] = useState<EmailEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(25);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Template state
  const [templates, setTemplates] = useState<TemplateEntry[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateCategory, setTemplateCategory] = useState<string>('');

  // Preview state
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');
  const [previewMeta, setPreviewMeta] = useState<Record<string, string | null | undefined> | undefined>();
  const [previewLogId, setPreviewLogId] = useState<string | null>(null);

  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  /* ── Fetch Log ── */
  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
      if (search) params.set('search', search);
      if (typeFilter) params.set('type', typeFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);

      const res = await adminFetch(`/api/admin/emails?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setEmails(json.emails);
        setTotal(json.total);
      }
    } finally {
      setLoading(false);
    }
  }, [page, perPage, search, typeFilter, statusFilter, dateFrom, dateTo]);

  useEffect(() => { if (tab === 'log') fetchEmails(); }, [tab, fetchEmails]);

  /* ── Fetch Templates ── */
  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const res = await adminFetch('/api/admin/emails/templates');
      if (res.ok) {
        const json = await res.json();
        setTemplates(json.templates);
      }
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  useEffect(() => { if (tab === 'templates' && templates.length === 0) fetchTemplates(); }, [tab, templates.length, fetchTemplates]);

  /* ── Helpers ── */
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const openLogPreview = async (id: string) => {
    const res = await adminFetch(`/api/admin/emails/${id}`);
    if (res.ok) {
      const data = await res.json();
      setPreviewHtml(data.html);
      setPreviewSubject(data.subject);
      setPreviewMeta({ to_email: data.to_email, created_at: data.created_at, status: data.status, type: data.type, error: data.error });
      setPreviewLogId(data.id);
    }
  };

  const openTemplatePreview = (tpl: TemplateEntry) => {
    setPreviewHtml(tpl.html);
    setPreviewSubject(tpl.subject);
    setPreviewMeta(undefined);
    setPreviewLogId(null);
  };

  const closePreview = () => {
    setPreviewHtml('');
    setPreviewSubject('');
    setPreviewMeta(undefined);
    setPreviewLogId(null);
  };

  const handleTestSend = async (address: string): Promise<{ ok: boolean; msg: string }> => {
    if (!previewLogId) return { ok: false, msg: 'Kan alleen vanuit het verzendlog testen' };
    try {
      const res = await adminFetch('/api/admin/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_log_id: previewLogId, to_email: address }),
      });
      const json = await res.json();
      return res.ok ? { ok: true, msg: 'Test e-mail verzonden!' } : { ok: false, msg: json.error || 'Verzenden mislukt' };
    } catch {
      return { ok: false, msg: 'Er ging iets mis bij het verzenden' };
    }
  };

  const handleSearchInput = (val: string) => {
    setSearchInput(val);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setSearch(val);
      setPage(1);
    }, 400);
  };

  const hasActiveFilters = typeFilter || statusFilter || dateFrom || dateTo || search;

  const clearFilters = () => {
    setTypeFilter('');
    setStatusFilter('');
    setDateFrom('');
    setDateTo('');
    setSearch('');
    setSearchInput('');
    setPage(1);
  };

  const filteredTemplates = templateCategory
    ? templates.filter(t => t.category === templateCategory)
    : templates;

  const statusBadge = (s: string) => (
    s === 'sent'
      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700"><CheckCircleIcon className="w-3.5 h-3.5" /> Verzonden</span>
      : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><ExclamationCircleIcon className="w-3.5 h-3.5" /> Mislukt</span>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-xl">
            <EnvelopeIcon className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">E-mails</h1>
            <p className="text-sm text-slate-500">Alle e-mail templates en verzendlog</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
        <button
          onClick={() => setTab('templates')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'templates' ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <SwatchIcon className="w-4 h-4" />
          Templates ({templates.length})
        </button>
        <button
          onClick={() => setTab('log')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'log' ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <ClockIcon className="w-4 h-4" />
          Verzendlog ({total})
        </button>
      </div>

      {/* ════════════ TEMPLATES TAB ════════════ */}
      {tab === 'templates' && (
        <>
          {/* Category filter */}
          <div className="flex items-center gap-2 flex-wrap">
            {[{ key: '', label: 'Alle' }, ...Object.entries(CATEGORY_LABELS).map(([k, v]) => ({ key: k, label: v.label }))].map(c => (
              <button
                key={c.key}
                onClick={() => setTemplateCategory(c.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                  templateCategory === c.key
                    ? 'bg-orange-50 border-orange-200 text-orange-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {templatesLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-slate-200 border-t-orange-500 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence mode="popLayout">
                {filteredTemplates.map((tpl, i) => {
                  const cat = CATEGORY_LABELS[tpl.category];
                  return (
                    <motion.div
                      key={tpl.type}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-slate-300 hover:shadow-sm transition-all group cursor-pointer"
                      onClick={() => openTemplatePreview(tpl)}
                    >
                      {/* Mini preview */}
                      <div className="h-36 overflow-hidden bg-slate-50 relative">
                        <iframe
                          srcDoc={tpl.html}
                          title={tpl.label}
                          className="w-[200%] h-[200%] border-0 pointer-events-none"
                          style={{ transform: 'scale(0.5)', transformOrigin: 'top left' }}
                          sandbox=""
                          tabIndex={-1}
                        />
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white/80" />
                        <div className="absolute inset-0 group-hover:bg-slate-900/5 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <span className="bg-white/90 backdrop-blur-sm text-slate-700 text-xs font-medium px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5">
                            <EyeIcon className="w-3.5 h-3.5" /> Bekijk preview
                          </span>
                        </div>
                      </div>

                      {/* Card content */}
                      <div className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-semibold text-slate-800">{tpl.label}</h3>
                          {cat && (
                            <span className={`shrink-0 inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${cat.color}`}>
                              {cat.label}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2">{tpl.description}</p>
                        <p className="text-xs text-slate-400 truncate italic">{tpl.subject}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </>
      )}

      {/* ════════════ LOG TAB ════════════ */}
      {tab === 'log' && (
        <>
          {/* Search + Filters */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Zoek op e-mail, onderwerp..."
                value={searchInput}
                onChange={e => handleSearchInput(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400"
              />
            </div>
            <button
              onClick={() => fetchEmails()}
              className="p-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors"
            >
              <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-xl border transition-colors ${
                hasActiveFilters ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              <FunnelIcon className="w-5 h-5" />
            </button>
          </div>

          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
                      <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20">
                        <option value="">Alle types</option>
                        {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
                      <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20">
                        <option value="">Alle</option>
                        <option value="sent">Verzonden</option>
                        <option value="failed">Mislukt</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Datum van</label>
                      <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Datum tot</label>
                      <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
                    </div>
                  </div>
                  {hasActiveFilters && (
                    <div className="flex justify-end">
                      <button onClick={clearFilters} className="text-sm text-slate-500 hover:text-slate-700 underline">Filters wissen</button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-slate-200 border-t-orange-500 rounded-full animate-spin" />
            </div>
          ) : emails.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center py-20 text-slate-400">
              <InboxIcon className="w-16 h-16 mb-4 text-slate-300" />
              <p className="text-lg font-medium text-slate-500">Geen e-mails gevonden</p>
              <p className="text-sm mt-1">E-mails worden hier getoond zodra ze verzonden worden</p>
            </motion.div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Datum</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Type</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Aan</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Onderwerp</th>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Status</th>
                      <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Actie</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <AnimatePresence mode="popLayout">
                      {emails.map((em, i) => (
                        <motion.tr
                          key={em.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ delay: i * 0.02 }}
                          className="hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{fmtDate(em.created_at)}</td>
                          <td className="px-4 py-3"><span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${typeColor(em.type)}`}>{TYPE_LABELS[em.type] || em.type}</span></td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-slate-700 truncate max-w-[200px]">{em.to_email}</div>
                            {em.to_name && <div className="text-xs text-slate-400 truncate">{em.to_name}</div>}
                            {(em.cc_emails?.length || em.bcc_emails?.length) ? (
                              <div className="mt-0.5 text-[10px] text-slate-400 truncate max-w-[200px]">
                                {(em.cc_emails?.length ?? 0) > 0 && (
                                  <span title={em.cc_emails!.join(', ')}>
                                    <span className="font-semibold mr-0.5">Cc</span>
                                    {em.cc_emails!.length}
                                  </span>
                                )}
                                {(em.cc_emails?.length ?? 0) > 0 && (em.bcc_emails?.length ?? 0) > 0 && <span className="mx-1">·</span>}
                                {(em.bcc_emails?.length ?? 0) > 0 && (
                                  <span title={em.bcc_emails!.join(', ')}>
                                    <span className="font-semibold mr-0.5">Bcc</span>
                                    {em.bcc_emails!.length}
                                  </span>
                                )}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600 max-w-[260px] truncate">{em.subject}</td>
                          <td className="px-4 py-3">{statusBadge(em.status)}</td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => openLogPreview(em.id)} className="p-1.5 rounded-lg hover:bg-orange-50 text-slate-400 hover:text-orange-600 transition-colors" title="Bekijk e-mail">
                              <EyeIcon className="w-4 h-4" />
                            </button>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                <AnimatePresence mode="popLayout">
                  {emails.map((em, i) => (
                    <motion.div
                      key={em.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${typeColor(em.type)}`}>{TYPE_LABELS[em.type] || em.type}</span>
                        <span className="text-xs text-slate-400">{fmtDate(em.created_at)}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700 line-clamp-1">{em.subject}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{em.to_email}{em.to_name ? ` (${em.to_name})` : ''}</p>
                        {(em.cc_emails?.length || em.bcc_emails?.length) ? (
                          <p className="mt-0.5 text-[10px] text-slate-400 truncate">
                            {(em.cc_emails?.length ?? 0) > 0 && <span><span className="font-semibold mr-0.5">Cc</span>{em.cc_emails!.join(', ')}</span>}
                            {(em.cc_emails?.length ?? 0) > 0 && (em.bcc_emails?.length ?? 0) > 0 && <span className="mx-1">·</span>}
                            {(em.bcc_emails?.length ?? 0) > 0 && <span><span className="font-semibold mr-0.5">Bcc</span>{em.bcc_emails!.join(', ')}</span>}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center justify-between">
                        {statusBadge(em.status)}
                        <button onClick={() => openLogPreview(em.id)} className="flex items-center gap-1 text-xs font-medium text-orange-600 hover:text-orange-700">
                          <EyeIcon className="w-3.5 h-3.5" /> Bekijken
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl px-4 py-3">
                  <p className="text-sm text-slate-500">
                    Pagina <span className="font-medium text-slate-700">{page}</span> van <span className="font-medium text-slate-700">{totalPages}</span>
                    <span className="hidden sm:inline"> · {total} resultaten</span>
                  </p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="p-2 rounded-xl hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      <ChevronLeftIcon className="w-4 h-4 text-slate-600" />
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pn: number;
                      if (totalPages <= 5) pn = i + 1;
                      else if (page <= 3) pn = i + 1;
                      else if (page >= totalPages - 2) pn = totalPages - 4 + i;
                      else pn = page - 2 + i;
                      return (
                        <button key={pn} onClick={() => setPage(pn)} className={`w-8 h-8 rounded-xl text-sm font-medium transition-colors ${page === pn ? 'bg-orange-500 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{pn}</button>
                      );
                    })}
                    <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="p-2 rounded-xl hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      <ChevronRightIcon className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ════════════ PREVIEW MODAL ════════════ */}
      <AnimatePresence>
        {previewHtml && (
          <PreviewModal
            html={previewHtml}
            subject={previewSubject}
            meta={previewMeta}
            onClose={closePreview}
            onTest={previewLogId ? handleTestSend : undefined}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
