import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { nogNietAanwezig } from '@/lib/terugbelMeldingen';
import { MAX_SEINTJE_MIN, POPUP_TOT_MIN, leesSeintje, type ProspectTerugbelmoment } from '@/lib/prospectTerugbellen';

/**
 * Terugbelafspraken met prospects van de ingelogde admin rond nu (migratie 203):
 * belttaken met een seintje die binnenkort of net aan de beurt zijn. Het
 * admin-paneel haalt dit elke minuut op voor de pop-up.
 */
export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  const nu = Date.now();
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('prospect_tasks')
    .select('id, prospect_id, title, description, due_at, seintje_min, prospect:prospects!inner(company_name, contact_person, phone, city)')
    .eq('assigned_to_admin_id', admin.id)
    .is('completed_at', null)
    .not('seintje_min', 'is', null)
    .gte('due_at', new Date(nu - POPUP_TOT_MIN * 60_000).toISOString())
    .lte('due_at', new Date(nu + (MAX_SEINTJE_MIN + 60) * 60_000).toISOString())
    .order('due_at')
    .limit(50);
  /* Migratie 203 nog niet toegepast: de functie staat uit. */
  if (nogNietAanwezig(error)) return NextResponse.json({ aan: false, nu: new Date(nu).toISOString(), momenten: [] });
  if (error) return NextResponse.json({ error: 'Terugbelafspraken ophalen mislukt' }, { status: 500 });

  type Rij = { id: string; prospect_id: string; title: string; description: string | null; due_at: string; seintje_min: number;
    prospect: { company_name: string; contact_person: string | null; phone: string | null; city: string | null } | { company_name: string; contact_person: string | null; phone: string | null; city: string | null }[] };
  const momenten: ProspectTerugbelmoment[] = [];
  for (const r of (data ?? []) as unknown as Rij[]) {
    const p = Array.isArray(r.prospect) ? r.prospect[0] : r.prospect;
    const seintje = leesSeintje(r.seintje_min);
    if (!p || !seintje) continue;
    momenten.push({
      id: r.id, prospect_id: r.prospect_id, title: r.title, description: r.description, due_at: r.due_at, seintje_min: seintje,
      bedrijf: p.company_name, contact: p.contact_person, telefoon: p.phone, plaats: p.city,
    });
  }
  return NextResponse.json({ aan: true, nu: new Date(nu).toISOString(), momenten });
}
