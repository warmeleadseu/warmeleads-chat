'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon, PlusIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';
import { useAdmin } from '../adminContext';
import { leaderboardYearMonthFromDate } from '@/lib/amLeaderboardRules';

type BatchLine = {
  batch_id: string;
  customer_name: string;
  branch: string;
  batch_kind: string | null;
  total_price: number;
  created_at: string;
  excluded: boolean;
  exclusion?: { id: string; reason: string | null; created_at: string };
};

type ManualLine = {
  id: string;
  label: string;
  amount_euro: number;
  counts_as_batch: number;
  created_at: string;
};

type AmTargetRow = {
  id: string;
  label: string;
  target_type: string;
  target_type_label: string;
  target_value: number;
  bonus_amount: number;
  period_start: string;
  period_end: string;
  notes: string | null;
  status: string;
  current_value: number;
  progress_pct: number;
};

type AmRow = {
  id: string;
  name: string;
  revenue_from_batches: number;
  bulk_revenue: number;
  leaderboard_total: number;
  leaderboard_batches: number;
  targets: AmTargetRow[];
  included_batches: BatchLine[];
  excluded_batches: BatchLine[];
  manual_lines: ManualLine[];
};

function monthOptions(): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < 14; i++) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const y = x.getFullYear();
    const m = x.getMonth() + 1;
    out.push(`${y}-${String(m).padStart(2, '0')}`);
  }
  return out;
}

const TARGET_STATUS: Record<string, string> = {
  active: 'Actief',
  completed: 'Behaald',
  missed: 'Niet behaald',
  cancelled: 'Geannuleerd',
};

function formatTargetDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' });
}

function eur(n: number) {
  return n.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
}

export default function AmLeaderboardPage() {
  const { user } = useAdmin();
  const isSuper = user.role === 'superadmin';
  const months = useMemo(() => monthOptions(), []);
  const [yearMonth, setYearMonth] = useState(() => leaderboardYearMonthFromDate());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<AmRow[]>([]);
  const [bulkTrunc, setBulkTrunc] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const [manualAm, setManualAm] = useState('');
  const [manualLabel, setManualLabel] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualCountsBatch, setManualCountsBatch] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch(`/api/admin/am-leaderboard-rules?year_month=${encodeURIComponent(yearMonth)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error || 'Laden mislukt');
        setRows([]);
        return;
      }
      setRows(
        ((data as { account_managers?: AmRow[] }).account_managers || []).map(r => ({
          ...r,
          targets: r.targets ?? [],
        })),
      );
      setBulkTrunc(Boolean((data as { bulk_assignments_truncated?: boolean }).bulk_assignments_truncated));
    } catch {
      setError('Netwerkfout');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [yearMonth]);

  useEffect(() => {
    if (isSuper) void load();
  }, [isSuper, load]);

  const excludeBatch = async (batchId: string) => {
    const reason = window.prompt('Optionele reden voor uitsluiting (zichtbaar in audit):') ?? '';
    setBusy(`ex-${batchId}`);
    try {
      const res = await adminFetch('/api/admin/am-leaderboard-rules/exclusions', {
        method: 'POST',
        body: JSON.stringify({ year_month: yearMonth, customer_batch_id: batchId, reason: reason || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((data as { error?: string }).error || 'Mislukt');
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  };

  const restoreExclusion = async (exclusionId: string) => {
    if (!window.confirm('Uitsluiting ongedaan maken?')) return;
    setBusy(`del-ex-${exclusionId}`);
    try {
      const res = await adminFetch(`/api/admin/am-leaderboard-rules/exclusions?id=${encodeURIComponent(exclusionId)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((data as { error?: string }).error || 'Mislukt');
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  };

  const addManual = async () => {
    if (!manualAm || !manualLabel.trim()) {
      alert('Kies een AM en vul een label in.');
      return;
    }
    const amt = Number(String(manualAmount).replace(',', '.'));
    if (!Number.isFinite(amt)) {
      alert('Ongeldig bedrag.');
      return;
    }
    setBusy('add-manual');
    try {
      const res = await adminFetch('/api/admin/am-leaderboard-rules/manual-lines', {
        method: 'POST',
        body: JSON.stringify({
          year_month: yearMonth,
          admin_user_id: manualAm,
          label: manualLabel.trim(),
          amount_euro: amt,
          counts_as_batch: manualCountsBatch,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((data as { error?: string }).error || 'Mislukt');
        return;
      }
      setManualLabel('');
      setManualAmount('');
      setManualCountsBatch(false);
      await load();
    } finally {
      setBusy(null);
    }
  };

  const deleteManual = async (id: string) => {
    if (!window.confirm('Handmatige regel verwijderen?')) return;
    setBusy(`del-man-${id}`);
    try {
      const res = await adminFetch(`/api/admin/am-leaderboard-rules/manual-lines?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((data as { error?: string }).error || 'Mislukt');
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  };

  if (!isSuper) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-slate-600">Alleen superadmins hebben toegang tot dit scherm.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <div>
        <h1 className="text-xl font-bold text-slate-900">AM leaderboard</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Zelfde bron als het live-dashboard: betaalde batches in de kalendermaand (plus bulk-schatting), met
          superadmin-uitsluitingen en handmatige correcties. Wijzigingen zijn zichtbaar in het activiteitenlog.
          <span className="mt-1 block text-slate-500">
            <strong>AM targets</strong> met een periode die deze maand raakt: voortgang volgens de{' '}
            <a href="/admin/am-targets" className="font-medium text-brand-purple underline">
              AM-targets
            </a>
            -definitie (o.a. omzet/batches op <code className="text-xs">customer_batches.account_manager_id</code>, kan
            afwijken van leaderboard-attributie).
          </span>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="text-sm font-medium text-slate-700">
          Maand
          <select
            className="ml-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={yearMonth}
            onChange={e => setYearMonth(e.target.value)}
          >
            {months.map(m => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          Vernieuwen
        </button>
        {bulkTrunc && <span className="text-xs font-medium text-amber-700">Bulk-telling afgekapt (veiligheid)</span>}
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-slate-800">Handmatige regel toevoegen</h2>
        <p className="mt-0.5 text-xs text-slate-500">Bedrag telt bij de AM; vink aan om ook +1 batch op het leaderboard te tonen.</p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500">AM</label>
            <select
              className="mt-0.5 min-w-[12rem] rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={manualAm}
              onChange={e => setManualAm(e.target.value)}
            >
              <option value="">— kies —</option>
              {rows.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Label</label>
            <input
              className="mt-0.5 w-56 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={manualLabel}
              onChange={e => setManualLabel(e.target.value)}
              placeholder="bv. Bonus Q2"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Bedrag €</label>
            <input
              className="mt-0.5 w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums"
              value={manualAmount}
              onChange={e => setManualAmount(e.target.value)}
              placeholder="-100 of 250"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={manualCountsBatch} onChange={e => setManualCountsBatch(e.target.checked)} />
            Telt als batch
          </label>
          <button
            type="button"
            onClick={() => void addManual()}
            disabled={!!busy}
            className="inline-flex items-center gap-1 rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            <PlusIcon className="h-4 w-4" />
            Toevoegen
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-slate-500">Laden…</p>}

      {!loading && (
        <div className="space-y-3">
          {rows.map(am => {
            const expanded = open[am.id];
            return (
              <div key={am.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setOpen(o => ({ ...o, [am.id]: !expanded }))}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                >
                  {expanded ? <ChevronDownIcon className="h-5 w-5 text-slate-400" /> : <ChevronRightIcon className="h-5 w-5 text-slate-400" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900">{am.name}</p>
                    <p className="text-xs text-slate-500">
                      Leaderboard: <span className="font-semibold text-emerald-700">{eur(am.leaderboard_total)}</span> ·{' '}
                      {am.leaderboard_batches} batches · bulk {eur(am.bulk_revenue)} · batches-subtotaal {eur(am.revenue_from_batches)}
                    </p>
                  </div>
                </button>
                {expanded && (
                  <div className="border-t border-slate-100 px-4 py-3 text-sm">
                    {am.targets.length > 0 && (
                      <>
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-violet-700">
                          AM targets (periode raakt {yearMonth})
                        </p>
                        <ul className="mb-4 space-y-2">
                          {am.targets.map(t => (
                            <li
                              key={t.id}
                              className="rounded-lg border border-violet-100 bg-violet-50/40 px-3 py-2 text-xs text-slate-800"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <span className="font-semibold text-slate-900">{t.label}</span>
                                  <span className="ml-2 text-slate-500">
                                    {t.target_type_label} · {formatTargetDate(t.period_start)} –{' '}
                                    {formatTargetDate(t.period_end)}
                                  </span>
                                  <span
                                    className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                      t.status === 'active'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : t.status === 'completed'
                                          ? 'bg-sky-100 text-sky-800'
                                          : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    {TARGET_STATUS[t.status] || t.status}
                                  </span>
                                </div>
                                <span className="shrink-0 font-bold tabular-nums text-violet-900">{t.progress_pct}%</span>
                              </div>
                              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-slate-600">
                                <span>
                                  Stand:{' '}
                                  <strong className="tabular-nums text-slate-900">
                                    {t.target_type === 'revenue' ? eur(t.current_value) : t.current_value}
                                  </strong>{' '}
                                  / doel{' '}
                                  <strong className="tabular-nums text-slate-900">
                                    {t.target_type === 'revenue' ? eur(t.target_value) : t.target_value}
                                  </strong>
                                </span>
                                {t.bonus_amount > 0 && (
                                  <span className="text-amber-800">Bonus bij halen: {eur(t.bonus_amount)}</span>
                                )}
                              </div>
                              {t.notes && <p className="mt-1 text-[11px] text-slate-500">{t.notes}</p>}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}

                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Meetellende batches</p>
                    {am.included_batches.length === 0 ? (
                      <p className="text-slate-500">Geen.</p>
                    ) : (
                      <ul className="space-y-2">
                        {am.included_batches.map(b => (
                          <li key={b.batch_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                            <span>
                              <span className="font-medium text-slate-800">{b.customer_name}</span>
                              <span className="text-slate-500"> · {b.branch}</span>
                              {b.batch_kind && b.batch_kind !== 'leads' && (
                                <span className="text-slate-400"> · {b.batch_kind}</span>
                              )}
                              <span className="ml-2 font-semibold tabular-nums text-slate-900">{eur(b.total_price)}</span>
                            </span>
                            <button
                              type="button"
                              disabled={busy === `ex-${b.batch_id}`}
                              onClick={() => void excludeBatch(b.batch_id)}
                              className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                            >
                              <XMarkIcon className="h-3.5 w-3.5" />
                              Niet op leaderboard
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    {am.excluded_batches.length > 0 && (
                      <>
                        <p className="mb-2 mt-4 text-xs font-bold uppercase tracking-wide text-amber-700">Uitgesloten (tellen niet mee)</p>
                        <ul className="space-y-2">
                          {am.excluded_batches.map(b => (
                            <li key={b.batch_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2">
                              <span>
                                <span className="font-medium text-slate-800">{b.customer_name}</span>
                                <span className="text-slate-500"> · {eur(b.total_price)}</span>
                                {b.exclusion?.reason && <span className="ml-2 text-xs text-slate-500">({b.exclusion.reason})</span>}
                              </span>
                              {b.exclusion?.id && (
                                <button
                                  type="button"
                                  disabled={busy === `del-ex-${b.exclusion.id}`}
                                  onClick={() => void restoreExclusion(b.exclusion!.id)}
                                  className="text-xs font-semibold text-brand-purple hover:underline disabled:opacity-50"
                                >
                                  Herstel
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}

                    {am.manual_lines.length > 0 && (
                      <>
                        <p className="mb-2 mt-4 text-xs font-bold uppercase tracking-wide text-sky-700">Handmatige regels</p>
                        <ul className="space-y-2">
                          {am.manual_lines.map(m => (
                            <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-sky-100 bg-sky-50/50 px-3 py-2">
                              <span>
                                <span className="font-medium text-slate-800">{m.label}</span>
                                <span className="ml-2 font-semibold tabular-nums">{eur(m.amount_euro)}</span>
                                {m.counts_as_batch === 1 && (
                                  <span className="ml-2 rounded bg-sky-200/60 px-1.5 py-0.5 text-[10px] font-bold text-sky-900">+1 batch</span>
                                )}
                              </span>
                              <button
                                type="button"
                                disabled={busy === `del-man-${m.id}`}
                                onClick={() => void deleteManual(m.id)}
                                className="text-rose-600 hover:text-rose-800 disabled:opacity-50"
                                aria-label="Verwijderen"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
