import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { setEntityStatus } from '@/lib/metaMarketingApi';

export const runtime = 'nodejs';

interface Ctx { params: { id: string } }

export async function POST(request: NextRequest, ctx: Ctx) {
  const { admin, error: authErr } = await requireSuperAdmin(request);
  if (authErr || !admin) return authErr;

  const experimentId = ctx.params.id;
  const supabase = createServerClient();

  const { data: exp } = await supabase
    .from('ai_campaign_experiments')
    .select('*')
    .eq('id', experimentId)
    .maybeSingle();
  if (!exp) return NextResponse.json({ error: 'Experiment niet gevonden' }, { status: 404 });

  if (exp.phase === 'killed') {
    return NextResponse.json({ ok: true, idempotent: true, experiment: exp });
  }

  const errors: string[] = [];
  if (exp.meta_campaign_id) {
    try {
      await setEntityStatus(exp.meta_campaign_id, 'PAUSED');
    } catch (e) {
      errors.push(`campaign pause: ${(e as Error).message}`);
    }
  }
  if (exp.meta_adset_id) {
    try {
      await setEntityStatus(exp.meta_adset_id, 'PAUSED');
    } catch (e) {
      errors.push(`adset pause: ${(e as Error).message}`);
    }
  }

  await supabase
    .from('ai_campaign_experiments')
    .update({ phase: 'killed', ended_at: new Date().toISOString(), stop_reason: 'manual_kill' })
    .eq('id', experimentId);

  await supabase
    .from('ai_campaign_variants')
    .update({ status: 'paused' })
    .eq('experiment_id', experimentId)
    .in('status', ['live', 'draft', 'paused']);

  await supabase
    .from('ai_campaign_briefs')
    .update({ status: 'killed' })
    .eq('id', exp.brief_id);

  await supabase.from('ai_campaign_decisions').insert({
    experiment_id: experimentId,
    action: 'manual_kill',
    reason: 'admin_kill_button',
    metrics_snapshot: { errors },
  });

  return NextResponse.json({ ok: true, errors });
}
