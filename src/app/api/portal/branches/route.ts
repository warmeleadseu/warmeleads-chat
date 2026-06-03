import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();

  const supabase = createServerClient();

  const { data: branches, error } = await supabase
    .from('branches')
    .select('slug, name, color, is_partner_branch, branch_fields(key, label, field_type, options, is_required, sort_order)')
    .eq('is_active', true)
    .eq('hidden_from_admin', false)
    .neq('is_partner_branch', true)
    .order('sort_order', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Branches ophalen mislukt' }, { status: 500 });
  }

  const sorted = (branches || []).map(b => ({
    ...b,
    branch_fields: (b.branch_fields || []).sort(
      (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
    ),
  }));

  return NextResponse.json({ branches: sorted });
}
