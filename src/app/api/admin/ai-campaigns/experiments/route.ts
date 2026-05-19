import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { fetchAdLevelInsightsForAds } from '@/lib/metaMarketingApi';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { admin, error: authErr } = await requireSuperAdmin(request);
  if (authErr || !admin) return authErr;

  const refresh = request.nextUrl.searchParams.get('refresh') === '1';
  const supabase = createServerClient();

  const { data: experiments } = await supabase
    .from('ai_campaign_experiments')
    .select('*, brief:ai_campaign_briefs(id, branch, status, target_cpl_cents, daily_budget_cents, is_test_mode, created_at)')
    .order('created_at', { ascending: false })
    .limit(50);

  const ids = (experiments || []).map(e => e.id);
  let variantsByExp: Record<string, unknown[]> = {};
  if (ids.length > 0) {
    const { data: variants } = await supabase
      .from('ai_campaign_variants')
      .select('id, experiment_id, brief_id, headline, primary_text, description, cta, image_url, meta_ad_id, status, parent_variant_id, scale_count, policy_precheck')
      .in('experiment_id', ids);
    variantsByExp = {};
    for (const v of variants || []) {
      const k = v.experiment_id as string;
      (variantsByExp[k] ||= []).push(v);
    }

    if (refresh) {
      const adIds = (variants || [])
        .map(v => v.meta_ad_id)
        .filter((x): x is string => typeof x === 'string' && x.length > 0);
      if (adIds.length > 0) {
        try {
          const insights = await fetchAdLevelInsightsForAds(adIds);
          variantsByExp = Object.fromEntries(
            Object.entries(variantsByExp).map(([k, list]) => [
              k,
              (list as Array<Record<string, unknown>>).map(v => {
                const ins = insights.find(i => i.ad_id === v.meta_ad_id);
                return ins ? { ...v, insights: ins } : v;
              }),
            ]),
          );
        } catch (e) {
          console.warn('[ai-campaigns/experiments] insights refresh failed', (e as Error).message);
        }
      }
    }
  }

  return NextResponse.json({
    experiments: (experiments || []).map(e => ({ ...e, variants: variantsByExp[e.id] || [] })),
  });
}
