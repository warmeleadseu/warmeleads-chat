/**
 * Autonome optimizer voor AI-Meta-campagnes.
 *
 * Wordt iedere paar uur door /api/cron/ai-campaign-optimizer aangeroepen
 * en bekijkt elk experiment met phase='running'.
 *
 * Beslisregels (bewust conservatief):
 *  1. Master kill-switch UIT → niets doen.
 *  2. Geen Meta-credentials → log + skip.
 *  3. Per experiment:
 *     a. Demand-check: 0 open klantbatches voor branche → pauze adset, decision=no_demand.
 *     b. Cold-funnel: totaal spend ≥ COLD_FUNNEL_SPEND_RATIO × daily_budget en 0 leads
 *        over de hele looptijd → kill experiment, decision=kill_cold_funnel.
 *     c. Per variant met ≥ MIN_LEADS_PER_VARIANT leads of ≥ MIN_SPEND_PER_VARIANT:
 *        - CPL > BAD_CPL_RATIO × target_cpl → pause variant, decision=pause_loser.
 *        - CPL < GOOD_CPL_RATIO × target_cpl → scale winner: +SCALE_BUDGET_PCT op adset,
 *          variant.scale_count++, decision=scale_winner.
 *        - Anders: status quo.
 *     d. Als alle live varianten paused/failed zijn én er was minimaal 1 winner → iterate:
 *        plan een nieuwe brief op basis van winner-angles (decision=iterate).
 *
 * Idempotency: we slaan een `last_optimizer_tick_at` op het experiment op en
 * herhalen niet binnen MIN_TICK_INTERVAL_MS van vorige tick. Decisions zelf
 * zijn append-only auditlog; geen schade bij dubbele uitvoering door cron.
 */
import { createServerClient } from '@/lib/supabase';
import { fetchAdLevelInsightsForAds, setEntityStatus, updateAdSetDailyBudget } from '@/lib/metaMarketingApi';
import { getBranchDemand } from '@/lib/aiCampaignDemand';
import { isAiCampaignsEnabled } from '@/lib/aiCampaignBudget';
import { getMetaCredentials } from '@/lib/meta';

/** Minstens dit aantal leads vóór we beslissen pauzeren/scalen. */
const MIN_LEADS_PER_VARIANT = 10;
/** Of: minstens dit aantal cent gespendeerd voor een variant zonder leads. */
const MIN_SPEND_PER_VARIANT_CENTS = 2500;
/** Cold funnel: ≥ dit aantal × daily_budget aan spend zonder ook maar één lead. */
const COLD_FUNNEL_SPEND_RATIO = 3;
/** CPL > target × ratio → pauze variant. */
const BAD_CPL_RATIO = 1.5;
/** CPL < target × ratio → scale winner. */
const GOOD_CPL_RATIO = 0.7;
/** Adset-budget verhogen per scale-tick (procentueel). */
const SCALE_BUDGET_PCT = 0.2;
/** Maximaal totaal-budget-cap (× daily_budget van brief) — bescherm tegen onbeheerste schaling. */
const MAX_DAILY_BUDGET_MULT = 4;
/** Niet vaker dan dit ticken per experiment. */
const MIN_TICK_INTERVAL_MS = 30 * 60 * 1000;

export interface OptimizerSummary {
  experimentsProcessed: number;
  actions: {
    pause_loser: number;
    scale_winner: number;
    kill_cold_funnel: number;
    no_demand: number;
    iterate: number;
    skipped: number;
  };
  errors: string[];
}

export interface OptimizerOptions {
  dryRun?: boolean;
  /** Beperk tot één experiment (handig voor handmatige tests). */
  experimentId?: string;
}

interface ExperimentRow {
  id: string;
  brief_id: string;
  meta_campaign_id: string | null;
  meta_adset_id: string | null;
  phase: string;
  last_optimizer_tick_at: string | null;
}

interface BriefRow {
  id: string;
  branch: string;
  target_cpl_cents: number | null;
  target_cpql_cents: number | null;
  daily_budget_cents: number;
  max_total_budget_cents: number;
  is_test_mode: boolean;
  status: string;
}

interface VariantRow {
  id: string;
  experiment_id: string | null;
  brief_id: string;
  meta_ad_id: string | null;
  status: string;
  scale_count: number;
  angle: string | null;
  headline: string;
}

interface InsightRow {
  ad_id: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  cpl: number | null;
  ctr: number | null;
}

async function logDecision(
  supabase: ReturnType<typeof createServerClient>,
  experimentId: string,
  variantId: string | null,
  action: string,
  reason: string,
  metrics: Record<string, unknown>,
  dryRun: boolean,
): Promise<void> {
  await supabase.from('ai_campaign_decisions').insert({
    experiment_id: experimentId,
    variant_id: variantId,
    action,
    reason,
    metrics_snapshot: metrics,
    dry_run: dryRun,
  });
}

export async function runOptimizerTick(opts: OptimizerOptions = {}): Promise<OptimizerSummary> {
  const summary: OptimizerSummary = {
    experimentsProcessed: 0,
    actions: { pause_loser: 0, scale_winner: 0, kill_cold_funnel: 0, no_demand: 0, iterate: 0, skipped: 0 },
    errors: [],
  };

  if (!(await isAiCampaignsEnabled())) {
    summary.errors.push('master_switch_off');
    return summary;
  }
  if (!(await getMetaCredentials())) {
    summary.errors.push('no_meta_credentials');
    return summary;
  }

  const supabase = createServerClient();
  let query = supabase
    .from('ai_campaign_experiments')
    .select('id, brief_id, meta_campaign_id, meta_adset_id, phase, last_optimizer_tick_at')
    .eq('phase', 'running');
  if (opts.experimentId) query = query.eq('id', opts.experimentId);

  const { data: experiments } = await query;
  if (!experiments || experiments.length === 0) return summary;

  const now = Date.now();
  for (const exp of experiments as ExperimentRow[]) {
    try {
      if (
        !opts.experimentId &&
        exp.last_optimizer_tick_at &&
        now - new Date(exp.last_optimizer_tick_at).getTime() < MIN_TICK_INTERVAL_MS
      ) {
        summary.actions.skipped++;
        continue;
      }

      const { data: brief } = await supabase
        .from('ai_campaign_briefs')
        .select('id, branch, target_cpl_cents, target_cpql_cents, daily_budget_cents, max_total_budget_cents, is_test_mode, status')
        .eq('id', exp.brief_id)
        .maybeSingle();
      if (!brief) { summary.actions.skipped++; continue; }
      const briefRow = brief as BriefRow;

      const { data: variantsRaw } = await supabase
        .from('ai_campaign_variants')
        .select('id, experiment_id, brief_id, meta_ad_id, status, scale_count, angle, headline')
        .eq('experiment_id', exp.id);
      const variants = (variantsRaw || []) as VariantRow[];
      if (variants.length === 0) { summary.actions.skipped++; continue; }

      // ── (a) demand-check ──
      const demand = await getBranchDemand(briefRow.branch);
      if (demand.capacityOpen === 0 && !briefRow.is_test_mode) {
        if (!opts.dryRun && exp.meta_adset_id) {
          await setEntityStatus(exp.meta_adset_id, 'PAUSED');
        }
        await logDecision(supabase, exp.id, null, 'no_demand',
          `Geen open klantcapaciteit voor ${briefRow.branch}`,
          { demand },
          !!opts.dryRun);
        await supabase
          .from('ai_campaign_experiments')
          .update({ phase: 'paused', last_optimizer_tick_at: new Date().toISOString(), stop_reason: 'no_demand' })
          .eq('id', exp.id);
        summary.actions.no_demand++;
        summary.experimentsProcessed++;
        continue;
      }

      // ── Insights ophalen ──
      const adIds = variants.map(v => v.meta_ad_id).filter((x): x is string => !!x);
      const insights: InsightRow[] = adIds.length > 0 ? await fetchAdLevelInsightsForAds(adIds) : [];
      const insightByAd = new Map(insights.map(i => [i.ad_id, i]));
      const totalSpendEur = insights.reduce((s, i) => s + i.spend, 0);
      const totalLeads = insights.reduce((s, i) => s + i.leads, 0);
      const dailyBudgetEur = briefRow.daily_budget_cents / 100;

      // ── (b) cold-funnel ──
      if (totalSpendEur >= COLD_FUNNEL_SPEND_RATIO * dailyBudgetEur && totalLeads === 0) {
        if (!opts.dryRun) {
          if (exp.meta_adset_id) { try { await setEntityStatus(exp.meta_adset_id, 'PAUSED'); } catch (e) { summary.errors.push((e as Error).message); } }
          if (exp.meta_campaign_id) { try { await setEntityStatus(exp.meta_campaign_id, 'PAUSED'); } catch (e) { summary.errors.push((e as Error).message); } }
        }
        await logDecision(supabase, exp.id, null, 'kill_cold_funnel',
          `Spend ${totalSpendEur.toFixed(2)}€ ≥ ${COLD_FUNNEL_SPEND_RATIO}×daily zonder leads`,
          { totalSpendEur, totalLeads, dailyBudgetEur },
          !!opts.dryRun);
        await supabase
          .from('ai_campaign_experiments')
          .update({ phase: 'killed', ended_at: new Date().toISOString(), last_optimizer_tick_at: new Date().toISOString(), stop_reason: 'kill_cold_funnel' })
          .eq('id', exp.id);
        await supabase.from('ai_campaign_briefs').update({ status: 'killed' }).eq('id', briefRow.id);
        summary.actions.kill_cold_funnel++;
        summary.experimentsProcessed++;
        continue;
      }

      // ── (c) per-variant pause/scale ──
      const target = (briefRow.target_cpl_cents || 0) / 100;
      let pausedCount = 0;
      let scaledCount = 0;
      const winners: VariantRow[] = [];

      for (const v of variants) {
        if (v.status !== 'live') continue;
        if (!v.meta_ad_id) continue;
        const ins = insightByAd.get(v.meta_ad_id);
        if (!ins) continue;
        const enoughData = ins.leads >= MIN_LEADS_PER_VARIANT || ins.spend * 100 >= MIN_SPEND_PER_VARIANT_CENTS;
        if (!enoughData) continue;

        if (target > 0) {
          if (ins.cpl != null && ins.cpl > target * BAD_CPL_RATIO) {
            if (!opts.dryRun) {
              try { await setEntityStatus(v.meta_ad_id, 'PAUSED'); } catch (e) { summary.errors.push((e as Error).message); }
              await supabase.from('ai_campaign_variants').update({ status: 'paused' }).eq('id', v.id);
            }
            await logDecision(supabase, exp.id, v.id, 'pause_loser',
              `CPL €${ins.cpl} > target €${target} × ${BAD_CPL_RATIO}`,
              { ins },
              !!opts.dryRun);
            pausedCount++;
          } else if (ins.cpl != null && ins.cpl < target * GOOD_CPL_RATIO) {
            winners.push(v);
            scaledCount++;
            if (!opts.dryRun) {
              await supabase
                .from('ai_campaign_variants')
                .update({ scale_count: (v.scale_count || 0) + 1 })
                .eq('id', v.id);
            }
            await logDecision(supabase, exp.id, v.id, 'scale_winner',
              `CPL €${ins.cpl} < target €${target} × ${GOOD_CPL_RATIO}`,
              { ins },
              !!opts.dryRun);
          }
        } else {
          if (ins.cpl == null && ins.spend * 100 >= MIN_SPEND_PER_VARIANT_CENTS) {
            if (!opts.dryRun) {
              try { await setEntityStatus(v.meta_ad_id, 'PAUSED'); } catch (e) { summary.errors.push((e as Error).message); }
              await supabase.from('ai_campaign_variants').update({ status: 'paused' }).eq('id', v.id);
            }
            await logDecision(supabase, exp.id, v.id, 'pause_loser',
              `Spend zonder leads ≥ €${MIN_SPEND_PER_VARIANT_CENTS / 100}`,
              { ins },
              !!opts.dryRun);
            pausedCount++;
          }
        }
      }

      // ── Adset-budget verhogen bij winners (CBO-stijl: bump op één adset) ──
      if (scaledCount > 0 && exp.meta_adset_id) {
        const currentBudget = briefRow.daily_budget_cents;
        const maxBudget = briefRow.daily_budget_cents * MAX_DAILY_BUDGET_MULT;
        const newBudget = Math.min(maxBudget, Math.round(currentBudget * (1 + SCALE_BUDGET_PCT * scaledCount)));
        if (newBudget > currentBudget) {
          if (!opts.dryRun) {
            try {
              await updateAdSetDailyBudget(exp.meta_adset_id, newBudget);
            } catch (e) {
              summary.errors.push((e as Error).message);
            }
          }
        }
      }

      summary.actions.pause_loser += pausedCount;
      summary.actions.scale_winner += scaledCount;

      // ── (d) iterate als alle live varianten paused zijn ──
      const stillLive = variants.filter(v => v.status === 'live').length - pausedCount;
      if (stillLive <= 0 && winners.length > 0) {
        await logDecision(supabase, exp.id, null, 'iterate',
          'Alle varianten paused; tijd voor next-gen creatives op basis van winners',
          { winnerHeadlines: winners.map(w => w.headline), winnerAngles: winners.map(w => w.angle) },
          !!opts.dryRun);
        summary.actions.iterate++;
      }

      await supabase
        .from('ai_campaign_experiments')
        .update({ last_optimizer_tick_at: new Date().toISOString() })
        .eq('id', exp.id);
      summary.experimentsProcessed++;
    } catch (e) {
      summary.errors.push(`${exp.id}: ${(e as Error).message}`);
    }
  }

  return summary;
}

export const __internal = {
  MIN_LEADS_PER_VARIANT,
  COLD_FUNNEL_SPEND_RATIO,
  BAD_CPL_RATIO,
  GOOD_CPL_RATIO,
  SCALE_BUDGET_PCT,
  MAX_DAILY_BUDGET_MULT,
  MIN_TICK_INTERVAL_MS,
};
