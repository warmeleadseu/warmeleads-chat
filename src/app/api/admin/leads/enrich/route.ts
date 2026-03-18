import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { resolveAddress } from '@/lib/pdok';

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();

  const { data: leads, error } = await supabase
    .from('leads')
    .select('id, postcode, huisnummer, plaatsnaam, provincie')
    .not('postcode', 'is', null)
    .not('postcode', 'eq', '')
    .not('huisnummer', 'is', null)
    .not('huisnummer', 'eq', '')
    .or('plaatsnaam.is.null,plaatsnaam.eq.,provincie.is.null,provincie.eq.');

  if (error) {
    return NextResponse.json({ error: 'Kon leads niet ophalen' }, { status: 500 });
  }

  if (!leads || leads.length === 0) {
    return NextResponse.json({ enriched: 0, total: 0 });
  }

  const CONCURRENCY = 10;
  let enriched = 0;

  for (let i = 0; i < leads.length; i += CONCURRENCY) {
    const batch = leads.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (lead) => {
        const result = await resolveAddress(lead.postcode, lead.huisnummer);
        if (!result) return null;

        const updates: Record<string, string> = {};
        if (!lead.plaatsnaam && result.plaatsnaam) updates.plaatsnaam = result.plaatsnaam;
        if (!lead.provincie && result.provincie) updates.provincie = result.provincie;

        if (Object.keys(updates).length === 0) return null;
        return { id: lead.id, updates };
      })
    );

    for (const r of results) {
      if (!r) continue;
      const { error: updateErr } = await supabase
        .from('leads')
        .update(r.updates)
        .eq('id', r.id);
      if (!updateErr) enriched++;
    }
  }

  return NextResponse.json({ enriched, total: leads.length });
}
