import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { syncBatchDelivered } from '@/lib/batchSync';
import { TERUGDRAAI_VENSTER_MINUTEN } from '@/lib/restleads';

/**
 * Een zojuist uitgedeelde restlead terugdraaien.
 *
 * Alleen binnen vijf minuten, en alleen zolang de lead nog niet bij de klant is
 * aangekomen. Daarna niet meer: de klant heeft hem dan in zijn portaal zien
 * staan of via een koppeling binnengekregen, en een lead weghalen die hij al
 * heeft gebeld levert meer verwarring op dan het oplost.
 */

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  if (admin.role === 'accountmanager') {
    return NextResponse.json({ error: 'Alleen superadmin/admin kan dit terugdraaien' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const leadId: string = body.lead_id;
  const customerId: string = body.customer_id;

  if (!leadId || !customerId) {
    return NextResponse.json({ error: 'lead_id en customer_id zijn verplicht' }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data: toewijzing } = await supabase
    .from('lead_assignments')
    .select('id, assigned_at, status, batch_id')
    .eq('lead_id', leadId)
    .eq('customer_id', customerId)
    .order('assigned_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!toewijzing) {
    return NextResponse.json({ error: 'Deze toewijzing bestaat niet (meer)' }, { status: 404 });
  }

  const minutenOud = (Date.now() - new Date(toewijzing.assigned_at).getTime()) / 60_000;
  if (minutenOud > TERUGDRAAI_VENSTER_MINUTEN) {
    return NextResponse.json(
      { error: `Terugdraaien kan tot ${TERUGDRAAI_VENSTER_MINUTEN} minuten na het uitdelen` },
      { status: 409 },
    );
  }

  /* De klant mag er nog niets mee gedaan hebben. Een gewijzigde status betekent
     dat iemand de lead heeft opgepakt. */
  if (toewijzing.status && toewijzing.status !== 'nieuw') {
    return NextResponse.json(
      { error: 'De klant heeft deze lead al opgepakt' },
      { status: 409 },
    );
  }

  /* En hij mag nog niet naar een gekoppeld systeem zijn weggeschreven: uit een
     spreadsheet of CRM halen we hem niet meer weg. */
  const { data: sync } = await supabase
    .from('integration_sync_log')
    .select('id, status')
    .eq('assignment_id', toewijzing.id)
    .eq('status', 'success')
    .limit(1);

  if (sync && sync.length > 0) {
    return NextResponse.json(
      { error: 'De lead is al doorgezet naar een gekoppeld systeem van de klant' },
      { status: 409 },
    );
  }

  const { error: delErr } = await supabase
    .from('lead_assignments')
    .delete()
    .eq('id', toewijzing.id);

  if (delErr) {
    console.error('[restleads/ongedaan]', delErr.message);
    return NextResponse.json({ error: 'Terugdraaien mislukt' }, { status: 500 });
  }

  /* Het spoor in de wachtrij weghalen, anders blijft de lead uit de werklijst
     terwijl hij er weer in hoort. */
  await supabase
    .from('geplande_leadleveringen')
    .delete()
    .eq('lead_id', leadId)
    .eq('customer_id', customerId)
    .eq('status', 'geleverd');

  if (toewijzing.batch_id) {
    await syncBatchDelivered(supabase, toewijzing.batch_id);
  }

  return NextResponse.json({ success: true });
}
