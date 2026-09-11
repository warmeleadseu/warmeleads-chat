import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { hasPermission, forbidden, PERMISSIONS } from '@/lib/portalPermissions';
import { getLeadReclamationEligibility } from '@/lib/reclamationEligibility';

/**
 * De velden die het portaal van een reclamatie te zien krijgt.
 *
 * Bewust opgesomd in plaats van `select('*')`: zo bepalen wij wat er naar de
 * klant gaat, en kan een kolom die later aan de tabel wordt toegevoegd er niet
 * ongemerkt in meeliften. `admin_notes` staat er met opzet bij; de klant hoort
 * te lezen waarom zijn reclamatie is goed- of afgekeurd.
 */
/* Ruim boven wat een klant ooit heeft ingediend; de drukste klant zit op enkele tientallen. */
const LIJST_LIMIET = 500;

const KLANT_VELDEN = 'id, lead_id, reason, description, status, admin_notes, created_at, resolved_at';

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
  const supabase = createServerClient();

  /* Zonder lead_id: het volledige overzicht van deze klant. Met lead_id: de ene
     reclamatie bij die lead, plus of er een nieuwe ingediend mag worden. */
  if (!leadId) {
    const { data, error } = await supabase
      .from('lead_reclamations')
      .select(`${KLANT_VELDEN}, leads(naam_klant, plaatsnaam, postcode, branch)`)
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(LIJST_LIMIET);

    if (error) {
      console.error('[portal/reclamations] lijst mislukt:', error.message);
      return NextResponse.json({ error: 'Overzicht laden mislukt' }, { status: 500 });
    }

    return NextResponse.json({ reclamations: data ?? [] });
  }

  const eligibility = await getLeadReclamationEligibility(supabase, customer.id, leadId);
  if (!eligibility.allowed && eligibility.message === 'Lead niet gevonden') {
    return NextResponse.json({ error: eligibility.message }, { status: 404 });
  }

  const { data } = await supabase
    .from('lead_reclamations')
    .select(KLANT_VELDEN)
    .eq('lead_id', leadId)
    .eq('customer_id', customer.id)
    .maybeSingle();

  return NextResponse.json({
    reclamation: data,
    allowed: eligibility.allowed,
    block_reason: eligibility.allowed ? null : eligibility.message ?? null,
  });
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

    const eligibility = await getLeadReclamationEligibility(supabase, customer.id, lead_id);
    if (!eligibility.allowed) {
      const status = eligibility.message === 'Lead niet gevonden' ? 404 : 403;
      return NextResponse.json({ error: eligibility.message }, { status });
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
      .select(KLANT_VELDEN)
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
