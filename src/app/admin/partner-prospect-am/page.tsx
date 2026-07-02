'use client';

import { useCallback, useEffect, useState } from 'react';
import { UserGroupIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';
import {
  type PartnerProspectAmAssignee,
  type PartnerProspectAmConfigDoc,
  type PartnerProspectAmStrategy,
} from '@/lib/partnerProspectAssignment';
import {
  PARTNER_PROSPECT_BRANCH_SLUGS,
  humanizePartnerBranchLabel,
} from '@/lib/partnerProspectConstants';

type AdminOption = {
  id: string;
  name: string;
  email: string | null;
  role: string;
  is_account_manager: boolean | null;
};

type PartnerBranchOption = { slug: string; label: string };

const STRATEGY_OPTIONS: { value: PartnerProspectAmStrategy; label: string; hint: string }[] = [
  { value: 'single', label: 'Vaste AM', hint: 'Precies één AM in de pool; elke nieuwe prospect gaat naar die persoon.' },
  {
    value: 'round_robin',
    label: 'Om de beurt (balans)',
    hint: 'Per nieuwe prospect: de AM in de pool met het minst partner-prospects in de laatste 90 dagen.',
  },
  {
    value: 'weighted_random',
    label: 'Willekeurig met gewicht',
    hint: 'Kans verdeeld volgens het gewicht per AM (hoger = vaker).',
  },
];

export default function PartnerProspectAmPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminOption[]>([]);
  const [strategy, setStrategy] = useState<PartnerProspectAmStrategy>('single');
  const [assignees, setAssignees] = useState<PartnerProspectAmAssignee[]>([
    { admin_user_id: '', weight: 1 },
  ]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [configDoc, setConfigDoc] = useState<PartnerProspectAmConfigDoc>({});
  const [partnerBranches, setPartnerBranches] = useState<PartnerBranchOption[]>(
    PARTNER_PROSPECT_BRANCH_SLUGS.map(slug => ({ slug, label: humanizePartnerBranchLabel(slug) })),
  );
  const [selectedBranch, setSelectedBranch] = useState<string>(
    PARTNER_PROSPECT_BRANCH_SLUGS[0],
  );

  const applyBranchToForm = useCallback(
    (branch: string, doc: PartnerProspectAmConfigDoc) => {
      const bc = doc[branch];
      if (bc?.assignees?.length) {
        setStrategy(bc.strategy);
        setAssignees(bc.assignees.map(a => ({ admin_user_id: a.admin_user_id, weight: a.weight ?? 1 })));
      } else {
        setStrategy('single');
        setAssignees([{ admin_user_id: '', weight: 1 }]);
      }
    },
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch('/api/admin/partner-prospect-am');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Laden mislukt');
        setLoading(false);
        return;
      }
      setUsers(data.users || []);
      setUpdatedAt(data.updated_at ?? null);
      const doc = (data.config as PartnerProspectAmConfigDoc) || {};
      setConfigDoc(doc);
      const apiBranches = Array.isArray(data.branches) ? (data.branches as PartnerBranchOption[]) : [];
      const merged: PartnerBranchOption[] = [];
      const seen = new Set<string>();
      for (const b of apiBranches) {
        if (!b?.slug || seen.has(b.slug)) continue;
        seen.add(b.slug);
        merged.push({ slug: b.slug, label: b.label || humanizePartnerBranchLabel(b.slug) });
      }
      for (const slug of PARTNER_PROSPECT_BRANCH_SLUGS) {
        if (seen.has(slug)) continue;
        seen.add(slug);
        merged.push({ slug, label: humanizePartnerBranchLabel(slug) });
      }
      setPartnerBranches(merged);
      setSelectedBranch(prev => {
        const stillSelected = merged.some(b => b.slug === prev);
        const branchToShow = stillSelected ? prev : merged[0]?.slug ?? prev;
        applyBranchToForm(branchToShow, doc);
        return branchToShow;
      });
    } catch {
      setError('Laden mislukt');
    }
    setLoading(false);
  }, [applyBranchToForm]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setError(null);
    const cleaned = assignees.filter(a => a.admin_user_id.trim());
    if (cleaned.length === 0) {
      setError('Voeg minimaal één accountmanager toe.');
      setSaving(false);
      return;
    }
    if (strategy === 'single' && cleaned.length !== 1) {
      setError('Bij "Vaste AM" mag je maar één accountmanager kiezen (of wissel van strategie).');
      setSaving(false);
      return;
    }
    const config: PartnerProspectAmConfigDoc = {
      ...configDoc,
      [selectedBranch]: { strategy, assignees: cleaned },
    };
    try {
      const res = await adminFetch('/api/admin/partner-prospect-am', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Opslaan mislukt');
        setSaving(false);
        return;
      }
      await load();
    } catch {
      setError('Opslaan mislukt');
    }
    setSaving(false);
  };

  const addRow = () => setAssignees(prev => [...prev, { admin_user_id: '', weight: 1 }]);
  const removeRow = (i: number) => setAssignees(prev => prev.filter((_, idx) => idx !== i));

  const onBranchChange = (branch: string) => {
    const merged: PartnerProspectAmConfigDoc = {
      ...configDoc,
      [selectedBranch]: {
        strategy,
        assignees: assignees.filter(a => a.admin_user_id.trim()),
      },
    };
    setConfigDoc(merged);
    setSelectedBranch(branch);
    applyBranchToForm(branch, merged);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 sm:text-2xl">
          <UserGroupIcon className="h-7 w-7 text-brand-purple" />
          Partner-prospects — accountmanagers
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Nieuwe prospects voor partner-branches ({partnerBranches.map(b => b.slug).join(', ')}) via webhook, import of
          backfill krijgen automatisch een accountmanager volgens onderstaande regels per branch.
        </p>
        {updatedAt && (
          <p className="mt-1 text-xs text-slate-400">Laatst opgeslagen in instellingen: {new Date(updatedAt).toLocaleString('nl-NL')}</p>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
      ) : (
        <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Partner-branch</label>
            <select
              value={selectedBranch}
              onChange={e => onBranchChange(e.target.value)}
              className="mt-2 w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            >
              {partnerBranches.map(b => (
                <option key={b.slug} value={b.slug}>
                  {b.label} ({b.slug})
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-slate-500">
              Branches met &quot;Partner-branche&quot; aan in Beheer → Branches verschijnen automatisch in deze lijst.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Verdelingsstrategie</label>
            <select
              value={strategy}
              onChange={e => setStrategy(e.target.value as PartnerProspectAmStrategy)}
              className="mt-2 w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            >
              {STRATEGY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-sm text-slate-500">{STRATEGY_OPTIONS.find(o => o.value === strategy)?.hint}</p>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">AM-pool</label>
              <button
                type="button"
                onClick={addRow}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Rij
              </button>
            </div>
            <div className="mt-3 space-y-3">
              {assignees.map((row, i) => (
                <div key={i} className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                  <div className="min-w-[200px] flex-1">
                    <span className="text-[11px] font-medium text-slate-500">Accountmanager</span>
                    <select
                      value={row.admin_user_id}
                      onChange={e => {
                        const v = e.target.value;
                        setAssignees(prev => prev.map((r, j) => (j === i ? { ...r, admin_user_id: v } : r)));
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                    >
                      <option value="">— kies —</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                          {u.is_account_manager ? ' (AM)' : ''} — {u.email || u.role}
                        </option>
                      ))}
                    </select>
                  </div>
                  {(strategy === 'weighted_random' || assignees.length > 1) && (
                    <div className="w-24">
                      <span className="text-[11px] font-medium text-slate-500">Gewicht</span>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={row.weight ?? 1}
                        onChange={e => {
                          const w = parseFloat(e.target.value);
                          setAssignees(prev =>
                            prev.map((r, j) => (j === i ? { ...r, weight: Number.isFinite(w) ? w : 1 } : r)),
                          );
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                        disabled={strategy !== 'weighted_random'}
                        title={strategy !== 'weighted_random' ? 'Alleen bij gewogen willekeur' : undefined}
                      />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    disabled={assignees.length <= 1}
                    className="inline-flex min-h-10 min-w-10 items-center justify-center rounded p-2.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                    aria-label="Verwijder rij"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-white hover:bg-brand-purple/90 disabled:opacity-50"
            >
              {saving ? 'Opslaan…' : 'Opslaan'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
