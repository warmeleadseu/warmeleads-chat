'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  TrophyIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';
import { useAdmin } from '../adminContext';

interface AMTarget {
  id: string;
  admin_user_id: string;
  am_name: string;
  am_email: string;
  label: string;
  target_type: string;
  target_value: number;
  bonus_amount: number;
  period_start: string;
  period_end: string;
  notes: string | null;
  status: string;
  current_value: number;
  progress_pct: number;
  created_at: string;
}

interface AMUser {
  id: string;
  name: string;
  email: string;
}

const TYPE_LABELS: Record<string, string> = {
  revenue: 'Omzet',
  batches: 'Batches',
  new_customers: 'Nieuwe klanten',
  leads_delivered: 'Leads geleverd',
};

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-blue-100 text-blue-700',
  missed: 'bg-red-100 text-red-600',
  cancelled: 'bg-slate-100 text-slate-500',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Actief',
  completed: 'Behaald',
  missed: 'Niet behaald',
  cancelled: 'Geannuleerd',
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n);
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' });
}

function ProgressRing({ pct, size = 48, stroke = 4 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const filled = Math.min(pct, 100);
  const color = pct >= 100 ? '#10b981' : pct >= 75 ? '#f59e0b' : pct >= 50 ? '#f97316' : '#ef4444';
  const isClose = pct >= 75 && pct < 100;
  const isComplete = pct >= 100;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {(isClose || isComplete) && (
        <div
          className={`absolute inset-0 rounded-full blur-md ${isComplete ? 'bg-emerald-500/20' : 'bg-amber-500/15'}`}
          style={{ animation: isClose ? 'pulse 2s ease-in-out infinite' : undefined }}
        />
      )}
      <svg width={size} height={size} className="relative shrink-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ - (filled / 100) * circ}
          className="transition-all duration-700"
          style={isClose ? { filter: `drop-shadow(0 0 4px ${color})` } : undefined}
        />
      </svg>
    </div>
  );
}

export default function AMTargetsPage() {
  const { user } = useAdmin();
  const isSuperOrAdmin = user.role === 'superadmin' || user.role === 'admin';

  const [targets, setTargets] = useState<AMTarget[]>([]);
  const [amUsers, setAmUsers] = useState<AMUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AMTarget | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [deleting, setDeleting] = useState<AMTarget | null>(null);
  const [filterAM, setFilterAM] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const fetchTargets = useCallback(async () => {
    setLoading(true);
    const res = await adminFetch('/api/admin/am-targets');
    if (res.ok) setTargets(await res.json());
    setLoading(false);
  }, []);

  const fetchAMs = useCallback(async () => {
    if (!isSuperOrAdmin) return;
    const res = await adminFetch('/api/admin/users');
    if (res.ok) {
      const d = await res.json();
      setAmUsers((d.users || []).filter((u: any) => u.is_account_manager && u.is_active));
    }
  }, [isSuperOrAdmin]);

  useEffect(() => { fetchTargets(); fetchAMs(); }, [fetchTargets, fetchAMs]);

  const handleDelete = async () => {
    if (!deleting) return;
    await adminFetch('/api/admin/am-targets', {
      method: 'DELETE',
      body: JSON.stringify({ id: deleting.id }),
    });
    setDeleting(null);
    fetchTargets();
  };

  const filtered = targets.filter(t => {
    if (filterAM && t.admin_user_id !== filterAM) return false;
    if (filterStatus && t.status !== filterStatus) return false;
    return true;
  });

  const activeTargets = filtered.filter(t => t.status === 'active');
  const otherTargets = filtered.filter(t => t.status !== 'active');

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">AM Targets</h1>
          <p className="mt-0.5 text-sm text-slate-500">Beheer targets en bonussen voor accountmanagers</p>
        </div>
        {isSuperOrAdmin && (
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-button-gradient px-3.5 py-2 text-sm font-bold text-white shadow-sm"
          >
            <PlusIcon className="h-4 w-4" /> Nieuw target
          </button>
        )}
      </div>

      {/* Filters */}
      {isSuperOrAdmin && (
        <div className="mb-4 flex flex-wrap gap-2">
          <select
            value={filterAM}
            onChange={e => setFilterAM(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-purple/50"
          >
            <option value="">Alle accountmanagers</option>
            {amUsers.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-purple/50"
          >
            <option value="">Alle statussen</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-3">
                <div className="h-10 w-10 animate-pulse rounded-full bg-slate-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
                  <div className="h-3 w-32 animate-pulse rounded bg-slate-50" />
                </div>
              </div>
              <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center shadow-sm">
          <TrophyIcon className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm text-slate-500">
            {targets.length === 0
              ? 'Nog geen targets aangemaakt.'
              : 'Geen targets gevonden voor de huidige filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active targets as cards */}
          {activeTargets.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
                Actieve targets ({activeTargets.length})
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {activeTargets.map(t => (
                  <TargetCard
                    key={t.id}
                    target={t}
                    canEdit={isSuperOrAdmin}
                    onEdit={() => setEditing(t)}
                    onDelete={() => setDeleting(t)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Historical targets as compact table */}
          {otherTargets.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
                Afgeronde targets ({otherTargets.length})
              </h2>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/60">
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Target</th>
                        <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 sm:table-cell">AM</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Voortgang</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                        {isSuperOrAdmin && (
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Acties</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {otherTargets.map(t => (
                        <tr key={t.id} className="transition hover:bg-slate-50/50">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900 text-sm">{t.label}</div>
                            <div className="text-xs text-slate-500">
                              {TYPE_LABELS[t.target_type]} &middot; {formatDate(t.period_start)} – {formatDate(t.period_end)}
                            </div>
                          </td>
                          <td className="hidden px-4 py-3 text-sm text-slate-600 sm:table-cell">{t.am_name}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${Math.min(t.progress_pct, 100)}%`,
                                    backgroundColor: t.progress_pct >= 100 ? '#10b981' : t.progress_pct >= 50 ? '#f59e0b' : '#ef4444',
                                  }}
                                />
                              </div>
                              <span className="text-xs font-medium text-slate-600">{t.progress_pct}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[t.status] || ''}`}>
                              {STATUS_LABELS[t.status] || t.status}
                            </span>
                          </td>
                          {isSuperOrAdmin && (
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => setEditing(t)}
                                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-purple"
                                >
                                  <PencilSquareIcon className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => setDeleting(t)}
                                  className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create / Edit slide-over */}
      <AnimatePresence>
        {(showNew || editing) && (
          <TargetFormSlide
            target={editing}
            amUsers={amUsers}
            onClose={() => { setShowNew(false); setEditing(null); }}
            onSaved={() => { setShowNew(false); setEditing(null); fetchTargets(); }}
          />
        )}
      </AnimatePresence>

      {/* Delete confirmation */}
      <AnimatePresence>
        {deleting && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
              onClick={() => setDeleting(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            >
              <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                    <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Target verwijderen</h3>
                    <p className="text-sm text-slate-500">
                      Weet je zeker dat je &ldquo;{deleting.label}&rdquo; wilt verwijderen?
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleting(null)}
                    className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Annuleren
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700"
                  >
                    Verwijderen
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function TargetCard({
  target: t,
  canEdit,
  onEdit,
  onDelete,
}: {
  target: AMTarget;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isRevenue = t.target_type === 'revenue';
  const currentLabel = isRevenue ? formatCurrency(t.current_value) : t.current_value.toLocaleString('nl-NL');
  const targetLabel = isRevenue ? formatCurrency(t.target_value) : t.target_value.toLocaleString('nl-NL');
  const remaining = Math.max(0, t.target_value - t.current_value);
  const remainingLabel = isRevenue ? formatCurrency(remaining) : remaining.toLocaleString('nl-NL');

  const now = new Date();
  const start = new Date(t.period_start + 'T00:00:00');
  const end = new Date(t.period_end + 'T23:59:59');
  const totalDays = Math.max(1, (end.getTime() - start.getTime()) / 86400000);
  const elapsedDays = Math.max(0, Math.min(totalDays, (now.getTime() - start.getTime()) / 86400000));
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000));
  const timePct = Math.round((elapsedDays / totalDays) * 100);
  const isUrgent = daysLeft <= 7 && daysLeft > 0;
  const isComplete = t.progress_pct >= 100;
  const isClose = t.progress_pct >= 75 && !isComplete;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-xl border bg-white p-5 shadow-sm transition hover:shadow-md ${
        isComplete
          ? 'border-emerald-200 ring-1 ring-emerald-100'
          : isClose
          ? 'border-amber-200 ring-1 ring-amber-50'
          : 'border-slate-200'
      }`}
    >
      {isComplete && (
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-500" />
      )}
      {isClose && !isComplete && (
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 to-amber-500" />
      )}

      {canEdit && (
        <div className="absolute right-3 top-3 flex gap-1">
          <button onClick={onEdit} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-purple">
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button onClick={onDelete} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500">
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="mb-4 flex items-center gap-3">
        <ProgressRing pct={t.progress_pct} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-slate-900">{t.label}</div>
          <div className="text-xs text-slate-500">{t.am_name}</div>
        </div>
      </div>

      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-lg font-bold text-slate-900">{currentLabel}</span>
        <span className="text-sm text-slate-400">/ {targetLabel}</span>
      </div>

      {/* Remaining value display */}
      {!isComplete && remaining > 0 && (
        <div className="mb-3 flex items-center gap-1.5 text-[11px]">
          <span className={`font-bold ${isUrgent ? 'text-red-500' : 'text-slate-500'}`}>
            Nog {remainingLabel} te gaan
          </span>
          {isUrgent && (
            <span className="animate-pulse rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
              Haast!
            </span>
          )}
        </div>
      )}

      {isComplete && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-3 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700"
        >
          <span className="text-sm">🎉</span>
          Target behaald!
        </motion.div>
      )}

      <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
        <span>{TYPE_LABELS[t.target_type]}</span>
        <span className="font-bold">{t.progress_pct}%</span>
      </div>
      <div className="mb-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(t.progress_pct, 100)}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{
            backgroundColor: isComplete ? '#10b981' : t.progress_pct >= 75 ? '#f59e0b' : t.progress_pct >= 50 ? '#f97316' : '#ef4444',
            boxShadow: isClose ? '0 0 8px rgba(245, 158, 11, 0.4)' : isComplete ? '0 0 8px rgba(16, 185, 129, 0.4)' : undefined,
          }}
        />
      </div>

      {/* Time countdown */}
      <div className="mb-1.5 flex items-center justify-between text-[11px]">
        <span className="text-slate-400">
          {formatDate(t.period_start)} – {formatDate(t.period_end)}
        </span>
        <span className={`font-bold ${
          daysLeft === 0 ? 'text-red-500' : isUrgent ? 'text-amber-600' : 'text-slate-500'
        }`}>
          {daysLeft === 0 ? 'Laatste dag!' : `${daysLeft} ${daysLeft === 1 ? 'dag' : 'dagen'} over`}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${
            isUrgent ? 'bg-amber-400' : 'bg-slate-300'
          }`}
          style={{ width: `${timePct}%` }}
        />
      </div>

      {t.bonus_amount > 0 && (
        <motion.div
          className={`mt-3 flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium ${
            isComplete
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700'
          }`}
          animate={isClose && !isComplete ? { scale: [1, 1.01, 1] } : undefined}
          transition={isClose && !isComplete ? { repeat: Infinity, duration: 2 } : undefined}
        >
          <div className="flex items-center gap-1.5">
            <TrophyIcon className="h-4 w-4" />
            <span>{isComplete ? 'Bonus verdiend!' : 'Bonus'}</span>
          </div>
          <span className="font-bold">{formatCurrency(t.bonus_amount)}</span>
        </motion.div>
      )}
    </motion.div>
  );
}

function TargetFormSlide({
  target,
  amUsers,
  onClose,
  onSaved,
}: {
  target: AMTarget | null;
  amUsers: AMUser[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!target;
  const [form, setForm] = useState({
    admin_user_id: target?.admin_user_id || '',
    label: target?.label || '',
    target_type: target?.target_type || 'revenue',
    target_value: target?.target_value?.toString() || '',
    bonus_amount: target?.bonus_amount?.toString() || '0',
    period_start: target?.period_start || '',
    period_end: target?.period_end || '',
    notes: target?.notes || '',
    status: target?.status || 'active',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!form.admin_user_id || !form.label || !form.target_value || !form.period_start || !form.period_end) {
      setError('Vul alle verplichte velden in');
      return;
    }
    setSaving(true);
    setError('');

    try {
      const payload: Record<string, unknown> = { ...form };
      if (isEdit) payload.id = target!.id;

      const res = await adminFetch('/api/admin/am-targets', {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Er ging iets mis');
      }
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Er ging iets mis');
    } finally {
      setSaving(false);
    }
  };

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed inset-y-0 right-0 z-[60] w-full max-w-md overflow-y-auto bg-white shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">
            {isEdit ? 'Target bewerken' : 'Nieuw target'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Accountmanager *</label>
            <select
              value={form.admin_user_id}
              onChange={e => set('admin_user_id', e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
            >
              <option value="">Selecteer een AM...</option>
              {amUsers.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Label / omschrijving *</label>
            <input
              value={form.label}
              onChange={e => set('label', e.target.value)}
              placeholder="bijv. Q1 2026 omzettarget"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Type *</label>
              <select
                value={form.target_type}
                onChange={e => set('target_type', e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
              >
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Doelwaarde *</label>
              <input
                type="number"
                min="0"
                step={form.target_type === 'revenue' ? '0.01' : '1'}
                value={form.target_value}
                onChange={e => set('target_value', e.target.value)}
                placeholder={form.target_type === 'revenue' ? '50000' : '10'}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Bonusbedrag</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.bonus_amount}
              onChange={e => set('bonus_amount', e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Startdatum *</label>
              <input
                type="date"
                value={form.period_start}
                onChange={e => set('period_start', e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Einddatum *</label>
              <input
                type="date"
                value={form.period_end}
                onChange={e => set('period_end', e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
              />
            </div>
          </div>

          {isEdit && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
              <select
                value={form.status}
                onChange={e => set('status', e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
              >
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Notities</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-purple/50"
            />
          </div>
        </div>

        <div className="sticky bottom-0 border-t border-slate-100 bg-white px-5 py-4">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Annuleren
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 rounded-lg bg-button-gradient py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {saving ? 'Opslaan...' : isEdit ? 'Bijwerken' : 'Aanmaken'}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
