import { randomInt } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { actieFase, actieLabels, kiesZichtbareActie, valideerNieuweActie, wijsWinnaarAan, type Actie } from '@/lib/lotenActie';
import { ActieLaadFout, laadActies, laadDeelnemers, laadLotRijen, laadTrekkingen } from '@/lib/lotenActieLaden';

/**
 * Acties met loten. Superadmin en admin.
 *
 * GET ?actie=code: alle acties (om tussen te wisselen) en van de gekozen
 *   actie de deelnemers, de loten per batch en de trekking. Zonder code de
 *   lopende of meest recente actie.
 * POST { actie: 'trek', code }: na afloop één keer de winnaar trekken.
 * POST { actie: 'nieuw', naam, startDag, laatsteDag, prijsLeads, leadsPerLot, bulkPerLot }
 * DELETE ?actie=code: alleen een actie die nog niet begonnen is.
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

function foutAntwoord(err: unknown, waar: string) {
  const melding = err instanceof ActieLaadFout ? err.message : 'Onbekende fout';
  console.error(`[admin/actie ${waar}]`, err instanceof Error ? err.message : err);
  return NextResponse.json({ error: melding }, { status: 500 });
}

const metLabels = (a: Actie) => ({ ...a, ...actieLabels(a), fase: actieFase(a) });

export async function GET(request: NextRequest) {
  const { fout } = await toegang(request);
  if (fout) return fout;
  const supabase = createServerClient();

  try {
    const [acties, trekkingen] = await Promise.all([laadActies(supabase), laadTrekkingen(supabase)]);
    if (acties.length === 0) return NextResponse.json({ acties: [], actie: null, deelnemers: [], loten: [], trekking: null });

    const gevraagd = request.nextUrl.searchParams.get('actie');
    const getrokkenOp = new Map([...trekkingen.values()].map(t => [t.actie, t.getrokken_op]));
    const actie = acties.find(a => a.code === gevraagd) ?? kiesZichtbareActie(acties, getrokkenOp) ?? acties[0];

    const lotRijen = await laadLotRijen(supabase, actie);
    const [deelnemers, { data: batches }] = await Promise.all([
      laadDeelnemers(supabase, actie, { lotRijen }),
      lotRijen.length > 0
        ? supabase.from('customer_batches').select('id, branch, customers(name)').in('id', lotRijen.map(r => r.batch_id))
        : Promise.resolve({ data: [] as { id: string; branch: string; customers: { name: string } | { name: string }[] | null }[] }),
    ]);
    const info = new Map((batches ?? []).map(b => {
      const k = Array.isArray(b.customers) ? b.customers[0] : b.customers;
      return [b.id as string, { branch: b.branch as string, klant: k?.name ?? 'Onbekende klant' }];
    }));

    const t = trekkingen.get(actie.code) ?? null;
    let winnaar: { klant: string; email: string | null } | null = null;
    if (t) {
      const { data: k } = await supabase.from('customers').select('name, email').eq('id', t.winnaar_customer_id).maybeSingle();
      winnaar = { klant: (k?.name as string) ?? 'Onbekende klant', email: (k?.email as string | null) ?? null };
    }

    return NextResponse.json({
      acties: acties.map(a => ({ ...metLabels(a), getrokken: trekkingen.has(a.code) })),
      actie: metLabels(actie),
      deelnemers,
      loten: lotRijen.map(r => ({ ...r, klant: info.get(r.batch_id)?.klant ?? 'Onbekende klant', branch: info.get(r.batch_id)?.branch ?? '' })),
      trekking: t ? { ...t, winnaar } : null,
    });
  } catch (err) {
    return foutAntwoord(err, 'GET');
  }
}

export async function POST(request: NextRequest) {
  const { admin, fout } = await toegang(request);
  if (fout || !admin) return fout ?? unauthorized();
  const body = await request.json().catch(() => ({}));
  const supabase = createServerClient();
  const wie = admin.name ?? admin.email;

  /* ── Nieuwe actie ── */
  if (body?.actie === 'nieuw') {
    try {
      const bestaande = await laadActies(supabase);
      const r = valideerNieuweActie(body, bestaande);
      if (!r.ok) return NextResponse.json({ error: r.fout }, { status: 400 });
      const a = r.actie;
      const { error } = await supabase.from('acties').insert({
        code: a.code, naam: a.naam, start_op: a.start, eind_op: a.eind,
        prijs_leads: a.prijsLeads, leads_per_lot: a.leadsPerLot, bulk_per_lot: a.bulkPerLot,
        aangemaakt_door: admin.id, aangemaakt_door_naam: wie,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await logAudit({
        adminId: admin.id, adminName: wie, action: 'actie_aangemaakt', entityType: 'actie', entityId: a.code,
        details: { naam: a.naam, ...actieLabels(a), prijs_leads: a.prijsLeads, leads_per_lot: a.leadsPerLot, bulk_per_lot: a.bulkPerLot },
      });
      return NextResponse.json({ ok: true, code: a.code });
    } catch (err) {
      return foutAntwoord(err, 'nieuw');
    }
  }

  /* ── Trekking ── */
  if (body?.actie !== 'trek') return NextResponse.json({ error: 'Onbekende actie' }, { status: 400 });
  try {
    const actie = (await laadActies(supabase)).find(a => a.code === body.code);
    if (!actie) return NextResponse.json({ error: 'Actie niet gevonden' }, { status: 404 });
    if (actieFase(actie) !== 'afgelopen') {
      return NextResponse.json({ error: `De trekking kan pas na ${actieLabels(actie).eindLabel}.` }, { status: 400 });
    }
    const { data: al } = await supabase.from('actie_trekkingen').select('id').eq('actie', actie.code).maybeSingle();
    if (al) return NextResponse.json({ error: 'De winnaar is al getrokken.' }, { status: 409 });

    const deelnemers = (await laadDeelnemers(supabase, actie)).filter(d => d.totaal > 0);
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
      actie: actie.code,
      winnaar_customer_id: gekozen.customer_id,
      lotnummer,
      totaal_loten: totaal,
      deelnemers: lijst,
      getrokken_door: admin.id,
      getrokken_door_naam: wie,
    });
    /* De unieke sleutel op actie houdt een gelijktijdige tweede trekking tegen. */
    if (error) {
      const dubbel = error.code === '23505';
      return NextResponse.json({ error: dubbel ? 'De winnaar is al getrokken.' : error.message }, { status: dubbel ? 409 : 500 });
    }

    const winnaar = deelnemers.find(d => d.customer_id === gekozen.customer_id);
    await logAudit({
      adminId: admin.id,
      adminName: wie,
      action: 'actie_trekking',
      entityType: 'customer',
      entityId: gekozen.customer_id,
      details: { actie: actie.code, naam: actie.naam, winnaar: winnaar?.klant, loten_winnaar: winnaar?.totaal, totaal_loten: totaal, lotnummer, deelnemers: deelnemers.length },
    });

    return NextResponse.json({ ok: true, winnaar: winnaar?.klant, lotnummer, totaal });
  } catch (err) {
    return foutAntwoord(err, 'trek');
  }
}

export async function DELETE(request: NextRequest) {
  const { admin, fout } = await toegang(request);
  if (fout || !admin) return fout ?? unauthorized();
  const supabase = createServerClient();
  try {
    const actie = (await laadActies(supabase)).find(a => a.code === request.nextUrl.searchParams.get('actie'));
    if (!actie) return NextResponse.json({ error: 'Actie niet gevonden' }, { status: 404 });
    if (actieFase(actie) !== 'voor') return NextResponse.json({ error: 'Een actie die al begonnen is, kan niet meer weg.' }, { status: 400 });
    const { count } = await supabase.from('actie_loten').select('id', { count: 'exact', head: true }).eq('actie', actie.code);
    if ((count ?? 0) > 0) return NextResponse.json({ error: 'Deze actie heeft al loten.' }, { status: 400 });
    const { error } = await supabase.from('acties').delete().eq('code', actie.code);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logAudit({
      adminId: admin.id, adminName: admin.name ?? admin.email, action: 'actie_verwijderd', entityType: 'actie', entityId: actie.code,
      details: { naam: actie.naam, ...actieLabels(actie) },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return foutAntwoord(err, 'DELETE');
  }
}
