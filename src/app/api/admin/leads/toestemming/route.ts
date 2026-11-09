import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized, forbidden } from '@/lib/adminAuth';
import { logAudit } from '@/lib/audit';
import { dispatchEmail } from '@/lib/email';
import { bouwIntrekkingMail, magHerstellen, magIntrekken, mailOntvangers, type Ontvanger } from '@/lib/toestemming';

/**
 * POST /api/admin/leads/toestemming
 *
 * { lead_id, actie: 'intrekken', reden, klanten_mailen? }  admin en superadmin
 * { lead_id, actie: 'herstellen', reden }                    alleen superadmin
 *
 * Intrekken zet de lead voorgoed op "niet meer delen": de database weigert
 * daarna elke nieuwe toewijzing (migratie 196). Geplande leveringen vervallen
 * en klanten die de lead al hadden krijgen standaard een mail om de aanvrager
 * niet meer te benaderen en de gegevens te verwijderen.
 */
export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ongeldige JSON' }, { status: 400 });
  }
  const leadId = typeof body.lead_id === 'string' ? body.lead_id.trim() : '';
  const actie = body.actie;
  const reden = typeof body.reden === 'string' ? body.reden.trim().slice(0, 500) : '';
  if (!leadId) return NextResponse.json({ error: 'lead_id is verplicht' }, { status: 400 });
  if (actie !== 'intrekken' && actie !== 'herstellen') return NextResponse.json({ error: 'Onbekende actie' }, { status: 400 });
  if (!reden) return NextResponse.json({ error: 'Geef een reden of bron op, bijvoorbeeld "mail van 9 november"' }, { status: 400 });
  if (actie === 'intrekken' && !magIntrekken(admin.role)) return forbidden();
  if (actie === 'herstellen' && !magHerstellen(admin.role)) return forbidden();

  const supabase = createServerClient();
  const { data: lead, error: leadErr } = await supabase
    .from('leads')
    .select('id, naam_klant, telefoonnummer, email, plaatsnaam, created_at, toestemming_ingetrokken_op')
    .eq('id', leadId)
    .maybeSingle();
  if (leadErr) return NextResponse.json({ error: leadErr.message }, { status: 500 });
  if (!lead) return NextResponse.json({ error: 'Lead niet gevonden' }, { status: 404 });

  if (actie === 'herstellen') {
    if (!lead.toestemming_ingetrokken_op) return NextResponse.json({ error: 'Deze lead heeft geen ingetrokken toestemming' }, { status: 400 });
    const { error } = await supabase
      .from('leads')
      .update({ toestemming_ingetrokken_op: null, toestemming_ingetrokken_door: null, toestemming_ingetrokken_reden: null })
      .eq('id', leadId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await logAudit({
      adminId: admin.id, adminName: admin.name, action: 'toestemming_hersteld', entityType: 'lead', entityId: leadId,
      details: { reden, eerder_ingetrokken_op: lead.toestemming_ingetrokken_op },
    });
    return NextResponse.json({ ok: true });
  }

  if (lead.toestemming_ingetrokken_op) return NextResponse.json({ error: 'De toestemming van deze lead is al ingetrokken' }, { status: 400 });

  const nu = new Date().toISOString();
  const { error: updErr } = await supabase
    .from('leads')
    .update({ toestemming_ingetrokken_op: nu, toestemming_ingetrokken_door: admin.name, toestemming_ingetrokken_reden: reden })
    .eq('id', leadId);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  /* Leveringen die nog gepland staan (na de 12 uur), gaan niet meer door. */
  const { data: vervallen } = await supabase
    .from('geplande_leadleveringen')
    .update({ status: 'overgeslagen', laatste_reden: 'toestemming ingetrokken' })
    .eq('lead_id', leadId)
    .eq('status', 'gepland')
    .select('id');

  /* Wie de lead al heeft: toewijzingen in het portaal en exports naar een klant. */
  const kandidaten: Ontvanger[] = [];
  const { data: toewijzingen } = await supabase
    .from('lead_assignments')
    .select('customer_id, source, customers(name, email, intern)')
    .eq('lead_id', leadId);
  for (const t of toewijzingen ?? []) {
    if (['mirror', 'demo'].includes(String(t.source ?? ''))) continue;
    const c = t.customers as unknown as { name: string; email: string | null; intern: boolean | null } | null;
    if (c) kandidaten.push({ customer_id: t.customer_id, naam: c.name, email: c.email, intern: !!c.intern });
  }
  const { data: exports } = await supabase
    .from('lead_exports')
    .select('customer_id')
    .contains('lead_ids', [leadId])
    .not('customer_id', 'is', null);
  const exportKlanten = [...new Set((exports ?? []).map(e => e.customer_id as string))].filter(id => !kandidaten.some(k => k.customer_id === id));
  if (exportKlanten.length > 0) {
    const { data: klanten } = await supabase.from('customers').select('id, name, email, intern').in('id', exportKlanten);
    for (const c of klanten ?? []) kandidaten.push({ customer_id: c.id, naam: c.name, email: c.email, intern: !!c.intern });
  }

  const ontvangers = mailOntvangers(kandidaten);
  const gemaild: string[] = [];
  const mislukt: string[] = [];
  if (body.klanten_mailen !== false) {
    for (const o of ontvangers) {
      const { onderwerp, html } = bouwIntrekkingMail(o.naam, lead);
      const r = await dispatchEmail(o.email as string, onderwerp, html, {
        type: 'toestemming_ingetrokken',
        toName: o.naam,
        customerId: o.customer_id,
        metadata: { lead_id: leadId },
      });
      (r.ok ? gemaild : mislukt).push(o.naam);
    }
  }

  await logAudit({
    adminId: admin.id, adminName: admin.name, action: 'toestemming_ingetrokken', entityType: 'lead', entityId: leadId,
    details: { reden, klanten: ontvangers.map(o => o.naam), gemaild, mislukt, geplande_leveringen_vervallen: vervallen?.length ?? 0 },
  });

  return NextResponse.json({ ok: true, klanten: ontvangers.map(o => o.naam), gemaild, mislukt, geplande_leveringen_vervallen: vervallen?.length ?? 0 });
}
