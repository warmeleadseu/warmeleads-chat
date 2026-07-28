import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { applyAccountManagerScope, applyLeadFilters, readLeadFilterParams } from '@/lib/leadFilters';
import {
  filterQueryRowsByPlaatsRadius,
  resolvePlaatsRadiusOrigin,
} from '@/lib/leadPlaatsRadius';

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

  let plaatsRadius = null;
  try {
    plaatsRadius = await resolvePlaatsRadiusOrigin(filters);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Plaats niet gevonden' },
      { status: 400 },
    );
  }

  if (plaatsRadius) {
    let query = supabase.from('leads').select('id, lat, lng');
    query = applyLeadFilters(query, filters, {
      excludePartnerBranchesWhenNoBranchFilter: true,
      plaatsRadius,
    });
    if (admin.role === 'accountmanager') {
      const scoped = await applyAccountManagerScope(supabase, query, admin.id);
      if (!scoped.allowed) return NextResponse.json({ count: 0 });
      query = scoped.query;
    }

    const { rows, error: scanError } = await filterQueryRowsByPlaatsRadius(
      async (from, to) => {
        const { data, error } = await query.range(from, to);
        return { data, error };
      },
      plaatsRadius,
    );
    if (scanError) {
      console.error('Leads count radius error:', scanError);
      return NextResponse.json({ error: 'Aantal ophalen mislukt' }, { status: 500 });
    }
    return NextResponse.json({
      count: rows.length,
      plaats_radius_label: plaatsRadius.label,
      plaats_radius_km: plaatsRadius.radiusKm,
    });
  }

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
