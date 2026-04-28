'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { XMarkIcon, CheckIcon, UserPlusIcon } from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';
import type { AdminUserOption } from './ProspectDrawer';

interface Props {
  open: boolean;
  onClose: () => void;
  prospectIds: string[];
  ams: AdminUserOption[];
  onDone: () => void;
}

type Strategy = 'specific_am' | 'round_robin' | 'unassign';

export function BulkAssignDialog({ open, onClose, prospectIds, ams, onDone }: Props) {
  const [strategy, setStrategy] = useState<Strategy>('specific_am');
  const [amId, setAmId] = useState<string>('');
  const [poolIds, setPoolIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const togglePool = (id: string) => {
    setPoolIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        prospect_ids: prospectIds,
        strategy,
      };
      if (strategy === 'specific_am') {
        if (!amId) {
          setError('Kies een account manager');
          setSubmitting(false);
          return;
        }
        body.account_manager_id = amId;
      }
      if (strategy === 'round_robin') {
        if (poolIds.size === 0) {
          setError('Kies minimaal 1 account manager');
          setSubmitting(false);
          return;
        }
        body.account_manager_ids = Array.from(poolIds);
      }
      const res = await adminFetch('/api/admin/prospects/bulk-assign', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Toewijzen mislukt');
      } else {
        onDone();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <UserPlusIcon className="h-5 w-5 text-brand-purple" />
            Bulk-toewijzen ({prospectIds.length})
          </h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-3 gap-2">
            {([
              { id: 'specific_am', label: 'Eén AM' },
              { id: 'round_robin', label: 'Round-robin' },
              { id: 'unassign', label: 'Unassign' },
            ] as { id: Strategy; label: string }[]).map(o => (
              <button
                key={o.id}
                type="button"
                onClick={() => setStrategy(o.id)}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  strategy === o.id
                    ? 'border-brand-purple bg-brand-purple/5 text-brand-purple'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          {strategy === 'specific_am' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Account manager</label>
              <select
                value={amId}
                onChange={e => setAmId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-purple/50"
              >
                <option value="">— Kies AM —</option>
                {ams.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}

          {strategy === 'round_robin' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                AM-pool ({poolIds.size} geselecteerd)
              </label>
              <div className="grid max-h-48 grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {ams.length === 0 && (
                  <p className="px-2 py-3 text-center text-xs text-slate-400">Geen AMs beschikbaar.</p>
                )}
                {ams.map(a => {
                  const checked = poolIds.has(a.id);
                  return (
                    <label
                      key={a.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePool(a.id)}
                        className="h-4 w-4 rounded border-slate-300 text-brand-purple focus:ring-brand-purple"
                      />
                      <span className="text-sm text-slate-800">{a.name}</span>
                    </label>
                  );
                })}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Prospects worden gelijkmatig verdeeld over de geselecteerde AMs.
              </p>
            </div>
          )}

          {strategy === 'unassign' && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {prospectIds.length} prospects worden losgekoppeld van hun account manager.
            </p>
          )}

          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Annuleren
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-white hover:bg-brand-purple/90 disabled:opacity-50"
          >
            <CheckIcon className="h-4 w-4" />
            Toewijzen
          </button>
        </div>
      </motion.div>
    </div>
  );
}
