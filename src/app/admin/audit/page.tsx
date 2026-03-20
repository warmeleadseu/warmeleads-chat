'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardDocumentListIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  InboxIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';

interface AuditLog {
  id: string;
  admin_id: string | null;
  admin_email?: string | null;
  admin_name?: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  create_lead: 'Lead aangemaakt',
  update_lead: 'Lead bijgewerkt',
  delete_lead: 'Lead verwijderd',
  create_customer: 'Klant aangemaakt',
  update_customer: 'Klant bijgewerkt',
  delete_customer: 'Klant verwijderd',
  create_branch: 'Branche aangemaakt',
  update_branch: 'Branche bijgewerkt',
  delete_branch: 'Branche verwijderd',
  create_assignment: 'Toewijzing aangemaakt',
  delete_assignment: 'Toewijzing verwijderd',
  create_target: 'Doelgebied aangemaakt',
  update_target: 'Doelgebied bijgewerkt',
  delete_target: 'Doelgebied verwijderd',
  create_batch: 'Batch aangemaakt',
  update_batch: 'Batch bijgewerkt',
  delete_batch: 'Batch verwijderd',
  login: 'Ingelogd',
  logout: 'Uitgelogd',
  import_leads: 'Leads geïmporteerd',
  distribute_leads: 'Leads verdeeld',
  update_settings: 'Instellingen bijgewerkt',
};

const ENTITY_LABELS: Record<string, string> = {
  lead: 'Lead',
  customer: 'Klant',
  branch: 'Branche',
  assignment: 'Toewijzing',
  target: 'Doelgebied',
  batch: 'Batch',
  settings: 'Instellingen',
  admin: 'Beheerder',
};

function actionColor(action: string): string {
  if (action.startsWith('create') || action === 'import_leads')
    return 'bg-emerald-100 text-emerald-700';
  if (action.startsWith('update') || action === 'distribute_leads')
    return 'bg-blue-100 text-blue-700';
  if (action.startsWith('delete'))
    return 'bg-red-100 text-red-700';
  return 'bg-amber-100 text-amber-700';
}

function formatDate(iso: string): string {
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

function DetailsCell({ details }: { details: Record<string, unknown> | null }) {
  const [expanded, setExpanded] = useState(false);

  if (!details || Object.keys(details).length === 0) {
    return <span className="text-slate-400 italic text-sm">—</span>;
  }

  const condensed = Object.entries(details)
    .slice(0, 3)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(', ');

  const hasMore = Object.keys(details).length > 3;

  return (
    <div className="max-w-xs lg:max-w-sm">
      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="text-left text-sm text-slate-600 hover:text-slate-900 transition-colors group"
        >
          <span className="line-clamp-1">{condensed}{hasMore && '…'}</span>
          <span className="text-xs text-slate-400 group-hover:text-slate-600 ml-1">(klik voor details)</span>
        </button>
      ) : (
        <div>
          <button
            onClick={() => setExpanded(false)}
            className="text-xs text-blue-600 hover:text-blue-800 mb-1 flex items-center gap-0.5"
          >
            <ChevronUpIcon className="w-3 h-3" /> Inklappen
          </button>
          <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 overflow-x-auto max-h-48 whitespace-pre-wrap break-words">
            {JSON.stringify(details, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [action, setAction] = useState('all');
  const [entityType, setEntityType] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const [showFilters, setShowFilters] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (action !== 'all') params.set('action', action);
    if (entityType !== 'all') params.set('entity_type', entityType);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    if (search) params.set('search', search);

    try {
      const res = await adminFetch(`/api/admin/audit?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 0);
      }
    } catch (err) {
      console.error('Audit fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, action, entityType, dateFrom, dateTo, search]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const clearFilters = () => {
    setAction('all');
    setEntityType('all');
    setDateFrom('');
    setDateTo('');
    setSearch('');
    setSearchInput('');
    setPage(1);
  };

  const hasActiveFilters = action !== 'all' || entityType !== 'all' || dateFrom || dateTo || search;

  const uniqueActions = Array.from(new Set(Object.keys(ACTION_LABELS)));
  const uniqueEntities = Array.from(new Set(Object.keys(ENTITY_LABELS)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 rounded-xl">
            <ClipboardDocumentListIcon className="w-6 h-6 text-slate-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Activiteitenlog</h1>
            <p className="text-sm text-slate-500">{total} logregels gevonden</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:flex-none">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Zoek in details..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 w-full sm:w-56"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-xl border transition-colors ${
              hasActiveFilters
                ? 'bg-blue-50 border-blue-200 text-blue-600'
                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            <FunnelIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Filters */}
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
                  <label className="block text-xs font-medium text-slate-500 mb-1">Actie</label>
                  <select
                    value={action}
                    onChange={(e) => { setAction(e.target.value); setPage(1); }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="all">Alle acties</option>
                    {uniqueActions.map((a) => (
                      <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Entiteit</label>
                  <select
                    value={entityType}
                    onChange={(e) => { setEntityType(e.target.value); setPage(1); }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="all">Alle entiteiten</option>
                    {uniqueEntities.map((e) => (
                      <option key={e} value={e}>{ENTITY_LABELS[e] || e}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Datum van</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Datum tot</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              {hasActiveFilters && (
                <div className="flex justify-end">
                  <button
                    onClick={clearFilters}
                    className="text-sm text-slate-500 hover:text-slate-700 underline"
                  >
                    Filters wissen
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 text-slate-400"
        >
          <InboxIcon className="w-16 h-16 mb-4 text-slate-300" />
          <p className="text-lg font-medium text-slate-500">Geen logregels gevonden</p>
          <p className="text-sm mt-1">Pas de filters aan of probeer een andere zoekopdracht</p>
        </motion.div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Datum/Tijd</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Gebruiker</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Actie</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Entiteit</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <AnimatePresence mode="popLayout">
                  {logs.map((log, i) => (
                    <motion.tr
                      key={log.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                        {log.admin_name || log.admin_email || log.admin_id || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${actionColor(log.action)}`}>
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                        {ENTITY_LABELS[log.entity_type] || log.entity_type}
                        {log.entity_id && (
                          <span className="text-xs text-slate-400 ml-1">({log.entity_id.slice(0, 8)}…)</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <DetailsCell details={log.details} />
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
              {logs.map((log, i) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${actionColor(log.action)}`}>
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                    <span className="text-xs text-slate-400">{formatDate(log.created_at)}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-xs text-slate-400">Gebruiker</span>
                      <p className="text-slate-700 truncate">{log.admin_name || log.admin_email || log.admin_id || '—'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400">Entiteit</span>
                      <p className="text-slate-700">
                        {ENTITY_LABELS[log.entity_type] || log.entity_type}
                        {log.entity_id && (
                          <span className="text-xs text-slate-400 ml-1">({log.entity_id.slice(0, 8)}…)</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {log.details && Object.keys(log.details).length > 0 && (
                    <div>
                      <button
                        onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                      >
                        {expandedRow === log.id ? (
                          <><ChevronUpIcon className="w-3.5 h-3.5" /> Verbergen</>
                        ) : (
                          <><ChevronDownIcon className="w-3.5 h-3.5" /> Details bekijken</>
                        )}
                      </button>
                      <AnimatePresence>
                        {expandedRow === log.id && (
                          <motion.pre
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 mt-2 overflow-x-auto max-h-48 whitespace-pre-wrap break-words"
                          >
                            {JSON.stringify(log.details, null, 2)}
                          </motion.pre>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl px-4 py-3">
              <p className="text-sm text-slate-500">
                Pagina <span className="font-medium text-slate-700">{page}</span> van{' '}
                <span className="font-medium text-slate-700">{totalPages}</span>
                <span className="hidden sm:inline"> — {total} resultaten</span>
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="p-2 rounded-xl hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeftIcon className="w-4 h-4 text-slate-600" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-8 h-8 rounded-xl text-sm font-medium transition-colors ${
                        page === pageNum
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                  className="p-2 rounded-xl hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRightIcon className="w-4 h-4 text-slate-600" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
