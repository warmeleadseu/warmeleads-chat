import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { applyAccountManagerScope, applyLeadFilters, readLeadFilterParams } from '@/lib/leadFilters';
import {
  filterRijenOpProvincieMarge,
  resolveProvincieMarge,
  scanRijenGepagineerd,
} from '@/lib/provincieMarge';
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

  /* Zelfde afbakening als de lijst: telt de marge daar mee, dan hier ook.
     Anders klopt het aantal boven de lijst niet met wat je exporteert. */
  const provincieMarge = resolveProvincieMarge(filters);

  if (plaatsRadius || provincieMarge) {
    let query = supabase.from('leads').select('id, lat, lng, provincie');
    query = applyLeadFilters(query, filters, {
      excludePartnerBranchesWhenNoBranchFilter: true,
      plaatsRadius,
      provincieMargeBox: provincieMarge?.box ?? null,
    });
    if (admin.role === 'accountmanager') {
      const scoped = await applyAccountManagerScope(supabase, query, admin.id);
      if (!scoped.allowed) return NextResponse.json({ count: 0 });
      query = scoped.query;
    }

    /* Vaste sortering: zonder ORDER BY garandeert Postgres geen stabiele
       volgorde tussen pagina's, waardoor een gepagineerde scan rijen kan
       overslaan of dubbel tellen. */
    query = query.order('id', { ascending: true });

    type ScanRij = { id: string; lat: number | null; lng: number | null; provincie?: string | null };
    const haalPagina = async (from: number, to: number) => {
      const { data, error } = await query.range(from, to);
      return { data: (data || null) as ScanRij[] | null, error };
    };
    const scan = plaatsRadius
      ? await filterQueryRowsByPlaatsRadius(haalPagina, plaatsRadius)
      : await scanRijenGepagineerd(haalPagina);
    if (scan.error) {
      console.error('Leads count scan error:', scan.error);
      return NextResponse.json({ error: 'Aantal ophalen mislukt' }, { status: 500 });
    }
    const rows = provincieMarge
      ? filterRijenOpProvincieMarge(scan.rows as ScanRij[], provincieMarge)
      : (scan.rows as ScanRij[]);
    const binnen = provincieMarge
      ? rows.filter(r => provincieMarge.provincies.includes(String(r.provincie ?? '').trim())).length
      : rows.length;
    return NextResponse.json({
      count: rows.length,
      plaats_radius_label: plaatsRadius?.label ?? null,
      plaats_radius_km: plaatsRadius?.radiusKm ?? null,
      provincie_marge_km: provincieMarge?.margeKm ?? null,
      in_provincie: binnen,
      uit_marge: rows.length - binnen,
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
