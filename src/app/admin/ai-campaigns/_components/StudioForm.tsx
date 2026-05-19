'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { SparklesIcon, RocketLaunchIcon, ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';

interface BranchOption { slug: string; name: string; is_active: boolean }

interface Demand {
  branch: string;
  capacityOpen: number;
  activeBatches: number;
  leadsLast7d: number;
  needMoreVolume: boolean;
  openRatio: number;
}

interface GeneratedVariant {
  id: string;
  headline: string;
  primary_text: string;
  description: string | null;
  cta: string;
  image_url: string | null;
  meta_image_hash: string | null;
  status: string;
  policy_precheck: { regex_warnings?: string[]; judge_verdict?: string; judge_reason?: string };
}

interface Props {
  masterEnabled: boolean;
  onLaunched: () => void;
}

export default function StudioForm({ masterEnabled, onLaunched }: Props) {
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [demand, setDemand] = useState<Demand[]>([]);

  const [branch, setBranch] = useState<string>('');
  const [pageId, setPageId] = useState('');
  const [leadFormId, setLeadFormId] = useState('');
  const [audienceProblem, setAudienceProblem] = useState('');
  const [audienceMotivation, setAudienceMotivation] = useState('');
  const [countries, setCountries] = useState<string>('NL');
  const [dailyBudgetEur, setDailyBudgetEur] = useState<string>('25');
  const [maxTotalEur, setMaxTotalEur] = useState<string>('250');
  const [variantCount, setVariantCount] = useState<number>(4);
  const [isTestMode, setIsTestMode] = useState<boolean>(true);
  const [specialAdCategory, setSpecialAdCategory] = useState<'NONE' | 'CREDIT' | 'EMPLOYMENT' | 'HOUSING' | 'ISSUES_ELECTIONS_POLITICS'>('NONE');
  const [skipImages, setSkipImages] = useState<boolean>(false);

  const [generating, setGenerating] = useState<boolean>(false);
  const [launching, setLaunching] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [briefId, setBriefId] = useState<string | null>(null);
  const [variants, setVariants] = useState<GeneratedVariant[]>([]);

  const load = useCallback(async () => {
    const [bRes, dRes] = await Promise.all([
      adminFetch('/api/admin/branches'),
      adminFetch('/api/admin/ai-campaigns/demand'),
    ]);
    if (bRes.ok) {
      const d = await bRes.json();
      const list = (d.branches || []).filter((b: BranchOption) => b.is_active);
      setBranches(list);
      if (!branch && list[0]) setBranch(list[0].slug);
    }
    if (dRes.ok) {
      const d = await dRes.json();
      setDemand(d.demand || []);
    }
  }, [branch]);

  useEffect(() => { load(); }, [load]);

  const branchDemand = demand.find(d => d.branch === branch) || null;

  const submitGenerate = async () => {
    setError(null);
    setVariants([]);
    setBriefId(null);
    setGenerating(true);
    try {
      const body = {
        branch,
        target_audience: {
          probleem: audienceProblem,
          motivatie: audienceMotivation,
        },
        geographic_targeting: {
          countries: countries.split(',').map(c => c.trim().toUpperCase()).filter(Boolean),
        },
        daily_budget_cents: Math.round(parseFloat(dailyBudgetEur) * 100),
        max_total_budget_cents: Math.round(parseFloat(maxTotalEur) * 100),
        lead_form_id: leadFormId,
        page_id: pageId,
        special_ad_category: specialAdCategory,
        is_test_mode: isTestMode,
        variant_count: variantCount,
        skip_images: skipImages,
        skip_judge: false,
      };
      const res = await adminFetch('/api/admin/ai-campaigns/generate', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || 'Genereren mislukt');
        return;
      }
      setBriefId(data.brief_id);
      setVariants(data.variants || []);
    } finally {
      setGenerating(false);
    }
  };

  const submitLaunch = async (goLive: boolean) => {
    if (!briefId) return;
    setLaunching(true);
    setError(null);
    try {
      const res = await adminFetch('/api/admin/ai-campaigns/launch', {
        method: 'POST',
        body: JSON.stringify({ brief_id: briefId, go_live: goLive }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || 'Launch mislukt');
        return;
      }
      onLaunched();
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr,1.3fr]">
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Brief</h2>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Branche</label>
          <select
            value={branch}
            onChange={e => setBranch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            {branches.map(b => (
              <option key={b.slug} value={b.slug}>{b.name}</option>
            ))}
          </select>
          {branchDemand && (
            <p className="mt-1 text-xs text-slate-500">
              Open klantcapaciteit: <span className="font-medium">{branchDemand.capacityOpen}</span>{' '}
              ({branchDemand.activeBatches} actieve batches) · leads laatste 7d: {branchDemand.leadsLast7d}
              {branchDemand.needMoreVolume && (
                <span className="ml-2 text-emerald-600">vraag &gt; aanbod</span>
              )}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Page ID</label>
            <input
              value={pageId}
              onChange={e => setPageId(e.target.value)}
              placeholder="123456789012345"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Lead form ID</label>
            <input
              value={leadFormId}
              onChange={e => setLeadFormId(e.target.value)}
              placeholder="098765432109876"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Probleem dat de doelgroep heeft</label>
          <textarea
            value={audienceProblem}
            onChange={e => setAudienceProblem(e.target.value)}
            rows={2}
            placeholder="bv. hoge energierekening en piekverbruik in de winter"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Motivatie / trigger</label>
          <textarea
            value={audienceMotivation}
            onChange={e => setAudienceMotivation(e.target.value)}
            rows={2}
            placeholder="bv. willen onafhankelijk worden van de leverancier"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Landen (CSV)</label>
            <input
              value={countries}
              onChange={e => setCountries(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Daily budget (€)</label>
            <input
              type="number" min={1} step={1}
              value={dailyBudgetEur}
              onChange={e => setDailyBudgetEur(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Max totaal (€)</label>
            <input
              type="number" min={1} step={1}
              value={maxTotalEur}
              onChange={e => setMaxTotalEur(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Varianten</label>
            <input
              type="number" min={1} max={8}
              value={variantCount}
              onChange={e => setVariantCount(parseInt(e.target.value || '4', 10))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Special Ad Category</label>
            <select
              value={specialAdCategory}
              onChange={e => setSpecialAdCategory(e.target.value as typeof specialAdCategory)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="NONE">Geen</option>
              <option value="HOUSING">Housing</option>
              <option value="CREDIT">Credit</option>
              <option value="EMPLOYMENT">Employment</option>
              <option value="ISSUES_ELECTIONS_POLITICS">Issues/Elections/Politics</option>
            </select>
          </div>
          <div className="flex flex-col justify-end">
            <label className="inline-flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={isTestMode} onChange={e => setIsTestMode(e.target.checked)} />
              Test-modus (start PAUSED, +1u start_time)
            </label>
            <label className="mt-1 inline-flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={skipImages} onChange={e => setSkipImages(e.target.checked)} />
              Geen images (alleen copy)
            </label>
          </div>
        </div>

        <button
          onClick={submitGenerate}
          disabled={!masterEnabled || generating || !branch || !pageId || !leadFormId}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-button-gradient px-3.5 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-50"
        >
          {generating ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <SparklesIcon className="h-4 w-4" />}
          {generating ? 'AI genereert…' : 'Genereer varianten'}
        </button>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Gegenereerde varianten</h2>
            {variants.length > 0 && (
              <span className="text-xs text-slate-500">{variants.length} stuks</span>
            )}
          </div>

          {variants.length === 0 ? (
            <p className="text-xs text-slate-400">Nog geen varianten. Vul links de brief in en klik op genereren.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {variants.map(v => {
                const blocked = v.status === 'failed' || v.policy_precheck?.judge_verdict === 'block';
                return (
                  <motion.div
                    key={v.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`overflow-hidden rounded-lg border ${
                      blocked ? 'border-rose-200 bg-rose-50/40' : 'border-slate-200 bg-white'
                    }`}
                  >
                    {v.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.image_url} alt="creative" className="aspect-square w-full object-cover" />
                    ) : (
                      <div className="flex aspect-square w-full items-center justify-center bg-slate-100 text-xs text-slate-400">
                        geen image
                      </div>
                    )}
                    <div className="space-y-1 p-3">
                      <p className="text-xs font-semibold text-slate-900">{v.headline}</p>
                      <p className="line-clamp-3 text-[11px] text-slate-600">{v.primary_text}</p>
                      <p className="text-[10px] text-slate-400">{v.description}</p>
                      <div className="flex items-center justify-between pt-1 text-[10px]">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{v.cta}</span>
                        {blocked ? (
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-700">policy block</span>
                        ) : (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">draft</span>
                        )}
                      </div>
                      {v.policy_precheck?.regex_warnings && v.policy_precheck.regex_warnings.length > 0 && (
                        <p className="pt-1 text-[10px] text-amber-700">
                          warnings: {v.policy_precheck.regex_warnings.join(', ')}
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {briefId && variants.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Lanceer naar Meta</h3>
            <p className="mb-3 text-xs text-slate-500">
              Test-modus = altijd PAUSED + start_time over 1u. Zonder test-modus en met &ldquo;direct live&rdquo; activeren we
              de adset en campagne meteen (na budget-reservering).
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => submitLaunch(false)}
                disabled={launching}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {launching ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <RocketLaunchIcon className="h-4 w-4" />}
                Push naar Meta (PAUSED)
              </button>
              <button
                onClick={() => submitLaunch(true)}
                disabled={launching || isTestMode}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50"
                title={isTestMode ? 'Schakel testmodus uit voor directe activatie' : 'Direct activeren'}
              >
                {launching ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <RocketLaunchIcon className="h-4 w-4" />}
                Direct live (ACTIVE)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
