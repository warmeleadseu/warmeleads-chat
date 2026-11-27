import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { nogNietAanwezig } from '@/lib/terugbelMeldingen';
import { laadAfzender, renderMailing, type GeplandeMailing } from '@/lib/geplandeMailingen';

export const dynamic = 'force-dynamic';

/**
 * Geplande mailingen voor het admin-paneel (Mails): de open mailingen met een
 * voorbeeld zoals de eerste ontvanger hem krijgt, en de laatste verstuurde.
 */
export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  const supabase = createServerClient();
  const [{ data: open, error }, { data: klaar }] = await Promise.all([
    supabase.from('geplande_mailingen').select('*').in('status', ['concept', 'goedgekeurd', 'bezig']).order('verstuur_op'),
    supabase.from('geplande_mailingen').select('*').in('status', ['verstuurd', 'geannuleerd', 'mislukt']).order('updated_at', { ascending: false }).limit(5),
  ]);
  if (nogNietAanwezig(error)) return NextResponse.json({ aanwezig: false, mailingen: [] });
  if (error) return NextResponse.json({ error: 'Geplande mailingen ophalen mislukt' }, { status: 500 });

  const ids = [...new Set([...(open ?? []), ...(klaar ?? [])].flatMap(m => [m.afzender_admin_id, m.goedgekeurd_door]).filter(Boolean))] as string[];
  const { data: admins } = ids.length ? await supabase.from('admin_users').select('id, name').in('id', ids) : { data: [] };
  const naam = new Map((admins ?? []).map(a => [a.id as string, a.name as string]));

  const mailingen = [];
  for (const m of [...(open ?? []), ...(klaar ?? [])] as GeplandeMailing[]) {
    let voorbeeld: { onderwerp: string; html: string; aan: string } | null = null;
    let fout: string | null = null;
    let ontvangers: { id: string; naam: string; email: string | null }[] = [];
    let prospects: { id: string; naam: string; email: string | null }[] = [];
    if (m.status === 'concept' || m.status === 'goedgekeurd') {
      try {
        const afzender = await laadAfzender(supabase, m.afzender_admin_id ?? admin.id);
        const { gerenderd } = await renderMailing(supabase, m, afzender, true);
        if (gerenderd[0]) voorbeeld = { onderwerp: gerenderd[0].subject, html: gerenderd[0].html, aan: gerenderd[0].recipient.recipient.name };
      } catch (e) {
        fout = e instanceof Error ? e.message : 'Voorbeeld maken mislukt';
      }
      const { data: klanten } = await supabase.from('customers').select('id, name, email, is_active').in('id', m.ontvangers.slice(0, MAX_LIJST));
      ontvangers = (klanten ?? []).filter(k => k.is_active).map(k => ({ id: k.id as string, naam: (k.name as string) ?? '', email: (k.email as string) ?? null }))
        .sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
      const pIds = (m.prospect_ontvangers ?? []).slice(0, MAX_LIJST);
      if (pIds.length) {
        const { data: ps } = await supabase.from('prospects').select('id, company_name, contact_person, email').in('id', pIds);
        prospects = (ps ?? []).map(p => ({ id: p.id as string, naam: (p.company_name as string) || (p.contact_person as string) || '', email: (p.email as string) ?? null }))
          .sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
      }
    }
    mailingen.push({
      ...m,
      afzender_naam: m.afzender_admin_id ? naam.get(m.afzender_admin_id) ?? null : null,
      goedgekeurd_door_naam: m.goedgekeurd_door ? naam.get(m.goedgekeurd_door) ?? null : null,
      aantal_ontvangers: m.ontvangers.length + (m.prospect_ontvangers?.length ?? 0),
      prospect_ontvangers: m.prospect_ontvangers ?? [],
      prospects_mogelijk: 'prospect_ontvangers' in m,
      actieve_prospects: prospects,
      actieve_ontvangers: ontvangers,
      voorbeeld,
      voorbeeld_fout: fout,
    });
  }
  return NextResponse.json({ aanwezig: true, mailingen, mag_goedkeuren: admin.role === 'superadmin' });
}

const MAX_LIJST = 1500;
