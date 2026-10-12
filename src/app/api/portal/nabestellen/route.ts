import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { hasPermission, PERMISSIONS } from '@/lib/portalPermissions';
import { kiesNabestelSuggestie, type NabestelBatch } from '@/lib/nabestellen';

/**
 * Nabestelsuggestie voor de balk bovenin het portaal: een batch die bijna of
 * net vol is en nog niet is nabesteld. Alleen voor wie mag bestellen.
 */
export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.ORDERS_CREATE)) return NextResponse.json({ suggestie: null });

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('customer_batches')
    .select('id, branch, batch_kind, delivery_model, status, is_paid, batch_size, leads_delivered, created_at, completed_at')
    .eq('customer_id', session.customer.id)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ suggestie: null });

  const suggestie = kiesNabestelSuggestie((data ?? []) as NabestelBatch[]);
  if (!suggestie) return NextResponse.json({ suggestie: null }, { headers: { 'Cache-Control': 'no-store' } });

  const { data: branche } = await supabase.from('branches').select('name').eq('slug', suggestie.branch).maybeSingle();
  return NextResponse.json(
    { suggestie: { ...suggestie, branche_naam: branche?.name ?? suggestie.branch } },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
