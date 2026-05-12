import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { resolveAddress, isValidPlace } from '@/lib/pdok';
import { distributeLeads } from '@/lib/distribution';

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();

  const { data: leads, error } = await supabase
    .from('leads')
    .select('id, postcode, huisnummer, plaatsnaam, provincie, lat, lng, land, telefoonnummer, email')
    .not('postcode', 'is', null)
    .not('postcode', 'eq', '')
    .not('huisnummer', 'is', null)
    .not('huisnummer', 'eq', '');

  if (error) {
    return NextResponse.json({ error: 'Kon leads niet ophalen' }, { status: 500 });
  }

  const candidates = (leads || []).filter(
    l => !isValidPlace(l.plaatsnaam) || !isValidPlace(l.provincie) || !l.lat || !l.lng
  );

  if (candidates.length === 0) {
    return NextResponse.json({ enriched: 0, total: 0, distributed: 0 });
  }

  const CONCURRENCY = 5;
  let enriched = 0;
  const newlyEnrichedLeads: { id: string; branch?: string; lat: number; lng: number }[] = [];

  for (let i = 0; i < candidates.length; i += CONCURRENCY) {
    const batch = candidates.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (lead) => {
        const result = await resolveAddress(
          lead.postcode,
          lead.huisnummer,
          lead.land as 'NL' | 'BE' | null,
          lead.telefoonnummer,
          lead.email ?? undefined
        );
        if (!result) return null;

        const updates: Record<string, string | number> = {};
        if (!isValidPlace(lead.plaatsnaam) && result.plaatsnaam) updates.plaatsnaam = result.plaatsnaam;
        if (!isValidPlace(lead.provincie) && result.provincie) updates.provincie = result.provincie;
        const hadNoCoords = !lead.lat || !lead.lng;
        if (hadNoCoords && result.lat && result.lng) {
          updates.lat = result.lat;
          updates.lng = result.lng;
        }
        if (result.land) updates.land = result.land;

        if (Object.keys(updates).length === 0) return null;
        return { id: lead.id, updates, gotCoords: hadNoCoords && result.lat != null && result.lng != null, lat: result.lat, lng: result.lng };
      })
    );

    for (const r of results) {
      if (!r) continue;
      const { error: updateErr } = await supabase
        .from('leads')
        .update(r.updates)
        .eq('id', r.id);
      if (!updateErr) {
        enriched++;
        if (r.gotCoords && r.lat && r.lng) {
          newlyEnrichedLeads.push({ id: r.id, lat: r.lat, lng: r.lng });
        }
      }
    }
  }

  // Auto-distribute newly enriched leads that now have coordinates
  let distributed = 0;
  if (newlyEnrichedLeads.length > 0) {
    const leadIds = newlyEnrichedLeads.map(l => l.id);
    const { data: fullLeads } = await supabase
      .from('leads')
      .select('id, branch, lat, lng')
      .in('id', leadIds);

    if (fullLeads && fullLeads.length > 0) {
      const withCoords = fullLeads.filter(l => l.lat && l.lng);
      if (withCoords.length > 0) {
        const result = await distributeLeads(withCoords);
        distributed = result.distributed;
      }
    }
  }

  return NextResponse.json({ enriched, total: candidates.length, distributed });
}
