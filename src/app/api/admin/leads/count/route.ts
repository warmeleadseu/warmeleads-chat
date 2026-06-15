import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { applyAccountManagerScope, applyLeadFilters, readLeadFilterParams } from '@/lib/leadFilters';

/**
 * Lightweight count-endpoint voor de bulk-export-modal: levert alleen het
 * totaal aantal leads dat aan dezelfde filterparameters voldoet als
 * `GET /api/admin/leads`. Wordt gebruikt om de "X leads exporteren"-knop
 * en het tellertje in de modal-header live bij te werken zonder de volle
 * leads-payload op te halen.
 *
 * Identieke semantiek als list-endpoint: partner-prospect-branches worden
 * uitgesloten als er geen expliciet branche-filter is.
 */
export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const filters = readLeadFilterParams(request.nextUrl.searchParams);

  let query = supabase.from('leads').select('id', { count: 'exact', head: true });
  query = applyLeadFilters(query, filters, { excludePartnerBranchesWhenNoBranchFilter: true });

  if (admin.role === 'accountmanager') {
    const scoped = await applyAccountManagerScope(supabase, query, admin.id);
    if (!scoped.allowed) return NextResponse.json({ count: 0 });
    query = scoped.query;
  }

  const { count, error } = await query;
  if (error) {
    console.error('Leads count error:', error);
    return NextResponse.json({ error: 'Aantal ophalen mislukt' }, { status: 500 });
  }

  return NextResponse.json({ count: count ?? 0 });
}
