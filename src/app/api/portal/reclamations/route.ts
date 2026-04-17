import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { hasPermission, forbidden, PERMISSIONS } from '@/lib/portalPermissions';

const VALID_REASONS = [
  'foutief_telefoonnummer',
  'dubbele_lead',
  'buiten_doelgebied',
] as const;

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.RECLAMATIONS_CREATE)) return forbidden();

  const { customer } = session;
  const leadId = request.nextUrl.searchParams.get('lead_id');
  if (!leadId) {
    return NextResponse.json({ error: 'lead_id is verplicht' }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data } = await supabase
    .from('lead_reclamations')
    .select('*')
    .eq('lead_id', leadId)
    .eq('customer_id', customer.id)
    .maybeSingle();

  return NextResponse.json({ reclamation: data });
}

export async function POST(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.RECLAMATIONS_CREATE)) return forbidden();

  const { customer } = session;

  try {
    const { lead_id, reason, description } = await request.json();

    if (!lead_id || !reason) {
      return NextResponse.json({ error: 'lead_id en reason zijn verplicht' }, { status: 400 });
    }

    if (!VALID_REASONS.includes(reason)) {
      return NextResponse.json({ error: 'Ongeldige reden' }, { status: 400 });
    }

    const supabase = createServerClient();

    const { data: assignment } = await supabase
      .from('lead_assignments')
      .select('lead_id')
      .eq('lead_id', lead_id)
      .eq('customer_id', customer.id)
      .maybeSingle();

    if (!assignment) {
      const { data: directLead } = await supabase
        .from('leads')
        .select('id')
        .eq('id', lead_id)
        .eq('customer_id', customer.id)
        .maybeSingle();
      if (!directLead) {
        return NextResponse.json({ error: 'Lead niet gevonden' }, { status: 404 });
      }
    }

    const { data: existing } = await supabase
      .from('lead_reclamations')
      .select('id, status')
      .eq('lead_id', lead_id)
      .eq('customer_id', customer.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'Er is al een reclamatie ingediend voor deze lead', reclamation: existing },
        { status: 409 },
      );
    }

    const { data, error } = await supabase
      .from('lead_reclamations')
      .insert({
        lead_id,
        customer_id: customer.id,
        reason,
        description: description || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[reclamations] insert failed:', error);
      return NextResponse.json({ error: 'Reclamatie opslaan mislukt' }, { status: 500 });
    }

    return NextResponse.json({ reclamation: data });
  } catch {
    return NextResponse.json({ error: 'Er ging iets mis' }, { status: 500 });
  }
}
