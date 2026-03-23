import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  if (body.confirm !== 'VERWIJDER_ALLES') {
    return NextResponse.json({ error: 'Bevestig met confirm: "VERWIJDER_ALLES"' }, { status: 400 });
  }

  const supabase = createServerClient();
  const results: Record<string, string> = {};

  // 1. Lead assignments (references leads + batches)
  const { error: e1 } = await supabase.from('lead_assignments').delete().gte('id', '00000000-0000-0000-0000-000000000000');
  results.lead_assignments = e1 ? `ERROR: ${e1.message}` : 'deleted';

  // 2. Leads
  const { error: e2 } = await supabase.from('leads').delete().gte('id', '00000000-0000-0000-0000-000000000000');
  results.leads = e2 ? `ERROR: ${e2.message}` : 'deleted';

  // 3. Customer batches
  const { error: e3 } = await supabase.from('customer_batches').delete().gte('id', '00000000-0000-0000-0000-000000000000');
  results.customer_batches = e3 ? `ERROR: ${e3.message}` : 'deleted';

  // 4. Meta ad spend
  const { error: e4 } = await supabase.from('meta_ad_spend').delete().gte('id', '00000000-0000-0000-0000-000000000000');
  results.meta_ad_spend = e4 ? `ERROR: ${e4.message}` : 'deleted';

  return NextResponse.json({ ok: true, results });
}
