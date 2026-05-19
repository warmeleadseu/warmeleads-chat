import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';

export const runtime = 'nodejs';

interface Ctx { params: { id: string } }

export async function GET(request: NextRequest, ctx: Ctx) {
  const { admin, error: authErr } = await requireSuperAdmin(request);
  if (authErr || !admin) return authErr;

  const supabase = createServerClient();
  const { data: brief } = await supabase
    .from('ai_campaign_briefs')
    .select('*')
    .eq('id', ctx.params.id)
    .maybeSingle();
  if (!brief) return NextResponse.json({ error: 'Brief niet gevonden' }, { status: 404 });

  const { data: variants } = await supabase
    .from('ai_campaign_variants')
    .select('*')
    .eq('brief_id', brief.id)
    .order('created_at');

  const { data: experiments } = await supabase
    .from('ai_campaign_experiments')
    .select('*')
    .eq('brief_id', brief.id);

  return NextResponse.json({
    brief,
    variants: variants || [],
    experiments: experiments || [],
  });
}
