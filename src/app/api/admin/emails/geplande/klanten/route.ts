import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

const LOPEND = ['active', 'paused', 'pending_payment'];

/**
 * Alle actieve klanten met een e-mailadres, om ontvangers van een geplande
 * mailing aan of uit te vinken. Met de branches waarin ze ooit een betaalde
 * batch verse leads kochten, zodat je snel op branche kunt filteren, en de
 * branches waarin nu een batch loopt.
 */
export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  const supabase = createServerClient();

  const klanten: { id: string; name: string | null; contact_person: string | null; email: string | null }[] = [];
  for (let p = 0; p < 10; p++) {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, contact_person, email')
      .eq('is_active', true)
      .not('intern', 'is', true)
      .order('name')
      .range(p * 1000, p * 1000 + 999);
    if (error) return NextResponse.json({ error: 'Klanten ophalen mislukt' }, { status: 500 });
    klanten.push(...((data ?? []) as typeof klanten));
    if (!data || data.length < 1000) break;
  }

  const branches = new Map<string, Set<string>>();
  for (let p = 0; p < 20; p++) {
    const { data } = await supabase
      .from('customer_batches')
      .select('customer_id, branch')
      .eq('is_paid', true)
      .eq('batch_kind', 'leads')
      .range(p * 1000, p * 1000 + 999);
    for (const b of data ?? []) {
      if (!b.branch) continue;
      const s = branches.get(b.customer_id as string) ?? new Set<string>();
      s.add(b.branch as string);
      branches.set(b.customer_id as string, s);
    }
    if (!data || data.length < 1000) break;
  }

  /* Lopende batches (actief, gepauzeerd of nog te betalen), om klanten die al
     afnemen met één klik uit een actiemail te halen. */
  const lopend = new Map<string, Set<string>>();
  {
    const { data } = await supabase
      .from('customer_batches')
      .select('customer_id, branch')
      .in('status', LOPEND)
      .limit(5000);
    for (const b of data ?? []) {
      const set = lopend.get(b.customer_id as string) ?? new Set<string>();
      set.add((b.branch as string) || 'onbekend');
      lopend.set(b.customer_id as string, set);
    }
  }

  /* Afgemeld voor marketingmail: wordt bij versturen altijd overgeslagen. */
  const { data: optouts } = await supabase.from('email_optouts').select('email, scope').limit(5000);
  const afgemeld = new Set((optouts ?? []).filter(o => o.scope !== 'transactional').map(o => String(o.email).toLowerCase()));

  return NextResponse.json({
    klanten: klanten
      .filter(k => (k.email ?? '').trim())
      .map(k => ({
        id: k.id,
        naam: k.name || '',
        contact: k.contact_person && k.contact_person !== k.name ? k.contact_person : null,
        email: k.email,
        branches: [...(branches.get(k.id) ?? [])].sort(),
        lopend: [...(lopend.get(k.id) ?? [])].sort(),
        afgemeld: afgemeld.has(String(k.email).toLowerCase()),
      })),
  });
}
