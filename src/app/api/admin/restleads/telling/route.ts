import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { MAX_UITDELINGEN, RESTLEAD_REDEN } from '@/lib/restleads';

/**
 * Hoeveel kansrijke restleads liggen er? Alleen het getal voor de menubadge.
 *
 * Bewust zonder de kandidaatberekening: die vraagt de doelgebieden en batches
 * van alle klanten op en kost 2,4 seconden. Een badge die bij elke paginaklik
 * wordt opgehaald mag dat niet kosten, dus dit telt alleen de leads van de
 * laatste zeven dagen met minder dan twee uitdelingen die hier nog niet zijn
 * afgehandeld. Dat is een bovengrens op wat je in het scherm ziet.
 */

export const dynamic = 'force-dynamic';

/**
 * Alles ophalen in pagina's van duizend.
 *
 * PostgREST geeft nooit meer dan duizend rijen terug, ook niet als je er meer
 * vraagt. Zeven dagen leads leveren makkelijk meer toewijzingen dan dat op, en
 * wie de rest mist telt leads als "nog niet uitgedeeld" die dat allang zijn.
 */
async function alleRijen<T>(
  bouw: (van: number, tot: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const uit: T[] = [];
  for (let pagina = 0; pagina < 20; pagina++) {
    const { data, error } = await bouw(pagina * 1000, pagina * 1000 + 999);
    if (error || !data?.length) break;
    uit.push(...data);
    if (data.length < 1000) break;
  }
  return uit;
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  if (admin.role === 'accountmanager') return NextResponse.json({ aantal: 0 });

  const supabase = createServerClient();
  const sinds = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const { data: leads, error } = await supabase
    .from('leads')
    .select('id')
    .gte('created_at', sinds)
    .neq('bron', 'excel_import')
    .neq('bron', 'demo')
    .limit(1000);

  if (error || !leads?.length) return NextResponse.json({ aantal: 0 });

  const ids = leads.map(l => l.id);

  const [toew, wachtrij] = await Promise.all([
    alleRijen<{ lead_id: string; customer_id: string; source: string | null }>((van, tot) =>
      supabase.from('lead_assignments').select('lead_id, customer_id, source').in('lead_id', ids).range(van, tot)),
    alleRijen<{ lead_id: string; status: string; reden: string | null }>((van, tot) =>
      supabase.from('geplande_leadleveringen').select('lead_id, status, reden').in('lead_id', ids).range(van, tot)),
  ]);

  const per = new Map<string, Set<string>>();
  for (const a of toew || []) {
    if (a.source === 'mirror') continue;
    const s = per.get(a.lead_id) ?? new Set<string>();
    s.add(a.customer_id);
    per.set(a.lead_id, s);
  }

  const afgehandeld = new Set(
    (wachtrij || [])
      .filter(r => r.status === 'gepland' || (r.status === 'geleverd' && String(r.reden || '').startsWith(RESTLEAD_REDEN)))
      .map(r => r.lead_id),
  );

  const aantal = ids.filter(
    id => (per.get(id)?.size ?? 0) < MAX_UITDELINGEN && !afgehandeld.has(id),
  ).length;

  return NextResponse.json({ aantal });
}
