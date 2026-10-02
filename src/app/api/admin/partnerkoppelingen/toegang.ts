import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { partnerOpId } from '@/lib/integrations/partners/registry';
import type { Actor } from '@/lib/integrations/partners/service';
import type { PartnerDefinitie } from '@/lib/integrations/partners/types';

/**
 * Gedeelde toegangscontrole voor de admin-routes van partnerkoppelingen.
 * Accountmanagers niet: dit bepaalt waar persoonsgegevens van leads heen gaan.
 */
export async function adminPartnerContext(
  request: NextRequest,
  params: Promise<{ customerId: string; partner: string }>,
): Promise<
  | { fout: NextResponse }
  | { actor: Actor; partner: PartnerDefinitie; customerId: string; branches: string[] }
> {
  const admin = await verifyAdmin(request);
  if (!admin) return { fout: unauthorized() };
  if (admin.role === 'accountmanager') {
    return { fout: NextResponse.json({ error: 'Alleen superadmin/admin beheert partnerkoppelingen' }, { status: 403 }) };
  }
  const p = await params;
  const partner = partnerOpId(p.partner);
  if (!partner) return { fout: NextResponse.json({ error: 'Onbekende partner' }, { status: 404 }) };

  const { data: klant } = await createServerClient()
    .from('customers')
    .select('id, branches')
    .eq('id', p.customerId)
    .maybeSingle();
  if (!klant) return { fout: NextResponse.json({ error: 'Klant niet gevonden' }, { status: 404 }) };

  return {
    actor: { soort: 'admin', id: admin.id, naam: admin.name ?? admin.email ?? null },
    partner,
    customerId: klant.id as string,
    branches: (klant.branches as string[] | null) ?? [],
  };
}
