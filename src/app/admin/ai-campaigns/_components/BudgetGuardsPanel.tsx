'use client';

import { useState } from 'react';
import { CheckIcon, PencilIcon } from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';

interface BudgetGuard {
  branch: string;
  daily_budget_cents: number;
  monthly_budget_cents: number;
  spent_today_cents: number;
  spent_month_cents: number;
  openai_monthly_cap_cents: number;
  openai_spent_month_cents: number;
}

interface Props {
  guards: BudgetGuard[];
  onChanged: () => void;
}

function eur(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}

export default function BudgetGuardsPanel({ guards, onChanged }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ daily: string; monthly: string; openai: string }>({ daily: '0', monthly: '0', openai: '0' });
  const [saving, setSaving] = useState(false);

  const startEdit = (g: BudgetGuard) => {
    setEditing(g.branch);
    setDraft({
      daily: (g.daily_budget_cents / 100).toFixed(2),
      monthly: (g.monthly_budget_cents / 100).toFixed(2),
      openai: (g.openai_monthly_cap_cents / 100).toFixed(2),
    });
  };

  const save = async (branch: string) => {
    setSaving(true);
    try {
      await adminFetch('/api/admin/ai-campaigns/budget-guards', {
        method: 'PUT',
        body: JSON.stringify({
          branch,
          daily_budget_cents: Math.round(parseFloat(draft.daily || '0') * 100),
          monthly_budget_cents: Math.round(parseFloat(draft.monthly || '0') * 100),
          openai_monthly_cap_cents: Math.round(parseFloat(draft.openai || '0') * 100),
        }),
      });
      setEditing(null);
      onChanged();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-900">Budget guards per branche</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          0 = AI uit voor die branche. De daily-cap voorkomt dat de AI-optimizer méér uitgeeft dan dit per dag.
          OpenAI-cap is een maandelijkse begrenzing op generatiekosten.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-100">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Branche</th>
              <th className="px-3 py-2 text-right">Daily cap</th>
              <th className="px-3 py-2 text-right">Today</th>
              <th className="px-3 py-2 text-right">Monthly cap</th>
              <th className="px-3 py-2 text-right">This month</th>
              <th className="px-3 py-2 text-right">OpenAI cap (mo)</th>
              <th className="px-3 py-2 text-right">OpenAI used</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {guards.map(g => {
              const isEditing = editing === g.branch;
              const overDaily = g.daily_budget_cents > 0 && g.spent_today_cents >= g.daily_budget_cents;
              return (
                <tr key={g.branch} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-800">{g.branch}</td>
                  {isEditing ? (
                    <>
                      <td className="px-3 py-1.5 text-right">
                        <input value={draft.daily} onChange={e => setDraft(d => ({ ...d, daily: e.target.value }))}
                          className="w-24 rounded-md border border-slate-200 px-2 py-1 text-right text-xs" />
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-slate-500">{eur(g.spent_today_cents)}</td>
                      <td className="px-3 py-1.5 text-right">
                        <input value={draft.monthly} onChange={e => setDraft(d => ({ ...d, monthly: e.target.value }))}
                          className="w-24 rounded-md border border-slate-200 px-2 py-1 text-right text-xs" />
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-slate-500">{eur(g.spent_month_cents)}</td>
                      <td className="px-3 py-1.5 text-right">
                        <input value={draft.openai} onChange={e => setDraft(d => ({ ...d, openai: e.target.value }))}
                          className="w-24 rounded-md border border-slate-200 px-2 py-1 text-right text-xs" />
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-slate-500">{eur(g.openai_spent_month_cents)}</td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => save(g.branch)} disabled={saving}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">
                          <CheckIcon className="h-3 w-3" /> Opslaan
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className={`px-3 py-2 text-right ${overDaily ? 'text-rose-600 font-semibold' : 'text-slate-800'}`}>{eur(g.daily_budget_cents)}</td>
                      <td className={`px-3 py-2 text-right ${overDaily ? 'text-rose-600' : 'text-slate-500'}`}>{eur(g.spent_today_cents)}</td>
                      <td className="px-3 py-2 text-right text-slate-800">{eur(g.monthly_budget_cents)}</td>
                      <td className="px-3 py-2 text-right text-slate-500">{eur(g.spent_month_cents)}</td>
                      <td className="px-3 py-2 text-right text-slate-800">{eur(g.openai_monthly_cap_cents)}</td>
                      <td className="px-3 py-2 text-right text-slate-500">{eur(g.openai_spent_month_cents)}</td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => startEdit(g)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
                          <PencilIcon className="h-3 w-3" /> Bewerken
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
        <p className="font-semibold text-slate-700">Veiligheidsmodel</p>
        <ul className="mt-1 space-y-0.5 list-disc pl-4">
          <li>De master kill-switch (knop rechtsboven) blokkeert alle generate/launch/resume calls.</li>
          <li>Per branche zet 0 in daily/monthly cap de AI volledig uit voor die branche.</li>
          <li>Reserveringen gaan via Postgres advisory lock (<code className="rounded bg-white px-1">reserve_branch_budget</code>), dus dubbele launches kunnen elkaar niet ontwijken.</li>
          <li>Test-modus op een brief lanceert altijd PAUSED met start_time over 1u — Meta loopt nooit per ongeluk live.</li>
        </ul>
      </div>
    </div>
  );
}
