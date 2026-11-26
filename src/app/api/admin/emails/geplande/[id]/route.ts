import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { logAudit } from '@/lib/audit';
import { laadAfzender, magActie, stuurTest, type Actie, type GeplandeMailing } from '@/lib/geplandeMailingen';

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
