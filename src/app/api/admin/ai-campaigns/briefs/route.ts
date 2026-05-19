import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { admin, error: authErr } = await requireSuperAdmin(request);
  if (authErr || !admin) return authErr;

  const branch = request.nextUrl.searchParams.get('branch');
  const supabase = createServerClient();

  let q = supabase
    .from('ai_campaign_briefs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (branch) q = q.eq('branch', branch);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ briefs: data || [] });
}
