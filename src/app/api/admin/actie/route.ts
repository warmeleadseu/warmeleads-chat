import { randomInt } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { ACTIE, actieFase, wijsWinnaarAan } from '@/lib/lotenActie';
import { ActieLaadFout, laadDeelnemers, laadLotRijen } from '@/lib/lotenActieLaden';

/**
 * Najaarsactie: stand per deelnemer, de loten per batch en de trekking.
 * Superadmin en admin. POST trekt na afloop één keer de winnaar.
 */

export const maxDuration = 60;

async function toegang(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return { admin: null, fout: unauthorized() };
  if (admin.role === 'accountmanager') {
    return { admin: null, fout: NextResponse.json({ error: 'Alleen admin en superadmin' }, { status: 403 }) };
  }
  return { admin, fout: null };
}

export async function GET(request: NextRequest) {
  const { fout } = await toegang(request);
  if (fout) return fout;
  const supabase = createServerClient();

  try {
    const lotRijen = await laadLotRijen(supabase);
    const [deelnemers, { data: trekking }, { data: batches }] = await Promise.all([
      laadDeelnemers(supabase, { lotRijen }),
      supabase.from('actie_trekkingen').select('*').eq('actie', ACTIE.code).maybeSingle(),
      lotRijen.length > 0
        ? supabase.from('customer_batches').select('id, branch, customers(name)').in('id', lotRijen.map(r => r.batch_id))
        : Promise.resolve({ data: [] as { id: string; branch: string; customers: { name: string } | { name: string }[] | null }[] }),
    ]);
    const info = new Map((batches ?? []).map(b => {
      const k = Array.isArray(b.customers) ? b.customers[0] : b.customers;
      return [b.id as string, { branch: b.branch as string, klant: k?.name ?? 'Onbekende klant' }];
    }));

    let winnaar: { klant: string; email: string | null } | null = null;
    if (trekking) {
      const { data: k } = await supabase.from('customers').select('name, email').eq('id', trekking.winnaar_customer_id).maybeSingle();
      winnaar = { klant: (k?.name as string) ?? 'Onbekende klant', email: (k?.email as string | null) ?? null };
    }

    return NextResponse.json({
      actie: { ...ACTIE, fase: actieFase() },
      deelnemers,
      loten: lotRijen.map(r => ({ ...r, klant: info.get(r.batch_id)?.klant ?? 'Onbekende klant', branch: info.get(r.batch_id)?.branch ?? '' })),
      trekking: trekking ? { ...trekking, winnaar } : null,
    });
  } catch (err) {
    const melding = err instanceof ActieLaadFout ? err.message : 'Onbekende fout';
    console.error('[admin/actie]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: melding }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { admin, fout } = await toegang(request);
  if (fout || !admin) return fout ?? unauthorized();

  const body = await request.json().catch(() => ({}));
  if (body?.actie !== 'trek') return NextResponse.json({ error: 'Onbekende actie' }, { status: 400 });
  if (actieFase() !== 'afgelopen') {
    return NextResponse.json({ error: `De trekking kan pas na ${ACTIE.eindLabel}.` }, { status: 400 });
  }

  const supabase = createServerClient();
  try {
    const { data: al } = await supabase.from('actie_trekkingen').select('id').eq('actie', ACTIE.code).maybeSingle();
    if (al) return NextResponse.json({ error: 'De winnaar is al getrokken.' }, { status: 409 });

    const deelnemers = (await laadDeelnemers(supabase)).filter(d => d.totaal > 0);
    const totaal = deelnemers.reduce((s, d) => s + d.totaal, 0);
    if (totaal === 0) return NextResponse.json({ error: 'Er zijn geen loten om uit te trekken.' }, { status: 400 });

    /* Cryptografisch toeval; met het lotnummer en de lijst is de uitslag na te rekenen. */
    const lotnummer = randomInt(totaal);
    const gekozen = wijsWinnaarAan(deelnemers.map(d => ({ customer_id: d.customer_id, loten: d.totaal })), lotnummer);
    if (!gekozen) return NextResponse.json({ error: 'Trekking mislukt' }, { status: 500 });

    const lijst = deelnemers.map(d => ({
      customer_id: d.customer_id, klant: d.klant, batch_loten: d.batchLoten, bulk_leads: d.bulkLeads, bulk_loten: d.bulkLoten, loten: d.totaal,
    }));
    const { error } = await supabase.from('actie_trekkingen').insert({
      actie: ACTIE.code,
      winnaar_customer_id: gekozen.customer_id,
      lotnummer,
      totaal_loten: totaal,
      deelnemers: lijst,
      getrokken_door: admin.id,
      getrokken_door_naam: admin.name ?? admin.email,
    });
    /* De unieke sleutel op actie houdt een gelijktijdige tweede trekking tegen. */
    if (error) {
      const dubbel = error.code === '23505';
      return NextResponse.json({ error: dubbel ? 'De winnaar is al getrokken.' : error.message }, { status: dubbel ? 409 : 500 });
    }

    const winnaar = deelnemers.find(d => d.customer_id === gekozen.customer_id);
    await logAudit({
      adminId: admin.id,
      adminName: admin.name ?? admin.email,
      action: 'actie_trekking',
      entityType: 'customer',
      entityId: gekozen.customer_id,
      details: { actie: ACTIE.code, winnaar: winnaar?.klant, loten_winnaar: winnaar?.totaal, totaal_loten: totaal, lotnummer, deelnemers: deelnemers.length },
    });

    return NextResponse.json({ ok: true, winnaar: winnaar?.klant, lotnummer, totaal });
  } catch (err) {
    const melding = err instanceof ActieLaadFout ? err.message : 'Onbekende fout';
    console.error('[admin/actie POST]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: melding }, { status: 500 });
  }
}
