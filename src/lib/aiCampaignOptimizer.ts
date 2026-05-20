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
import { getApprovedReclamationStats } from '@/lib/reclamationStats';

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
    pause_adset: number;
    reallocate_budget: number;
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
  meta_adset_row_id: string | null;
  status: string;
  scale_count: number;
  angle: string | null;
  headline: string;
}

interface MetaCampaignRow {
  id: string;
  meta_campaign_id: string | null;
  angle: string;
  daily_budget_cents: number;
  daily_budget_share: number;
  status: string;
}

interface MetaAdsetRow {
  id: string;
  meta_campaign_row_id: string;
  meta_adset_id: string | null;
  strategy_type: string;
  daily_budget_cents: number | null;
  status: string;
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
    actions: { pause_loser: 0, scale_winner: 0, kill_cold_funnel: 0, no_demand: 0, iterate: 0, skipped: 0, pause_adset: 0, reallocate_budget: 0 },
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
        .select('id, branch, target_cpl_cents, daily_budget_cents, max_total_budget_cents, is_test_mode, status')
        .eq('id', exp.brief_id)
        .maybeSingle();
      if (!brief) { summary.actions.skipped++; continue; }
      const briefRow = brief as BriefRow;

      const { data: variantsRaw } = await supabase
        .from('ai_campaign_variants')
        .select('id, experiment_id, brief_id, meta_ad_id, meta_adset_row_id, status, scale_count, angle, headline')
        .eq('experiment_id', exp.id);
      const variants = (variantsRaw || []) as VariantRow[];
      if (variants.length === 0) { summary.actions.skipped++; continue; }

      // Tree: alle campagnes + adsets van dit experiment
      const { data: cmpsRaw } = await supabase
        .from('ai_campaign_meta_campaigns')
        .select('id, meta_campaign_id, angle, daily_budget_cents, daily_budget_share, status')
        .eq('experiment_id', exp.id);
      const campaigns = (cmpsRaw || []) as MetaCampaignRow[];
      const { data: adsetsRaw } = campaigns.length > 0 ? await supabase
        .from('ai_campaign_meta_adsets')
        .select('id, meta_campaign_row_id, meta_adset_id, strategy_type, daily_budget_cents, status')
        .in('meta_campaign_row_id', campaigns.map(c => c.id))
        : { data: [] };
      const adsets = (adsetsRaw || []) as MetaAdsetRow[];

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

      // ── Goedgekeurde reclamaties per ad/adset/campagne ──
      //
      // Reclamaties laten Meta-spend ongemoeid maar maken de bijbehorende
      // lead waardeloos (gratis vervanglead voor klant). Voor optimizer-
      // beslissingen moeten we daarom de NETTO-CPL gebruiken: een variant
      // met 10 leads waarvan 4 gereclameerd telt als 6 echte leads. Dat
      // straft slechte kwaliteit eerlijk af.
      //
      // We scope-en op de meta_campaign_ids van dit experiment om de query
      // klein te houden.
      const campaignMetaIds = campaigns.length > 0
        ? campaigns.map(c => c.meta_campaign_id).filter((x): x is string => !!x)
        : (exp.meta_campaign_id ? [exp.meta_campaign_id] : []);
      const recs = campaignMetaIds.length > 0
        ? await getApprovedReclamationStats(
            { excludeBulkAndDemo: true },
            supabase as unknown as Parameters<typeof getApprovedReclamationStats>[1],
          )
        : null;
      const recByAd = (adId: string | null | undefined) =>
        adId && recs ? recs.byAdId.get(adId) || 0 : 0;
      const recByAdset = (adsetMetaId: string | null | undefined) =>
        adsetMetaId && recs ? recs.byAdsetId.get(adsetMetaId) || 0 : 0;
      const recByCampaign = (campMetaId: string | null | undefined) =>
        campMetaId && recs ? recs.byCampaignId.get(campMetaId) || 0 : 0;

      const totalSpendEur = insights.reduce((s, i) => s + i.spend, 0);
      const totalLeadsBruto = insights.reduce((s, i) => s + i.leads, 0);
      const totalReclamations = campaignMetaIds.reduce((s, cid) => s + recByCampaign(cid), 0);
      const totalLeads = Math.max(0, totalLeadsBruto - totalReclamations);
      const dailyBudgetEur = briefRow.daily_budget_cents / 100;

      // ── (b) cold-funnel ──
      if (totalSpendEur >= COLD_FUNNEL_SPEND_RATIO * dailyBudgetEur && totalLeads === 0) {
        if (!opts.dryRun) {
          if (exp.meta_adset_id) { try { await setEntityStatus(exp.meta_adset_id, 'PAUSED'); } catch (e) { summary.errors.push((e as Error).message); } }
          if (exp.meta_campaign_id) { try { await setEntityStatus(exp.meta_campaign_id, 'PAUSED'); } catch (e) { summary.errors.push((e as Error).message); } }
        }
        await logDecision(supabase, exp.id, null, 'kill_cold_funnel',
          `Spend ${totalSpendEur.toFixed(2)}€ ≥ ${COLD_FUNNEL_SPEND_RATIO}×daily zonder netto leads (bruto=${totalLeadsBruto}, reclamaties=${totalReclamations})`,
          { totalSpendEur, totalLeads, totalLeadsBruto, totalReclamations, dailyBudgetEur },
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
        // Netto-leads: trek goedgekeurde reclamaties op exact deze ad af.
        // We pauzeren/scalen op de eerlijke CPL — een variant met veel
        // afkeurde leads moet sneller worden gestopt, ook al ziet Meta
        // de bruto-CPL als acceptabel.
        const adRecs = recByAd(v.meta_ad_id);
        const netLeads = Math.max(0, ins.leads - adRecs);
        const netCpl = netLeads > 0 ? ins.spend / netLeads : null;
        const enoughData =
          netLeads >= MIN_LEADS_PER_VARIANT || ins.spend * 100 >= MIN_SPEND_PER_VARIANT_CENTS;
        if (!enoughData) continue;

        if (target > 0) {
          if (netCpl != null && netCpl > target * BAD_CPL_RATIO) {
            if (!opts.dryRun) {
              try { await setEntityStatus(v.meta_ad_id, 'PAUSED'); } catch (e) { summary.errors.push((e as Error).message); }
              await supabase.from('ai_campaign_variants').update({ status: 'paused' }).eq('id', v.id);
            }
            await logDecision(supabase, exp.id, v.id, 'pause_loser',
              `Netto CPL €${netCpl.toFixed(2)} > target €${target} × ${BAD_CPL_RATIO} (bruto CPL €${ins.cpl?.toFixed(2) ?? '—'}, reclamaties=${adRecs})`,
              { ins, netLeads, netCpl, adRecs },
              !!opts.dryRun);
            pausedCount++;
          } else if (netCpl != null && netCpl < target * GOOD_CPL_RATIO) {
            winners.push(v);
            scaledCount++;
            if (!opts.dryRun) {
              await supabase
                .from('ai_campaign_variants')
                .update({ scale_count: (v.scale_count || 0) + 1 })
                .eq('id', v.id);
            }
            await logDecision(supabase, exp.id, v.id, 'scale_winner',
              `Netto CPL €${netCpl.toFixed(2)} < target €${target} × ${GOOD_CPL_RATIO} (reclamaties=${adRecs})`,
              { ins, netLeads, netCpl, adRecs },
              !!opts.dryRun);
          }
        } else {
          if (netCpl == null && ins.spend * 100 >= MIN_SPEND_PER_VARIANT_CENTS) {
            if (!opts.dryRun) {
              try { await setEntityStatus(v.meta_ad_id, 'PAUSED'); } catch (e) { summary.errors.push((e as Error).message); }
              await supabase.from('ai_campaign_variants').update({ status: 'paused' }).eq('id', v.id);
            }
            await logDecision(supabase, exp.id, v.id, 'pause_loser',
              `Spend zonder netto-leads ≥ €${MIN_SPEND_PER_VARIANT_CENTS / 100} (bruto=${ins.leads}, reclamaties=${adRecs})`,
              { ins, adRecs },
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

      // ── Tree-aware: per-adset rollups + adset pause + campagne-reallocation ──
      if (adsets.length > 0) {
        // Group variants by meta_adset_row_id
        const variantsByAdset = new Map<string, VariantRow[]>();
        for (const v of variants) {
          if (!v.meta_adset_row_id) continue;
          const arr = variantsByAdset.get(v.meta_adset_row_id) || [];
          arr.push(v);
          variantsByAdset.set(v.meta_adset_row_id, arr);
        }

        // Per-adset evaluatie: hele ad set pauzeren als netto-CPL > 2x target én >=10 netto leads
        const adsetMetrics = new Map<string, { spend: number; leads: number; cpl: number | null; netLeads: number; netCpl: number | null; reclamations: number }>();
        for (const adset of adsets) {
          if (adset.status === 'archived' || adset.status === 'failed') continue;
          const adsetVariants = variantsByAdset.get(adset.id) || [];
          let spend = 0, leads = 0;
          for (const v of adsetVariants) {
            if (!v.meta_ad_id) continue;
            const ins = insightByAd.get(v.meta_ad_id);
            if (!ins) continue;
            spend += ins.spend;
            leads += ins.leads;
          }
          const adsetRecs = recByAdset(adset.meta_adset_id);
          const netLeads = Math.max(0, leads - adsetRecs);
          const cpl = leads > 0 ? spend / leads : null;
          const netCpl = netLeads > 0 ? spend / netLeads : null;
          adsetMetrics.set(adset.id, { spend, leads, cpl, netLeads, netCpl, reclamations: adsetRecs });
          if (target > 0 && netLeads >= MIN_LEADS_PER_VARIANT * 2 && netCpl != null && netCpl > target * (BAD_CPL_RATIO * 1.4)) {
            if (!opts.dryRun && adset.meta_adset_id) {
              try { await setEntityStatus(adset.meta_adset_id, 'PAUSED'); } catch (e) { summary.errors.push((e as Error).message); }
              await supabase.from('ai_campaign_meta_adsets').update({ status: 'paused' }).eq('id', adset.id);
            }
            await logDecision(supabase, exp.id, null, 'pause_adset',
              `Netto adset CPL €${netCpl.toFixed(2)} > 2× target — pauzeer hele set (reclamaties=${adsetRecs})`,
              { adset_id: adset.id, strategy_type: adset.strategy_type, spend, leads, cpl, netLeads, netCpl, reclamations: adsetRecs, target },
              !!opts.dryRun);
            summary.actions.pause_adset++;
          }
        }

        // Per-campagne CBO-reallocation: winners krijgen meer budget, losers minder
        // (op basis van netto-CPL — reclamaties hebben dezelfde impact als kosten)
        if (campaigns.length > 1) {
          const cmpMetrics = campaigns.map(c => {
            const cmpAdsets = adsets.filter(a => a.meta_campaign_row_id === c.id);
            let spend = 0, leads = 0, netLeads = 0;
            for (const a of cmpAdsets) {
              const m = adsetMetrics.get(a.id);
              if (m) { spend += m.spend; leads += m.leads; netLeads += m.netLeads; }
            }
            return {
              campaign: c,
              spend,
              leads,
              netLeads,
              cpl: leads > 0 ? spend / leads : null,
              netCpl: netLeads > 0 ? spend / netLeads : null,
            };
          });
          const hasEnough = cmpMetrics.every(m => m.netLeads >= MIN_LEADS_PER_VARIANT);
          if (hasEnough && target > 0) {
            // Sorteer op netto-CPL (lager = beter), boost top-1, dim worst-1.
            const sorted = [...cmpMetrics].filter(m => m.netCpl != null).sort((a, b) => (a.netCpl! - b.netCpl!));
            if (sorted.length >= 2) {
              const winner = sorted[0];
              const loser = sorted[sorted.length - 1];
              const winnerBudget = winner.campaign.daily_budget_cents;
              const loserBudget = loser.campaign.daily_budget_cents;
              const maxBudget = briefRow.daily_budget_cents * MAX_DAILY_BUDGET_MULT;
              const transferAmt = Math.min(
                Math.round(loserBudget * SCALE_BUDGET_PCT),
                Math.max(0, maxBudget - winnerBudget),
              );
              if (transferAmt > 50) {
                if (!opts.dryRun) {
                  try {
                    // Meta CBO daily_budget update
                    const creds = await getMetaCredentials();
                    if (creds && winner.campaign.meta_campaign_id) {
                      await fetch(`https://graph.facebook.com/v21.0/${winner.campaign.meta_campaign_id}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: new URLSearchParams({ daily_budget: String(winnerBudget + transferAmt), access_token: creds.accessToken }).toString(),
                      });
                    }
                    if (creds && loser.campaign.meta_campaign_id) {
                      await fetch(`https://graph.facebook.com/v21.0/${loser.campaign.meta_campaign_id}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: new URLSearchParams({ daily_budget: String(Math.max(100, loserBudget - transferAmt)), access_token: creds.accessToken }).toString(),
                      });
                    }
                    await supabase.from('ai_campaign_meta_campaigns').update({ daily_budget_cents: winnerBudget + transferAmt }).eq('id', winner.campaign.id);
                    await supabase.from('ai_campaign_meta_campaigns').update({ daily_budget_cents: Math.max(100, loserBudget - transferAmt) }).eq('id', loser.campaign.id);
                  } catch (e) {
                    summary.errors.push((e as Error).message);
                  }
                }
                await logDecision(supabase, exp.id, null, 'reallocate_budget',
                  `Budget shift €${(transferAmt / 100).toFixed(2)} van "${loser.campaign.angle}" naar "${winner.campaign.angle}" (op netto CPL)`,
                  {
                    winner: { angle: winner.campaign.angle, cpl: winner.cpl, netCpl: winner.netCpl, leads: winner.leads, netLeads: winner.netLeads },
                    loser: { angle: loser.campaign.angle, cpl: loser.cpl, netCpl: loser.netCpl, leads: loser.leads, netLeads: loser.netLeads },
                    transferCents: transferAmt,
                  },
                  !!opts.dryRun);
                summary.actions.reallocate_budget++;
              }
            }
          }
        }
      }

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
