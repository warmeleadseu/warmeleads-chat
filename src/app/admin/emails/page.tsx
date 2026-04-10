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
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';

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
}

const TYPE_LABELS: Record<string, string> = {
  lead_notification: 'Lead notificatie',
  daily_digest: 'Dagelijks overzicht',
  feedback_digest: 'Feedback overzicht',
  weekly_report: 'Weekrapport',
  batch_80pct: 'Batch 80%',
  batch_completed: 'Batch voltooid',
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
  test_resend: 'Test verzending',
  unknown: 'Onbekend',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('nl-NL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function EmailLogPage() {
  const [emails, setEmails] = useState<EmailEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(25);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [selectedEmail, setSelectedEmail] = useState<EmailEntry | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [testAddress, setTestAddress] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

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

  useEffect(() => { fetchEmails(); }, [fetchEmails]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const openPreview = async (id: string) => {
    setPreviewLoading(true);
    setTestResult(null);
    setTestAddress('');
    try {
      const res = await adminFetch(`/api/admin/emails/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedEmail(data);
      }
    } finally {
      setPreviewLoading(false);
    }
  };

  const sendTest = async () => {
    if (!selectedEmail || !testAddress) return;
    setTestSending(true);
    setTestResult(null);
    try {
      const res = await adminFetch('/api/admin/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_log_id: selectedEmail.id, to_email: testAddress }),
      });
      const json = await res.json();
      setTestResult(res.ok ? { ok: true, msg: 'Verzonden!' } : { ok: false, msg: json.error || 'Mislukt' });
    } catch {
      setTestResult({ ok: false, msg: 'Verzendfout' });
    } finally {
      setTestSending(false);
    }
  };

  const handleSearchInput = (val: string) => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setSearch(val);
      setPage(1);
    }, 400);
  };

  const statusBadge = (s: string) => (
    s === 'sent'
      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400"><CheckCircleIcon className="w-3.5 h-3.5" /> Verzonden</span>
      : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400"><ExclamationCircleIcon className="w-3.5 h-3.5" /> Mislukt</span>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-orange-500/20 to-amber-500/10 rounded-xl">
            <EnvelopeIcon className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">E-mails</h1>
            <p className="text-sm text-slate-400">{total} e-mail{total !== 1 ? 's' : ''} gelogd</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchEmails()} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
            <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${showFilters ? 'bg-orange-500/20 text-orange-400' : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'}`}
          >
            <FunnelIcon className="w-4 h-4" />
            Filters
          </button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="space-y-3">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Zoek op e-mail, onderwerp of naam..."
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/25"
            onChange={e => handleSearchInput(e.target.value)}
          />
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-white/[0.02] border border-white/5 rounded-lg">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Type</label>
                  <select
                    value={typeFilter}
                    onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
                    className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded text-sm text-white focus:outline-none focus:border-orange-500/50"
                  >
                    <option value="">Alle types</option>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Status</label>
                  <select
                    value={statusFilter}
                    onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                    className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded text-sm text-white focus:outline-none focus:border-orange-500/50"
                  >
                    <option value="">Alle</option>
                    <option value="sent">Verzonden</option>
                    <option value="failed">Mislukt</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Vanaf</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                    className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded text-sm text-white focus:outline-none focus:border-orange-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Tot</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={e => { setDateTo(e.target.value); setPage(1); }}
                    className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded text-sm text-white focus:outline-none focus:border-orange-500/50"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Table */}
      <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <InboxIcon className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">Geen e-mails gevonden</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Datum</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Aan</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Onderwerp</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Actie</th>
                  </tr>
                </thead>
                <tbody>
                  {emails.map((em, i) => (
                    <motion.tr
                      key={em.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors"
                    >
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{fmtDate(em.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded bg-white/5 text-xs text-slate-300">
                          {TYPE_LABELS[em.type] || em.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-white text-sm truncate max-w-[200px]">{em.to_email}</div>
                        {em.to_name && <div className="text-xs text-slate-500 truncate">{em.to_name}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-300 max-w-[260px] truncate">{em.subject}</td>
                      <td className="px-4 py-3">{statusBadge(em.status)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openPreview(em.id)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-orange-500/20 text-slate-400 hover:text-orange-400 transition-colors"
                          title="Bekijk e-mail"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
              <p className="text-xs text-slate-500">
                {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} van {total}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded bg-white/5 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeftIcon className="w-4 h-4" />
                </button>
                <span className="px-3 text-sm text-slate-400">{page} / {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded bg-white/5 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {(selectedEmail || previewLoading) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => { setSelectedEmail(null); setTestResult(null); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="relative w-full max-w-3xl max-h-[90vh] bg-[#16213E] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            >
              {previewLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : selectedEmail ? (
                <>
                  {/* Modal header */}
                  <div className="flex items-start justify-between gap-4 p-5 border-b border-white/5">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg font-semibold text-white truncate">{selectedEmail.subject}</h2>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-slate-400">
                        <span>Aan: <span className="text-slate-300">{selectedEmail.to_email}</span></span>
                        <span>{fmtDate(selectedEmail.created_at)}</span>
                        <span className="inline-flex">{statusBadge(selectedEmail.status)}</span>
                        <span className="px-1.5 py-0.5 rounded bg-white/5 text-slate-300">{TYPE_LABELS[selectedEmail.type] || selectedEmail.type}</span>
                      </div>
                      {selectedEmail.error && (
                        <p className="mt-2 text-xs text-red-400 bg-red-500/10 rounded px-2 py-1">{selectedEmail.error}</p>
                      )}
                    </div>
                    <button onClick={() => { setSelectedEmail(null); setTestResult(null); }} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors shrink-0">
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  </div>

                  {/* HTML Preview */}
                  <div className="flex-1 overflow-auto p-1">
                    <iframe
                      srcDoc={selectedEmail.html}
                      title="Email preview"
                      className="w-full border-0 rounded-lg bg-white"
                      style={{ minHeight: '400px', height: '55vh' }}
                      sandbox="allow-same-origin"
                    />
                  </div>

                  {/* Test send */}
                  <div className="p-4 border-t border-white/5 bg-white/[0.02]">
                    <div className="flex items-center gap-2">
                      <input
                        type="email"
                        value={testAddress}
                        onChange={e => setTestAddress(e.target.value)}
                        placeholder="Test e-mailadres invullen..."
                        className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/25"
                        onKeyDown={e => { if (e.key === 'Enter') sendTest(); }}
                      />
                      <button
                        onClick={sendTest}
                        disabled={testSending || !testAddress}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        {testSending ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <PaperAirplaneIcon className="w-4 h-4" />
                        )}
                        Verstuur test
                      </button>
                    </div>
                    <AnimatePresence>
                      {testResult && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className={`mt-2 text-xs ${testResult.ok ? 'text-emerald-400' : 'text-red-400'}`}
                        >
                          {testResult.ok ? <CheckCircleIcon className="w-3.5 h-3.5 inline mr-1" /> : <ExclamationCircleIcon className="w-3.5 h-3.5 inline mr-1" />}
                          {testResult.msg}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                </>
              ) : null}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
