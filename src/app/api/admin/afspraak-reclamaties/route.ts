import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { syncAfsprakenBatch } from '@/lib/appointmentBatchSync';

/** Beoordelen van reclamaties op afspraken. Gespiegeld aan het leadproces. */

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const status = request.nextUrl.searchParams.get('status');
  const supabase = createServerClient();

  let q = supabase
    .from('afspraak_reclamaties')
    .select('*, customers(name, email), appointments(starts_at, contact_name, contact_phone, postcode, city, branch, status, batch_id)')
    .order('created_at', { ascending: false })
    .limit(1000);

  if (status && status !== 'all') q = q.eq('status', status);

  const { data, error } = await q;
  if (error) {
    console.error('[admin/afspraak-reclamaties GET]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}

export async function PUT(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  if (admin.role === 'accountmanager') {
    return NextResponse.json({ error: 'Alleen superadmin/admin kan beoordelen' }, { status: 403 });
  }

  const { id, status, admin_notes } = await request.json();
  if (!id) return NextResponse.json({ error: 'id ontbreekt' }, { status: 400 });
  if (!['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Status moet approved of rejected zijn' }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data: huidig } = await supabase
    .from('afspraak_reclamaties')
    .select('id, status, appointment_id')
    .eq('id', id)
    .maybeSingle();
  if (!huidig) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 });
  if (huidig.status === status) {
    return NextResponse.json({ error: 'Status is al ' + status }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('afspraak_reclamaties')
    .update({
      status,
      admin_notes: admin_notes ?? null,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*, appointments(batch_id)')
    .single();

  if (error) {
    console.error('[admin/afspraak-reclamaties PUT]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  /* Compensatie. Bij goedkeuring krijgt de klant er één afspraak bij, zodat hij
     alsnog het aantal ontvangt waarvoor hij betaalde. Wordt een eerder
     goedgekeurde reclamatie alsnog afgewezen, dan gaat die er weer af. */
  const batchId = (data.appointments as { batch_id?: string | null } | null)?.batch_id ?? null;
  let compensatie = 0;
  if (batchId) {
    if (status === 'approved' && huidig.status !== 'approved') compensatie = 1;
    if (status === 'rejected' && huidig.status === 'approved') compensatie = -1;
  }

  if (compensatie !== 0 && batchId) {
    const { data: batch } = await supabase
      .from('appointment_batches')
      .select('id, batch_size, compensatie_afspraken, status')
      .eq('id', batchId)
      .maybeSingle();

    if (batch) {
      const nieuweCompensatie = Math.max(0, (batch.compensatie_afspraken ?? 0) + compensatie);
      const velden: Record<string, unknown> = {
        compensatie_afspraken: nieuweCompensatie,
        batch_size: batch.batch_size + compensatie,
        updated_at: new Date().toISOString(),
      };
      /* Een volle batch weer openzetten mag alleen als er door de compensatie
         daadwerkelijk ruimte bij komt. */
      if (compensatie > 0 && batch.status === 'completed') velden.status = 'active';
      await supabase.from('appointment_batches').update(velden).eq('id', batchId);
      await syncAfsprakenBatch(supabase, batchId);
    }
  }

  return NextResponse.json({ ...data, compensatie });
}
