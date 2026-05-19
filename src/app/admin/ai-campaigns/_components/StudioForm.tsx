'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  SparklesIcon,
  RocketLaunchIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CpuChipIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import { adminFetch } from '@/lib/adminAuth';
import { PROVINCES_NL, PROVINCES_BE } from '@/data/provinces';

interface BranchOption { slug: string; name: string; is_active: boolean }

interface Demand {
  branch: string;
  capacityOpen: number;
  activeBatches: number;
  leadsLast7d: number;
  needMoreVolume: boolean;
  openRatio: number;
}

interface LeadFormOption {
  id: string;
  name: string;
  status: string;
  page_id?: string;
  questions_count?: number;
}

interface PlannedAdSet {
  strategy_type: string;
  name: string;
  rationale: string;
  predicted_cpl_cents: number;
  targeting: {
    age_min: number;
    age_max: number;
    genders?: number[];
    interests?: Array<{ id: string; name: string }>;
    behaviors?: Array<{ id: string; name: string }>;
    custom_audiences?: Array<{ id: string; name: string }>;
    excluded_custom_audiences?: Array<{ id: string; name: string }>;
    regions?: Array<{ key: string; name: string }>;
  };
  creative_brief: {
    style: string;
    framework: string;
    tone: string;
    hook: string;
    must_include?: string[];
    must_avoid?: string[];
  };
}

interface PlannedCampaign {
  angle: string;
  rationale: string;
  daily_budget_share: number;
  adsets: PlannedAdSet[];
}

interface CampaignStrategy {
  campaigns: PlannedCampaign[];
  overall_rationale: string;
  predicted_avg_cpl_cents: number;
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
  angle: string | null;
  creative_style: string | null;
  framework: string | null;
  meta_adset_row_id: string | null;
  policy_precheck: { regex_warnings?: string[]; judge_verdict?: string; judge_reason?: string };
}

interface Props {
  masterEnabled: boolean;
  onLaunched: () => void;
}

interface AudienceInfo {
  lookalike_id: string | null;
  exclusion_id: string | null;
  seed_lead_count: number;
}

type Phase = 'idle' | 'strategizing' | 'strategized' | 'generating_copy' | 'generating_images' | 'generated' | 'launching' | 'launched';

export default function StudioForm({ masterEnabled, onLaunched }: Props) {
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [demand, setDemand] = useState<Demand[]>([]);
  const [forms, setForms] = useState<LeadFormOption[]>([]);
  const [formsLoading, setFormsLoading] = useState<boolean>(false);
  const [formsError, setFormsError] = useState<string | null>(null);

  // Brief
  const [branch, setBranch] = useState<string>('');
  const [leadFormId, setLeadFormId] = useState('');
  const [audienceProblem, setAudienceProblem] = useState('');
  const [audienceMotivation, setAudienceMotivation] = useState('');

  // Targeting
  const [countries, setCountries] = useState<string[]>(['NL']);
  const [regions, setRegions] = useState<Array<{ land: 'NL' | 'BE'; name: string }>>([]);
  const [ageMin, setAgeMin] = useState<number>(30);
  const [ageMax, setAgeMax] = useState<number>(65);
  const [genders, setGenders] = useState<'all' | 'm' | 'f'>('all');

  // Strategy
  const [angles, setAngles] = useState<number>(3);
  const [adsetsPerAngle, setAdsetsPerAngle] = useState<number>(2);
  const [creativesPerAdset, setCreativesPerAdset] = useState<number>(3);
  const [useLookalike, setUseLookalike] = useState<boolean>(false);
  const [useExclusion, setUseExclusion] = useState<boolean>(true);
  const [buildLookalikeNow, setBuildLookalikeNow] = useState<boolean>(false);
  const [branchLeadCount, setBranchLeadCount] = useState<number | null>(null);

  // Budget
  const [dailyBudgetEur, setDailyBudgetEur] = useState<string>('25');
  const [maxTotalEur, setMaxTotalEur] = useState<string>('250');
  const [targetCplEur, setTargetCplEur] = useState<string>('');
  const [specialAdCategory, setSpecialAdCategory] = useState<'NONE' | 'CREDIT' | 'EMPLOYMENT' | 'HOUSING' | 'ISSUES_ELECTIONS_POLITICS'>('NONE');
  const [isTestMode, setIsTestMode] = useState<boolean>(true);

  // State
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [briefId, setBriefId] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<CampaignStrategy | null>(null);
  const [audiences, setAudiences] = useState<AudienceInfo | null>(null);
  const [variants, setVariants] = useState<GeneratedVariant[]>([]);
  const [imgProgress, setImgProgress] = useState<{ done: number; total: number; errors: number }>({ done: 0, total: 0, errors: 0 });
  const [phaseStartedAt, setPhaseStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [launchErrors, setLaunchErrors] = useState<Array<{ level: string; ref: string; message: string }>>([]);

  useEffect(() => {
    if (phase === 'idle' || phase === 'strategized' || phase === 'generated' || phase === 'launched' || phaseStartedAt == null) return;
    const id = setInterval(() => setElapsedMs(Date.now() - phaseStartedAt), 250);
    return () => clearInterval(id);
  }, [phase, phaseStartedAt]);

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

  useEffect(() => {
    if (!branch) return;
    let cancelled = false;
    setFormsLoading(true); setFormsError(null);
    adminFetch(`/api/admin/meta-forms?branch=${encodeURIComponent(branch)}`)
      .then(async res => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) { setForms([]); setFormsError(data.error || 'Kon Lead Forms niet ophalen'); }
        else {
          const list = (data.forms || []) as LeadFormOption[];
          setForms(list);
          if (list[0] && !list.find(f => f.id === leadFormId)) setLeadFormId(list[0].id);
        }
      })
      .catch(() => { if (!cancelled) setFormsError('Netwerkfout'); })
      .finally(() => { if (!cancelled) setFormsLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch]);

  // Branch-lead count voor lookalike-eligibility
  useEffect(() => {
    if (!branch) return;
    let cancelled = false;
    adminFetch(`/api/admin/ai-campaigns/lookalike?branch=${encodeURIComponent(branch)}&country=${countries[0] || 'NL'}`)
      .then(async res => {
        const d = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) setBranchLeadCount(d.lead_count ?? null);
      })
      .catch(() => { /* silent */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch, countries]);

  const branchDemand = demand.find(d => d.branch === branch) || null;
  const selectedForm = forms.find(f => f.id === leadFormId) || null;

  const totalAds = angles * adsetsPerAngle * creativesPerAdset;
  const budgetPerAd = useMemo(() => {
    const total = parseFloat(dailyBudgetEur) || 0;
    return totalAds > 0 ? (total / totalAds).toFixed(2) : '0';
  }, [dailyBudgetEur, totalAds]);

  const toggleCountry = (c: string) => {
    setCountries(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };
  const toggleRegion = (land: 'NL' | 'BE', name: string) => {
    setRegions(prev => {
      const exists = prev.find(r => r.land === land && r.name === name);
      return exists ? prev.filter(r => !(r.land === land && r.name === name)) : [...prev, { land, name }];
    });
  };

  const formatElapsed = (ms: number): string => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
  };

  const buildStrategizeBody = () => ({
    branch,
    lead_form_id: leadFormId,
    page_id: selectedForm?.page_id,
    target_audience: {
      probleem: audienceProblem,
      motivatie: audienceMotivation,
      form_questions_count: selectedForm?.questions_count ?? null,
    },
    daily_budget_cents: Math.round(parseFloat(dailyBudgetEur) * 100),
    max_total_budget_cents: Math.round(parseFloat(maxTotalEur) * 100),
    target_cpl_cents: targetCplEur ? Math.round(parseFloat(targetCplEur) * 100) : undefined,
    special_ad_category: specialAdCategory,
    is_test_mode: isTestMode,
    strategy_params: {
      angles,
      adsets_per_angle: adsetsPerAngle,
      creatives_per_adset: creativesPerAdset,
      use_lookalike: useLookalike,
      use_exclusion: useExclusion,
      build_lookalike_now: buildLookalikeNow,
    },
    targeting_spec: {
      countries,
      regions: regions.map(r => ({ key: `${r.land}:${r.name}`, name: r.name })),
      age_min: ageMin,
      age_max: ageMax,
      genders: genders === 'all' ? undefined : [genders === 'm' ? 1 : 2],
    },
  });

  const submitStrategize = async () => {
    setError(null); setLaunchErrors([]); setVariants([]); setStrategy(null); setBriefId(null);
    if (!selectedForm?.page_id) { setError('Geen page-id gevonden voor Lead Form'); return; }
    if (countries.length === 0) { setError('Kies minstens één land'); return; }
    setPhase('strategizing'); setPhaseStartedAt(Date.now()); setElapsedMs(0);
    try {
      const res = await adminFetch('/api/admin/ai-campaigns/strategize', {
        method: 'POST',
        body: JSON.stringify(buildStrategizeBody()),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || 'Strategist faalde');
        setPhase('idle');
        return;
      }
      setBriefId(data.brief.id);
      setStrategy(data.strategy);
      setAudiences(data.audiences || null);
      setPhase('strategized');
    } finally {
      // phase set in try
    }
  };

  const submitGenerateCreatives = async () => {
    if (!briefId) return;
    setError(null); setVariants([]); setImgProgress({ done: 0, total: 0, errors: 0 });
    setPhase('generating_copy'); setPhaseStartedAt(Date.now()); setElapsedMs(0);
    try {
      const res = await adminFetch('/api/admin/ai-campaigns/generate', {
        method: 'POST',
        body: JSON.stringify({ brief_id: briefId, skip_images: true, skip_judge: false }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || 'Generatie mislukt');
        setPhase('strategized');
        return;
      }
      const firstVariants = (data.variants || []) as GeneratedVariant[];
      setVariants(firstVariants);

      // Fase 2: images parallel genereren
      const eligible = firstVariants.filter(v => v.status !== 'failed' && !v.meta_image_hash);
      if (eligible.length === 0) {
        setPhase('generated');
        return;
      }
      setImgProgress({ done: 0, total: eligible.length, errors: 0 });
      setPhase('generating_images'); setPhaseStartedAt(Date.now()); setElapsedMs(0);
      await Promise.all(eligible.map(async v => {
        try {
          const r = await adminFetch(`/api/admin/ai-campaigns/variants/${v.id}/generate-image`, {
            method: 'POST', body: JSON.stringify({}),
          });
          const j = await r.json();
          if (r.ok && j.ok) {
            setVariants(prev => prev.map(x => x.id === v.id ? { ...x, image_url: j.image_url, meta_image_hash: j.meta_image_hash } : x));
            setImgProgress(p => ({ ...p, done: p.done + 1 }));
          } else {
            setImgProgress(p => ({ ...p, errors: p.errors + 1 }));
          }
        } catch {
          setImgProgress(p => ({ ...p, errors: p.errors + 1 }));
        }
      }));
      setPhase('generated');
    } finally {
      // status handled inline
    }
  };

  const submitLaunch = async (goLive: boolean) => {
    if (!briefId) return;
    setError(null); setLaunchErrors([]);
    setPhase('launching'); setPhaseStartedAt(Date.now()); setElapsedMs(0);
    try {
      const res = await adminFetch('/api/admin/ai-campaigns/launch', {
        method: 'POST',
        body: JSON.stringify({ brief_id: briefId, go_live: goLive }),
      });
      const data = await res.json();
      if (Array.isArray(data.errors)) setLaunchErrors(data.errors);
      if (!res.ok || !data.ok) {
        setError(data.error || 'Launch mislukt');
        setPhase('generated');
        return;
      }
      setPhase('launched');
      onLaunched();
    } finally {
      // status handled inline
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Bovenste rij: Brief + Strategie + Targeting + Budget ───────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Brief */}
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Brief</h2>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Branche</label>
            <select
              value={branch}
              onChange={e => setBranch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {branches.map(b => <option key={b.slug} value={b.slug}>{b.name}</option>)}
            </select>
            {branchDemand && (
              <p className="mt-1 text-xs text-slate-500">
                Open klantcapaciteit: <span className="font-medium">{branchDemand.capacityOpen}</span>
                {' '}({branchDemand.activeBatches} batches) · leads 7d: {branchDemand.leadsLast7d}
                {branchDemand.needMoreVolume && <span className="ml-2 text-emerald-600">vraag &gt; aanbod</span>}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 flex items-center justify-between text-xs font-medium text-slate-600">
              <span>Lead Form</span>
              {formsLoading && <span className="text-[10px] text-slate-400">laden…</span>}
            </label>
            <select
              value={leadFormId}
              onChange={e => setLeadFormId(e.target.value)}
              disabled={formsLoading || forms.length === 0}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-50"
            >
              {forms.length === 0 && <option value="">Geen formulieren gevonden</option>}
              {forms.map(f => (
                <option key={f.id} value={f.id}>
                  {f.name} {f.questions_count != null ? `· ${f.questions_count}v` : ''} {f.status === 'ARCHIVED' ? '(archief)' : ''}
                </option>
              ))}
            </select>
            {formsError && <p className="mt-1 text-[11px] text-rose-600">{formsError}</p>}
            {selectedForm && (
              <p className="mt-1 text-[11px] text-slate-500">
                Form ID: <span className="font-mono">{selectedForm.id}</span>
                {selectedForm.page_id && <> · Page: <span className="font-mono">{selectedForm.page_id}</span></>}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Probleem doelgroep</label>
            <textarea
              value={audienceProblem}
              onChange={e => setAudienceProblem(e.target.value)}
              rows={2}
              placeholder="bv. hoge energierekening en piekverbruik"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Motivatie / trigger</label>
            <textarea
              value={audienceMotivation}
              onChange={e => setAudienceMotivation(e.target.value)}
              rows={2}
              placeholder="bv. afschaffing salderingsregeling 2027"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Strategie */}
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <CpuChipIcon className="h-4 w-4 text-purple-500" /> Strategie
            </h2>
            <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700">AI Strategist</span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Angles</label>
              <input type="range" min={2} max={5} value={angles} onChange={e => setAngles(parseInt(e.target.value, 10))} className="w-full" />
              <div className="text-center text-xs font-semibold text-slate-700">{angles}</div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Ad sets / angle</label>
              <input type="range" min={1} max={3} value={adsetsPerAngle} onChange={e => setAdsetsPerAngle(parseInt(e.target.value, 10))} className="w-full" />
              <div className="text-center text-xs font-semibold text-slate-700">{adsetsPerAngle}</div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Creatives / ad set</label>
              <input type="range" min={2} max={5} value={creativesPerAdset} onChange={e => setCreativesPerAdset(parseInt(e.target.value, 10))} className="w-full" />
              <div className="text-center text-xs font-semibold text-slate-700">{creativesPerAdset}</div>
            </div>
          </div>

          <div className="rounded-lg bg-purple-50 p-2.5 text-[11px] text-purple-800">
            Tree: <strong>{angles} × {adsetsPerAngle} × {creativesPerAdset} = {totalAds} ads</strong>
            · ~ EUR {budgetPerAd}/ad/dag bij dagbudget EUR {dailyBudgetEur || '0'}.
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input type="checkbox" checked={useLookalike} onChange={e => setUseLookalike(e.target.checked)} />
              Gebruik <strong>Lookalike</strong> van onze {branch || 'branche'}-leads
              {branchLeadCount != null && (
                <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] ${branchLeadCount >= 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {branchLeadCount} leads
                </span>
              )}
            </label>
            {useLookalike && branchLeadCount != null && branchLeadCount < 100 && (
              <p className="text-[10px] text-amber-700">Minimaal 100 leads vereist voor lookalike — momenteel te weinig.</p>
            )}
            {useLookalike && (
              <label className="ml-5 flex items-center gap-2 text-[11px] text-slate-600">
                <input type="checkbox" checked={buildLookalikeNow} onChange={e => setBuildLookalikeNow(e.target.checked)} />
                Bouw audience nu (anders gebruik bestaande)
              </label>
            )}
            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input type="checkbox" checked={useExclusion} onChange={e => setUseExclusion(e.target.checked)} />
              Excludeer bestaande {branch || 'branche'}-leads (90d)
            </label>
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
        </div>

        {/* Targeting */}
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Cog6ToothIcon className="h-4 w-4 text-emerald-500" /> Targeting
          </h2>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Landen</label>
            <div className="flex flex-wrap gap-1.5">
              {['NL', 'BE'].map(c => (
                <button
                  key={c}
                  onClick={() => toggleCountry(c)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    countries.includes(c) ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {(countries.includes('NL') || countries.includes('BE')) && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Provincies (optioneel)</label>
              <div className="max-h-32 overflow-y-auto rounded-lg border border-slate-200 p-2">
                <div className="flex flex-wrap gap-1">
                  {countries.includes('NL') && PROVINCES_NL.map(p => (
                    <button
                      key={`NL-${p}`}
                      onClick={() => toggleRegion('NL', p)}
                      className={`rounded-full px-2 py-0.5 text-[10px] ${regions.find(r => r.land === 'NL' && r.name === p) ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300' : 'bg-slate-100 text-slate-600'}`}
                    >
                      NL {p === 'Limburg' ? 'Limburg (NL)' : p}
                    </button>
                  ))}
                  {countries.includes('BE') && PROVINCES_BE.map(p => (
                    <button
                      key={`BE-${p}`}
                      onClick={() => toggleRegion('BE', p)}
                      className={`rounded-full px-2 py-0.5 text-[10px] ${regions.find(r => r.land === 'BE' && r.name === p) ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300' : 'bg-slate-100 text-slate-600'}`}
                    >
                      BE {p === 'Limburg' ? 'Limburg (BE)' : p}
                    </button>
                  ))}
                </div>
              </div>
              <p className="mt-1 text-[10px] text-slate-500">Leeg = heel land. Klik een provincie om te toggleen.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Leeftijd min</label>
              <input
                type="number" min={18} max={64}
                value={ageMin}
                onChange={e => setAgeMin(Math.min(parseInt(e.target.value || '18', 10), ageMax - 1))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Leeftijd max</label>
              <input
                type="number" min={19} max={65}
                value={ageMax}
                onChange={e => setAgeMax(Math.max(parseInt(e.target.value || '65', 10), ageMin + 1))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Gender</label>
            <div className="flex gap-1.5">
              {(['all', 'm', 'f'] as const).map(g => (
                <button
                  key={g}
                  onClick={() => setGenders(g)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    genders === g ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {g === 'all' ? 'Alle' : g === 'm' ? 'Man' : 'Vrouw'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Budget */}
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Budget &amp; doel</h2>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Daily (€)</label>
              <input type="number" min={1} step={1} value={dailyBudgetEur} onChange={e => setDailyBudgetEur(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Max totaal (€)</label>
              <input type="number" min={1} step={1} value={maxTotalEur} onChange={e => setMaxTotalEur(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600" title="Optimizer pauzeert varianten boven 1.5x dit bedrag, scales onder 0.7x">Doel CPL (€)</label>
              <input type="number" min={1} step={1} value={targetCplEur} onChange={e => setTargetCplEur(e.target.value)} placeholder="optioneel" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={isTestMode} onChange={e => setIsTestMode(e.target.checked)} />
            Test-modus (start PAUSED, +1u start_time)
          </label>

          {/* CTA: strategize */}
          <button
            onClick={submitStrategize}
            disabled={!masterEnabled || phase === 'strategizing' || !branch || !leadFormId || !selectedForm?.page_id}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-button-gradient px-3.5 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-50"
          >
            {phase === 'strategizing' ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <SparklesIcon className="h-4 w-4" />}
            {phase === 'strategizing'
              ? `Strategist denkt na… ${formatElapsed(elapsedMs)}`
              : strategy ? 'Plan opnieuw' : 'Plan strategie'}
          </button>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Battle-plan preview ──────────────────────────────────────── */}
      {strategy && (
        <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <CpuChipIcon className="h-4 w-4 text-purple-600" /> Battle-plan
              <span className="ml-2 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700">
                ~CPL EUR {(strategy.predicted_avg_cpl_cents / 100).toFixed(2)}
              </span>
            </h2>
            {audiences?.lookalike_id ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                Lookalike actief ({audiences.seed_lead_count} seeds)
              </span>
            ) : useLookalike ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                Lookalike niet beschikbaar — strategist slaat het over
              </span>
            ) : null}
          </div>

          <p className="mb-3 text-xs text-slate-700">{strategy.overall_rationale}</p>

          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {strategy.campaigns.map((c, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-lg border border-purple-200 bg-white p-3 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-purple-900">{c.angle}</span>
                  <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] text-purple-700">
                    {Math.round(c.daily_budget_share * 100)}%
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-600">{c.rationale}</p>
                <div className="mt-2 space-y-1.5">
                  {c.adsets.map((a, j) => (
                    <div key={j} className="rounded-md bg-slate-50 p-2 text-[10px]">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800">{a.strategy_type}</span>
                        <span className="font-mono text-slate-500">~EUR {(a.predicted_cpl_cents / 100).toFixed(2)}/CPL</span>
                      </div>
                      <div className="text-slate-600">{a.creative_brief.style} · {a.creative_brief.framework} · {a.creative_brief.tone}</div>
                      <div className="italic text-slate-500">hook: &ldquo;{a.creative_brief.hook}&rdquo;</div>
                      <div className="text-slate-500">
                        {a.targeting.age_min}-{a.targeting.age_max}
                        {a.targeting.interests && a.targeting.interests.length > 0 && (
                          <> · {a.targeting.interests.slice(0, 2).map(it => it.name).join(', ')}{a.targeting.interests.length > 2 ? '…' : ''}</>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>

          {phase === 'strategized' && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={submitGenerateCreatives}
                disabled={phase !== 'strategized'}
                className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3.5 py-2 text-sm font-bold text-white shadow-sm hover:bg-purple-700"
              >
                <SparklesIcon className="h-4 w-4" />
                Genereer creatives ({totalAds} ads)
              </button>
            </div>
          )}

          {(phase === 'generating_copy' || phase === 'generating_images') && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs">
              <div className="flex items-center justify-between font-medium text-amber-900">
                <span>
                  {phase === 'generating_copy' ? 'Stap 1/2 · Copy genereren' : 'Stap 2/2 · Beelden genereren'}
                </span>
                <span className="font-mono text-amber-700">{formatElapsed(elapsedMs)}</span>
              </div>
              {phase === 'generating_images' && (
                <>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-amber-200">
                    <div className="h-full bg-amber-500 transition-all duration-300"
                      style={{ width: imgProgress.total ? `${((imgProgress.done + imgProgress.errors) / imgProgress.total) * 100}%` : '0%' }} />
                  </div>
                  <p className="mt-1 text-[10px] text-amber-700">
                    {imgProgress.done}/{imgProgress.total} klaar
                    {imgProgress.errors > 0 && <span className="ml-1 text-rose-700">· {imgProgress.errors} mislukt</span>}
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Gegenereerde varianten + launch ──────────────────────────── */}
      {variants.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Gegenereerde varianten ({variants.length})</h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {variants.map(v => {
              const blocked = v.status === 'failed' || v.policy_precheck?.judge_verdict === 'block';
              return (
                <motion.div
                  key={v.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`overflow-hidden rounded-lg border ${blocked ? 'border-rose-200 bg-rose-50/40' : 'border-slate-200 bg-white'}`}
                >
                  {v.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.image_url} alt="creative" className="aspect-square w-full object-cover" />
                  ) : phase === 'generating_images' && !blocked ? (
                    <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-amber-50 to-white text-[11px] text-amber-700">
                      <ArrowPathIcon className="h-5 w-5 animate-spin text-amber-500" />
                      <span>beeld genereren…</span>
                    </div>
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center bg-slate-100 text-xs text-slate-400">geen image</div>
                  )}
                  <div className="space-y-1 p-3">
                    {v.angle && (
                      <span className="rounded-full bg-purple-50 px-1.5 py-0.5 text-[9px] font-medium text-purple-700">{v.angle}</span>
                    )}
                    <p className="text-xs font-semibold text-slate-900 line-clamp-2">{v.headline}</p>
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
                    {(v.creative_style || v.framework) && (
                      <p className="pt-1 text-[9px] text-slate-400">
                        {v.creative_style} · {v.framework}
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {phase === 'generated' && briefId && (
            <div className="mt-4 border-t border-slate-200 pt-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Lanceer naar Meta</h3>
              <p className="mb-3 text-xs text-slate-500">
                Test-modus = altijd PAUSED + start over 1u. Zonder test-modus en met &ldquo;direct live&rdquo; activeren we
                campagnes + ad sets meteen.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => submitLaunch(false)}
                  disabled={phase !== 'generated'}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <RocketLaunchIcon className="h-4 w-4" /> Push naar Meta (PAUSED)
                </button>
                <button
                  onClick={() => submitLaunch(true)}
                  disabled={phase !== 'generated' || isTestMode}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50"
                  title={isTestMode ? 'Schakel testmodus uit voor directe activatie' : 'Direct activeren'}
                >
                  <RocketLaunchIcon className="h-4 w-4" /> Direct live (ACTIVE)
                </button>
              </div>
              {launchErrors.length > 0 && (
                <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs">
                  <p className="font-semibold text-rose-800">Meta gaf {launchErrors.length} fouten:</p>
                  <ul className="mt-1 space-y-1 text-rose-700">
                    {launchErrors.map((e, i) => {
                      // Variant-IDs zijn UUIDs (36 char). Andere refs (angles/names)
                      // korten we niet af zodat ze leesbaar blijven.
                      const isUuid = /^[0-9a-f-]{36}$/i.test(e.ref);
                      const display = isUuid ? e.ref.slice(0, 8) : e.ref;
                      return (
                        <li key={i}>
                          <span className="font-mono text-[10px] text-rose-500">{e.level}/{display}</span>{' '}{e.message}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}

          {phase === 'launching' && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              Meta-entities aanmaken… {formatElapsed(elapsedMs)}
            </div>
          )}

          {phase === 'launched' && (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              Launch geslaagd. Kijk in &lsquo;Live experimenten&rsquo; voor de tree-view.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
