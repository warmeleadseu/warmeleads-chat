'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowPathIcon, BoltSlashIcon, PlayIcon, BeakerIcon, CpuChipIcon } from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';

interface Variant {
  id: string;
  headline: string;
  primary_text: string;
  image_url: string | null;
  status: string;
  meta_ad_id: string | null;
  scale_count: number;
  parent_variant_id: string | null;
  insights?: { spend: number; impressions: number; clicks: number; leads: number; cpl: number | null; ctr: number | null };
}

interface Experiment {
  id: string;
  brief_id: string;
  phase: string;
  meta_campaign_id: string | null;
  meta_adset_id: string | null;
  started_at: string | null;
  ended_at: string | null;
  stop_reason: string | null;
  created_at: string;
  brief?: { branch: string; target_cpl_cents: number | null; daily_budget_cents: number; is_test_mode: boolean };
  variants: Variant[];
}

interface Props { reloadKey: number }

export default function ExperimentList({ reloadKey }: Props) {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingInsights, setRefreshingInsights] = useState(false);
  const [running, setRunning] = useState<'dry' | 'live' | null>(null);
  const [lastSummary, setLastSummary] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshingInsights(true); else setLoading(true);
    const res = await adminFetch(`/api/admin/ai-campaigns/experiments${refresh ? '?refresh=1' : ''}`);
    if (res.ok) {
      const d = await res.json();
      setExperiments(d.experiments || []);
    }
    setLoading(false);
    setRefreshingInsights(false);
  }, []);

  useEffect(() => { load(false); }, [load, reloadKey]);

  const onKill = async (id: string) => {
    if (!confirm('Experiment killen? Campagne + adset gaan op PAUSED.')) return;
    const res = await adminFetch(`/api/admin/ai-campaigns/${id}/kill`, { method: 'POST' });
    if (res.ok) load(false);
  };

  const onResume = async (id: string) => {
    if (!confirm('Hervatten? Adset + campagne gaan ACTIVE en daily budget wordt gereserveerd.')) return;
    const res = await adminFetch(`/api/admin/ai-campaigns/${id}/resume`, { method: 'POST' });
    if (res.ok) load(false);
  };

  const runOptimizer = async (dryRun: boolean) => {
    if (!dryRun && !confirm('Optimizer live laten draaien? Dit kan adsets/varianten pauzeren of scalen op basis van Meta-insights.')) return;
    setRunning(dryRun ? 'dry' : 'live');
    setLastSummary(null);
    try {
      const res = await adminFetch('/api/admin/ai-campaigns/optimizer', {
        method: 'POST',
        body: JSON.stringify({ dry_run: dryRun }),
      });
      const data = await res.json();
      const a = data.actions || {};
      setLastSummary(
        `${dryRun ? '[DRY] ' : ''}${data.experimentsProcessed || 0} experimenten · ` +
        `pause=${a.pause_loser || 0} · scale=${a.scale_winner || 0} · ` +
        `kill=${a.kill_cold_funnel || 0} · no_demand=${a.no_demand || 0} · ` +
        `iterate=${a.iterate || 0}`
      );
      load(true);
    } finally {
      setRunning(null);
    }
  };

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-400">Laden…</div>;
  }
  if (experiments.length === 0) {
    return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Nog geen experimenten. Maak er één aan in de Studio.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-slate-500">
          {lastSummary && <span className="rounded-full bg-slate-100 px-2 py-1 font-mono text-[11px]">{lastSummary}</span>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => runOptimizer(true)}
            disabled={!!running}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <BeakerIcon className={`h-3.5 w-3.5 ${running === 'dry' ? 'animate-pulse' : ''}`} /> Optimizer (dry-run)
          </button>
          <button
            onClick={() => runOptimizer(false)}
            disabled={!!running}
            className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-50"
          >
            <CpuChipIcon className={`h-3.5 w-3.5 ${running === 'live' ? 'animate-pulse' : ''}`} /> Optimizer (live)
          </button>
          <button
            onClick={() => load(true)}
            disabled={refreshingInsights}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-3.5 w-3.5 ${refreshingInsights ? 'animate-spin' : ''}`} /> Ververs Meta-insights
          </button>
        </div>
      </div>

      {experiments.map(exp => (
        <motion.div
          key={exp.id}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {exp.brief?.branch || '?'} · {exp.phase}
                {exp.brief?.is_test_mode && (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">TEST</span>
                )}
              </p>
              <p className="text-xs text-slate-500">
                Daily budget €{((exp.brief?.daily_budget_cents || 0) / 100).toFixed(2)}
                {exp.brief?.target_cpl_cents != null && ` · doel CPL €${(exp.brief.target_cpl_cents / 100).toFixed(2)}`}
                {' · '}gestart {exp.started_at ? new Date(exp.started_at).toLocaleString() : '—'}
              </p>
              {exp.stop_reason && (
                <p className="mt-0.5 text-xs text-rose-600">Stopreden: {exp.stop_reason}</p>
              )}
            </div>
            <div className="flex gap-2">
              {exp.phase !== 'killed' && exp.phase !== 'completed' && (
                <button
                  onClick={() => onKill(exp.id)}
                  className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                >
                  <BoltSlashIcon className="h-3.5 w-3.5" /> Kill
                </button>
              )}
              {exp.phase === 'killed' && (
                <button
                  onClick={() => onResume(exp.id)}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
                >
                  <PlayIcon className="h-3.5 w-3.5" /> Hervatten
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {exp.variants.map(v => (
              <div key={v.id} className="overflow-hidden rounded-lg border border-slate-200">
                {v.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.image_url} alt="creative" className="aspect-square w-full object-cover" />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center bg-slate-100 text-xs text-slate-400">geen image</div>
                )}
                <div className="space-y-1 p-3">
                  <p className="text-xs font-semibold text-slate-900 line-clamp-1">{v.headline}</p>
                  <p className="line-clamp-2 text-[11px] text-slate-600">{v.primary_text}</p>
                  <div className="flex items-center justify-between pt-1 text-[10px]">
                    <span className={`rounded-full px-1.5 py-0.5 font-medium ${
                      v.status === 'live' ? 'bg-emerald-100 text-emerald-700' :
                      v.status === 'paused' ? 'bg-slate-100 text-slate-600' :
                      v.status === 'killed' || v.status === 'failed' ? 'bg-rose-100 text-rose-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>{v.status}</span>
                    {v.scale_count > 0 && (
                      <span className="text-slate-500">×{v.scale_count}</span>
                    )}
                  </div>
                  {v.insights && (
                    <div className="mt-2 space-y-0.5 rounded-md bg-slate-50 p-2 text-[10px] text-slate-700">
                      <div className="flex justify-between"><span>spend</span><span>€{v.insights.spend.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span>leads</span><span>{v.insights.leads}</span></div>
                      <div className="flex justify-between"><span>cpl</span><span>{v.insights.cpl != null ? `€${v.insights.cpl.toFixed(2)}` : '—'}</span></div>
                      <div className="flex justify-between"><span>ctr</span><span>{v.insights.ctr != null ? `${v.insights.ctr.toFixed(2)}%` : '—'}</span></div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
