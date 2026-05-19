import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { setEntityStatus } from '@/lib/metaMarketingApi';
import { isAiCampaignsEnabled, reserveBranchBudget } from '@/lib/aiCampaignBudget';

export const runtime = 'nodejs';

interface Ctx { params: { id: string } }

export async function POST(request: NextRequest, ctx: Ctx) {
  const { admin, error: authErr } = await requireSuperAdmin(request);
  if (authErr || !admin) return authErr;

  if (!(await isAiCampaignsEnabled())) {
    return NextResponse.json({ error: 'AI campaigns master switch staat uit.' }, { status: 409 });
  }

  const experimentId = ctx.params.id;
  const supabase = createServerClient();

  const { data: exp } = await supabase
    .from('ai_campaign_experiments')
    .select('*')
    .eq('id', experimentId)
    .maybeSingle();
  if (!exp) return NextResponse.json({ error: 'Experiment niet gevonden' }, { status: 404 });
  if (exp.phase === 'running') {
    return NextResponse.json({ ok: true, idempotent: true, experiment: exp });
  }

  const { data: brief } = await supabase
    .from('ai_campaign_briefs')
    .select('*')
    .eq('id', exp.brief_id)
    .single();
  if (!brief) return NextResponse.json({ error: 'Brief niet gevonden' }, { status: 404 });

  const reserve = await reserveBranchBudget(brief.branch, brief.daily_budget_cents);
  if (!reserve.ok) {
    return NextResponse.json({ error: 'Branche-budget bereikt of niet geconfigureerd', reserve }, { status: 402 });
  }

  const errors: string[] = [];
  if (exp.meta_adset_id) {
    try {
      await setEntityStatus(exp.meta_adset_id, 'ACTIVE');
    } catch (e) {
      errors.push(`adset activate: ${(e as Error).message}`);
    }
  }
  if (exp.meta_campaign_id) {
    try {
      await setEntityStatus(exp.meta_campaign_id, 'ACTIVE');
    } catch (e) {
      errors.push(`campaign activate: ${(e as Error).message}`);
    }
  }

  await supabase
    .from('ai_campaign_experiments')
    .update({ phase: 'running', ended_at: null, stop_reason: null })
    .eq('id', experimentId);

  await supabase
    .from('ai_campaign_variants')
    .update({ status: 'live' })
    .eq('experiment_id', experimentId)
    .eq('status', 'paused');

  await supabase
    .from('ai_campaign_briefs')
    .update({ status: 'launched' })
    .eq('id', exp.brief_id);

  await supabase.from('ai_campaign_decisions').insert({
    experiment_id: experimentId,
    action: 'manual_resume',
    reason: 'admin_resume_button',
    metrics_snapshot: { errors },
  });

  return NextResponse.json({ ok: true, errors });
}
