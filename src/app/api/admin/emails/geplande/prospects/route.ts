import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

/**
 * Alle prospects met een e-mailadres, om als ontvanger van een geplande
 * mailing aan te vinken (tabblad Prospects). Met branches en status, zodat je
 * op branche filtert en gewonnen, verloren en niet-relevante prospects
 * makkelijk weglaat.
 */
export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  const supabase = createServerClient();

  type Rij = { id: string; company_name: string | null; contact_person: string | null; email: string | null; branches: string[] | null; status: string | null; converted_to_customer_id: string | null };
  const rijen: Rij[] = [];
  for (let p = 0; p < 20; p++) {
    const { data, error } = await supabase
      .from('prospects')
      .select('id, company_name, contact_person, email, branches, status, converted_to_customer_id')
      .not('email', 'is', null)
      .order('company_name')
      .range(p * 1000, p * 1000 + 999);
    if (error) return NextResponse.json({ error: 'Prospects ophalen mislukt' }, { status: 500 });
    rijen.push(...((data ?? []) as Rij[]));
    if (!data || data.length < 1000) break;
  }

  const { data: optouts } = await supabase.from('email_optouts').select('email, scope').limit(5000);
  const afgemeld = new Set((optouts ?? []).filter(o => o.scope !== 'transactional').map(o => String(o.email).toLowerCase()));

  return NextResponse.json({
    prospects: rijen
      .filter(r => (r.email ?? '').includes('@'))
      .map(r => ({
        id: r.id,
        naam: r.company_name || r.contact_person || r.email || '',
        contact: r.company_name && r.contact_person ? r.contact_person : null,
        email: r.email,
        branches: (r.branches ?? []).filter(Boolean).sort(),
        status: r.status ?? 'nieuw',
        klant_geworden: !!r.converted_to_customer_id,
        afgemeld: afgemeld.has(String(r.email).toLowerCase()),
      })),
  });
}
