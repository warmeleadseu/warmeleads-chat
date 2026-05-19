'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowPathIcon,
  BoltSlashIcon,
  PlayIcon,
  BeakerIcon,
  CpuChipIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';

interface Variant {
  id: string;
  headline: string;
  primary_text: string;
  description: string | null;
  cta: string;
  image_url: string | null;
  status: string;
  meta_ad_id: string | null;
  meta_adset_row_id: string | null;
  scale_count: number;
  parent_variant_id: string | null;
  angle: string | null;
  creative_style: string | null;
  framework: string | null;
  predicted_cpl_cents: number | null;
  insights?: { spend: number; impressions: number; clicks: number; leads: number; cpl: number | null; ctr: number | null };
}

interface AdSet {
  id: string;
  meta_campaign_row_id: string;
  meta_adset_id: string | null;
  name: string;
  strategy_type: string;
  targeting_summary: Record<string, unknown>;
  daily_budget_cents: number | null;
  predicted_cpl_cents: number | null;
  status: string;
}

interface Campaign {
  id: string;
  experiment_id: string;
  meta_campaign_id: string | null;
  angle: string;
  rationale: string | null;
  daily_budget_cents: number;
  daily_budget_share: number;
  bid_strategy: string;
  status: string;
  adsets: AdSet[];
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
  tree_summary: Record<string, unknown> | null;
  brief?: { branch: string; target_cpl_cents: number | null; daily_budget_cents: number; is_test_mode: boolean };
  variants: Variant[];
  campaigns: Campaign[];
}

interface Rollup {
  spend: number;
  leads: number;
  cpl: number | null;
  impressions: number;
  clicks: number;
}

function rollup(variants: Variant[]): Rollup {
  let spend = 0, leads = 0, impressions = 0, clicks = 0;
  for (const v of variants) {
    if (v.insights) {
      spend += v.insights.spend || 0;
      leads += v.insights.leads || 0;
      impressions += v.insights.impressions || 0;
      clicks += v.insights.clicks || 0;
    }
  }
  return { spend, leads, impressions, clicks, cpl: leads > 0 ? spend / leads : null };
}

interface Props { reloadKey: number }

export default function ExperimentList({ reloadKey }: Props) {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingInsights, setRefreshingInsights] = useState(false);
  const [running, setRunning] = useState<'dry' | 'live' | null>(null);
  const [lastSummary, setLastSummary] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [expandedCampaign, setExpandedCampaign] = useState<Record<string, boolean>>({});

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

  const onDelete = async (id: string) => {
    if (!confirm('Verwijderen? Dit archiveert ALLE campagnes/adsets/ads in Meta (DELETED) en verbergt lokaal. Audit blijft.')) return;
    const res = await adminFetch(`/api/admin/ai-campaigns/${id}/delete`, { method: 'POST' });
    if (res.ok) load(false);
    else {
      const j = await res.json().catch(() => ({}));
      alert(`Verwijderen faalde: ${j.error || res.status}`);
    }
  };

  const runOptimizer = async (dryRun: boolean) => {
    if (!dryRun && !confirm('Optimizer live laten draaien? Dit kan adsets/varianten pauzeren of scalen.')) return;
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
        `${dryRun ? '[DRY] ' : ''}${data.experimentsProcessed || 0} exps · ` +
        `pause=${a.pause_loser || 0} · scale=${a.scale_winner || 0} · ` +
        `kill=${a.kill_cold_funnel || 0} · reallocate=${a.reallocate_budget || 0} · ` +
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
            <BeakerIcon className={`h-3.5 w-3.5 ${running === 'dry' ? 'animate-pulse' : ''}`} /> Optimizer (dry)
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
            <ArrowPathIcon className={`h-3.5 w-3.5 ${refreshingInsights ? 'animate-spin' : ''}`} /> Insights
          </button>
        </div>
      </div>

      {experiments.map(exp => {
        const overall = rollup(exp.variants);
        const isOpen = expanded[exp.id] !== false; // default open
        return (
          <motion.div
            key={exp.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="flex items-start justify-between gap-3 p-5">
              <button
                onClick={() => setExpanded(e => ({ ...e, [exp.id]: !isOpen }))}
                className="flex flex-1 items-start gap-2 text-left"
              >
                {isOpen ? <ChevronDownIcon className="mt-0.5 h-4 w-4 text-slate-400" /> : <ChevronRightIcon className="mt-0.5 h-4 w-4 text-slate-400" />}
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">
                    {exp.brief?.branch || '?'} · {exp.phase}
                    {exp.brief?.is_test_mode && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">TEST</span>
                    )}
                    {exp.campaigns.length > 1 && (
                      <span className="ml-2 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                        TREE {exp.campaigns.length}c × {exp.campaigns.reduce((s, c) => s + c.adsets.length, 0)}as
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Budget €{((exp.brief?.daily_budget_cents || 0) / 100).toFixed(2)}
                    {exp.brief?.target_cpl_cents != null && ` · doel CPL €${(exp.brief.target_cpl_cents / 100).toFixed(2)}`}
                    {' · '}gestart {exp.started_at ? new Date(exp.started_at).toLocaleString() : '—'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono">spend €{overall.spend.toFixed(2)}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono">{overall.leads} leads</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono">
                      CPL {overall.cpl != null ? `€${overall.cpl.toFixed(2)}` : '—'}
                    </span>
                  </div>
                  {exp.stop_reason && (
                    <p className="mt-1 text-xs text-rose-600">Stopreden: {exp.stop_reason}</p>
                  )}
                </div>
              </button>
              <div className="flex flex-wrap gap-2">
                {exp.phase !== 'killed' && exp.phase !== 'completed' && exp.phase !== 'deleted' && (
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
                <button
                  onClick={() => onDelete(exp.id)}
                  className="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                >
                  <TrashIcon className="h-3.5 w-3.5" /> Verwijderen
                </button>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-t border-slate-100 bg-slate-50/40 px-5 py-4"
                >
                  {exp.campaigns.length > 0 ? (
                    <CampaignTree exp={exp} expandedCampaign={expandedCampaign} setExpandedCampaign={setExpandedCampaign} />
                  ) : (
                    <FlatVariants variants={exp.variants} />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}

function CampaignTree({
  exp,
  expandedCampaign,
  setExpandedCampaign,
}: {
  exp: Experiment;
  expandedCampaign: Record<string, boolean>;
  setExpandedCampaign: (fn: (e: Record<string, boolean>) => Record<string, boolean>) => void;
}) {
  const variantsByAdset = useMemo(() => {
    const map: Record<string, Variant[]> = {};
    for (const v of exp.variants) {
      const k = v.meta_adset_row_id || 'unassigned';
      (map[k] ||= []).push(v);
    }
    return map;
  }, [exp.variants]);

  return (
    <div className="space-y-3">
      {exp.campaigns.map(c => {
        const adsetIds = c.adsets.map(a => a.id);
        const cmpVariants = adsetIds.flatMap(id => variantsByAdset[id] || []);
        const ru = rollup(cmpVariants);
        const isOpen = expandedCampaign[c.id] !== false;
        return (
          <div key={c.id} className="rounded-lg border border-purple-200 bg-white">
            <button
              onClick={() => setExpandedCampaign(prev => ({ ...prev, [c.id]: !isOpen }))}
              className="flex w-full items-start gap-2 p-3 text-left"
            >
              {isOpen ? <ChevronDownIcon className="mt-0.5 h-4 w-4 text-purple-400" /> : <ChevronRightIcon className="mt-0.5 h-4 w-4 text-purple-400" />}
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-purple-900">{c.angle}</span>
                  <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] text-purple-700">
                    {Math.round(c.daily_budget_share * 100)}% · €{(c.daily_budget_cents / 100).toFixed(2)}/d
                  </span>
                </div>
                {c.rationale && <p className="text-[11px] text-slate-600">{c.rationale}</p>}
                <div className="mt-1 flex flex-wrap gap-2 text-[10px]">
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 font-mono">spend €{ru.spend.toFixed(2)}</span>
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 font-mono">{ru.leads} leads</span>
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 font-mono">
                    CPL {ru.cpl != null ? `€${ru.cpl.toFixed(2)}` : '—'}
                  </span>
                  <span className={`rounded-full px-1.5 py-0.5 font-medium ${
                    c.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                    c.status === 'archived' ? 'bg-rose-100 text-rose-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>{c.status}</span>
                </div>
              </div>
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-2 border-t border-purple-100 px-3 py-2"
                >
                  {c.adsets.map(a => {
                    const vs = variantsByAdset[a.id] || [];
                    const asRu = rollup(vs);
                    const t = a.targeting_summary as { age_min?: number; age_max?: number; interests?: Array<{ name: string }> };
                    return (
                      <div key={a.id} className="rounded-md border border-slate-200 bg-white p-2">
                        <div className="mb-1 flex flex-wrap items-center justify-between gap-1">
                          <div>
                            <span className="text-xs font-semibold text-slate-800">{a.strategy_type}</span>
                            <span className="ml-1 text-[10px] text-slate-500">
                              {t.age_min || 18}-{t.age_max || 65}
                              {Array.isArray(t.interests) && t.interests.length > 0 && (
                                <> · {t.interests.slice(0, 2).map(i => i.name).join(', ')}</>
                              )}
                            </span>
                          </div>
                          <div className="flex gap-1 text-[10px]">
                            {a.predicted_cpl_cents != null && (
                              <span className="rounded-full bg-purple-50 px-1.5 py-0.5 text-purple-700">~€{(a.predicted_cpl_cents / 100).toFixed(2)}</span>
                            )}
                            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 font-mono">spend €{asRu.spend.toFixed(2)}</span>
                            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 font-mono">CPL {asRu.cpl != null ? `€${asRu.cpl.toFixed(2)}` : '—'}</span>
                            <span className={`rounded-full px-1.5 py-0.5 font-medium ${
                              a.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                              a.status === 'archived' ? 'bg-rose-100 text-rose-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>{a.status}</span>
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                          {vs.map(v => <VariantCard key={v.id} v={v} />)}
                        </div>
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

function FlatVariants({ variants }: { variants: Variant[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {variants.map(v => <VariantCard key={v.id} v={v} />)}
    </div>
  );
}

function VariantCard({ v }: { v: Variant }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      {v.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={v.image_url} alt="creative" className="aspect-square w-full object-cover" />
      ) : (
        <div className="flex aspect-square w-full items-center justify-center bg-slate-100 text-xs text-slate-400">geen image</div>
      )}
      <div className="space-y-1 p-2">
        {v.angle && (
          <span className="rounded-full bg-purple-50 px-1.5 py-0.5 text-[9px] font-medium text-purple-700">{v.angle}</span>
        )}
        <p className="text-xs font-semibold text-slate-900 line-clamp-1">{v.headline}</p>
        <p className="line-clamp-2 text-[11px] text-slate-600">{v.primary_text}</p>
        <div className="flex items-center justify-between pt-1 text-[10px]">
          <span className={`rounded-full px-1.5 py-0.5 font-medium ${
            v.status === 'live' ? 'bg-emerald-100 text-emerald-700' :
            v.status === 'paused' ? 'bg-slate-100 text-slate-600' :
            v.status === 'killed' || v.status === 'failed' ? 'bg-rose-100 text-rose-700' :
            'bg-amber-100 text-amber-700'
          }`}>{v.status}</span>
          {v.scale_count > 0 && <span className="text-slate-500">×{v.scale_count}</span>}
        </div>
        {v.insights && (
          <div className="mt-1 space-y-0.5 rounded-md bg-slate-50 p-1.5 text-[10px] text-slate-700">
            <div className="flex justify-between"><span>spend</span><span>€{v.insights.spend.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>leads</span><span>{v.insights.leads}</span></div>
            <div className="flex justify-between"><span>cpl</span><span>{v.insights.cpl != null ? `€${v.insights.cpl.toFixed(2)}` : '—'}</span></div>
            <div className="flex justify-between"><span>ctr</span><span>{v.insights.ctr != null ? `${v.insights.ctr.toFixed(2)}%` : '—'}</span></div>
          </div>
        )}
      </div>
    </div>
  );
}
