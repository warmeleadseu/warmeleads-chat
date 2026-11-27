import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { logAudit } from '@/lib/audit';
import { controleerBewerking, laadAfzender, magActie, stuurTest, type Actie, type Bewerking, type GeplandeMailing } from '@/lib/geplandeMailingen';

/**
 * Acties op een geplande mailing: testmail naar jezelf, goedkeuren,
 * annuleren of terug naar concept. Goedkeuren mag alleen een superadmin;
 * wie goedkeurt is de afzender als er geen andere is gekozen.
 */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  const { actie } = (await request.json().catch(() => ({}))) as { actie?: string };
  const supabase = createServerClient();
  const { data } = await supabase.from('geplande_mailingen').select('*').eq('id', id).maybeSingle();
  const m = data as GeplandeMailing | null;
  if (!m) return NextResponse.json({ error: 'Mailing niet gevonden' }, { status: 404 });

  if (actie === 'test') {
    try {
      const afzender = await laadAfzender(supabase, m.afzender_admin_id ?? admin.id);
      const fout = await stuurTest(supabase, m, afzender, { email: admin.email, naam: admin.name });
      if (fout) return NextResponse.json({ error: fout }, { status: 500 });
      return NextResponse.json({ success: true, naar: admin.email });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Test versturen mislukt' }, { status: 500 });
    }
  }

  if (actie !== 'goedkeuren' && actie !== 'annuleren' && actie !== 'naar_concept') {
    return NextResponse.json({ error: 'Onbekende actie' }, { status: 400 });
  }
  if (admin.role !== 'superadmin') return NextResponse.json({ error: 'Alleen een superadmin kan mailingen goedkeuren of annuleren' }, { status: 403 });
  const nee = magActie(m.status, actie as Actie, m.verstuur_op);
  if (nee) return NextResponse.json({ error: nee }, { status: 400 });

  const nu = new Date().toISOString();
  let wijziging: Record<string, unknown>;
  if (actie === 'goedkeuren') {
    const afzenderId = m.afzender_admin_id ?? admin.id;
    try {
      await laadAfzender(supabase, afzenderId);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Afzender ongeldig' }, { status: 400 });
    }
    wijziging = { status: 'goedgekeurd', goedgekeurd_door: admin.id, goedgekeurd_op: nu, afzender_admin_id: afzenderId };
  } else if (actie === 'annuleren') {
    wijziging = { status: 'geannuleerd' };
  } else {
    wijziging = { status: 'concept', goedgekeurd_door: null, goedgekeurd_op: null };
  }
  const { data: bijgewerkt, error } = await supabase
    .from('geplande_mailingen')
    .update({ ...wijziging, updated_at: nu })
    .eq('id', id)
    .eq('status', m.status)
    .select('id');
  if (error || !bijgewerkt?.length) return NextResponse.json({ error: 'Opslaan mislukt, ververs de pagina' }, { status: 409 });
  await logAudit({
    adminId: admin.id, adminName: admin.name, action: `email.geplande_mailing_${actie}`,
    entityType: 'geplande_mailing', entityId: id, details: { naam: m.naam, ontvangers: m.ontvangers.length, verstuur_op: m.verstuur_op },
  }).catch(() => {});
  return NextResponse.json({ success: true });
}

/**
 * Bewerken vanuit het admin-paneel: tekst, ontvangers, verzendmoment of
 * naam. Alleen een concept; goedkeuren blijft daarna een aparte stap.
 */
export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  const invoer = (await request.json().catch(() => ({}))) as Bewerking;
  const supabase = createServerClient();
  const { data } = await supabase.from('geplande_mailingen').select('*').eq('id', id).maybeSingle();
  const m = data as GeplandeMailing | null;
  if (!m) return NextResponse.json({ error: 'Mailing niet gevonden' }, { status: 404 });

  const uit = controleerBewerking(m, invoer);
  if ('fout' in uit) return NextResponse.json({ error: uit.fout }, { status: 400 });

  if (Array.isArray(uit.wijziging.ontvangers)) {
    const ids = uit.wijziging.ontvangers as string[];
    const { data: bestaand } = await supabase.from('customers').select('id').in('id', ids);
    if ((bestaand ?? []).length !== ids.length) return NextResponse.json({ error: 'Een of meer ontvangers bestaan niet (meer)' }, { status: 400 });
  }
  if (Array.isArray(uit.wijziging.prospect_ontvangers)) {
    if (!('prospect_ontvangers' in m)) return NextResponse.json({ error: 'Prospects als ontvanger zijn nog niet actief (migratie 205).' }, { status: 400 });
    const ids = uit.wijziging.prospect_ontvangers as string[];
    for (let i = 0; i < ids.length; i += 500) {
      const deel = ids.slice(i, i + 500);
      const { data: bestaand } = await supabase.from('prospects').select('id').in('id', deel);
      if ((bestaand ?? []).length !== deel.length) return NextResponse.json({ error: 'Een of meer prospects bestaan niet (meer)' }, { status: 400 });
    }
  }

  const { data: bijgewerkt, error } = await supabase
    .from('geplande_mailingen')
    .update({ ...uit.wijziging, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'concept')
    .select('id');
  if (error || !bijgewerkt?.length) return NextResponse.json({ error: 'Opslaan mislukt, ververs de pagina' }, { status: 409 });
  await logAudit({
    adminId: admin.id, adminName: admin.name, action: 'email.geplande_mailing_bewerkt',
    entityType: 'geplande_mailing', entityId: id,
    details: {
      naam: m.naam,
      velden: Object.keys(uit.wijziging),
      ontvangers_voor: m.ontvangers.length,
      ontvangers_na: Array.isArray(uit.wijziging.ontvangers) ? (uit.wijziging.ontvangers as string[]).length : m.ontvangers.length,
      prospects_voor: m.prospect_ontvangers?.length ?? 0,
      prospects_na: Array.isArray(uit.wijziging.prospect_ontvangers) ? (uit.wijziging.prospect_ontvangers as string[]).length : m.prospect_ontvangers?.length ?? 0,
    },
  }).catch(() => {});
  return NextResponse.json({ success: true });
}
