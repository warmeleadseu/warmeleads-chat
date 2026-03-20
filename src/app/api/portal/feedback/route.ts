import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';

const VALID_RATINGS = [
  'goed_contact',
  'onbereikbaar',
  'niet_geinteresseerd',
  'fout_nummer',
  'verkocht',
] as const;

async function verifyLeadOwnership(
  supabase: ReturnType<typeof createServerClient>,
  leadId: string,
  customerId: string,
): Promise<boolean> {
  const { data: directLead } = await supabase
    .from('leads')
    .select('id')
    .eq('id', leadId)
    .eq('customer_id', customerId)
    .maybeSingle();

  if (directLead) return true;

  const { data: assignment } = await supabase
    .from('lead_assignments')
    .select('lead_id')
    .eq('lead_id', leadId)
    .eq('customer_id', customerId)
    .maybeSingle();

  return !!assignment;
}

export async function GET(request: NextRequest) {
  const customer = await verifyCustomer(request);
  if (!customer) return portalUnauthorized();

  const leadId = request.nextUrl.searchParams.get('lead_id');
  if (!leadId) {
    return NextResponse.json({ error: 'lead_id is verplicht' }, { status: 400 });
  }

  const supabase = createServerClient();

  const owns = await verifyLeadOwnership(supabase, leadId, customer.id);
  if (!owns) {
    return NextResponse.json({ error: 'Lead niet gevonden' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('lead_feedback')
    .select('*')
    .eq('lead_id', leadId)
    .eq('customer_id', customer.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'Feedback ophalen mislukt' }, { status: 500 });
  }

  return NextResponse.json({ feedback: data });
}

export async function POST(request: NextRequest) {
  const customer = await verifyCustomer(request);
  if (!customer) return portalUnauthorized();

  try {
    const { lead_id, rating, comment } = await request.json();

    if (!lead_id || !rating) {
      return NextResponse.json({ error: 'lead_id en rating zijn verplicht' }, { status: 400 });
    }

    if (!VALID_RATINGS.includes(rating)) {
      return NextResponse.json(
        { error: `Ongeldige rating. Opties: ${VALID_RATINGS.join(', ')}` },
        { status: 400 },
      );
    }

    const supabase = createServerClient();

    const owns = await verifyLeadOwnership(supabase, lead_id, customer.id);
    if (!owns) {
      return NextResponse.json({ error: 'Lead niet gevonden' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('lead_feedback')
      .upsert(
        {
          lead_id,
          customer_id: customer.id,
          rating,
          comment: comment || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'lead_id,customer_id' },
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Feedback opslaan mislukt' }, { status: 500 });
    }

    return NextResponse.json({ feedback: data });
  } catch {
    return NextResponse.json({ error: 'Er ging iets mis' }, { status: 500 });
  }
}
