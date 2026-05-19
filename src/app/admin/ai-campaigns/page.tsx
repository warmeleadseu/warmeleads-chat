'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  SparklesIcon,
  SignalIcon,
  ShieldCheckIcon,
  StopIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';
import StudioForm from './_components/StudioForm';
import ExperimentList from './_components/ExperimentList';
import BudgetGuardsPanel from './_components/BudgetGuardsPanel';

type Tab = 'studio' | 'live' | 'budget';

interface BudgetGuard {
  branch: string;
  daily_budget_cents: number;
  monthly_budget_cents: number;
  spent_today_cents: number;
  spent_month_cents: number;
  openai_monthly_cap_cents: number;
  openai_spent_month_cents: number;
}

export default function AiCampaignsPage() {
  const [tab, setTab] = useState<Tab>('studio');
  const [masterEnabled, setMasterEnabled] = useState<boolean | null>(null);
  const [guards, setGuards] = useState<BudgetGuard[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  const loadGuards = useCallback(async () => {
    const res = await adminFetch('/api/admin/ai-campaigns/budget-guards');
    if (res.ok) {
      const d = await res.json();
      setGuards(d.guards || []);
      setMasterEnabled(!!d.master_enabled);
    }
  }, []);

  useEffect(() => { loadGuards(); }, [loadGuards]);

  const toggleMaster = async () => {
    if (masterEnabled === null) return;
    const next = !masterEnabled;
    if (next) {
      const ok = confirm('AI-campagnes activeren? Vanaf nu kan het systeem autonoom Meta-budget besteden (binnen de caps per branche).');
      if (!ok) return;
    }
    const res = await adminFetch('/api/admin/ai-campaigns/budget-guards', {
      method: 'POST',
      body: JSON.stringify({ enabled: next }),
    });
    if (res.ok) setMasterEnabled(next);
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">AI Meta-campagnes</h1>
          <p className="mt-0.5 text-sm text-slate-500">Genereer, lanceer en monitor AI-advertentiecampagnes in Meta.</p>
        </div>
        <button
          onClick={toggleMaster}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-bold shadow-sm transition ${
            masterEnabled
              ? 'bg-emerald-500 text-white hover:bg-emerald-600'
              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
          }`}
          disabled={masterEnabled === null}
        >
          {masterEnabled ? <PlayIcon className="h-4 w-4" /> : <StopIcon className="h-4 w-4" />}
          Master {masterEnabled ? 'AAN' : 'UIT'}
        </button>
      </div>

      {masterEnabled === false && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
        >
          AI-campagnes staan op de master-switch UIT. Genereren, lanceren en hervatten zijn geblokkeerd. Kill, monitoring en budgetbeheer blijven beschikbaar.
        </motion.div>
      )}

      <div className="mb-5 flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 text-sm font-medium">
        <button
          onClick={() => setTab('studio')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 transition ${
            tab === 'studio' ? 'bg-white text-brand-purple shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <SparklesIcon className="h-4 w-4" /> Studio
        </button>
        <button
          onClick={() => setTab('live')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 transition ${
            tab === 'live' ? 'bg-white text-brand-purple shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <SignalIcon className="h-4 w-4" /> Live experimenten
        </button>
        <button
          onClick={() => setTab('budget')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 transition ${
            tab === 'budget' ? 'bg-white text-brand-purple shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <ShieldCheckIcon className="h-4 w-4" /> Budget & veiligheid
        </button>
      </div>

      {tab === 'studio' && (
        <StudioForm
          masterEnabled={!!masterEnabled}
          onLaunched={() => { setReloadKey(k => k + 1); setTab('live'); }}
        />
      )}
      {tab === 'live' && <ExperimentList reloadKey={reloadKey} />}
      {tab === 'budget' && (
        <BudgetGuardsPanel guards={guards} onChanged={loadGuards} />
      )}
    </div>
  );
}
