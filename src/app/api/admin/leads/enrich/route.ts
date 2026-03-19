import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { resolveAddress } from '@/lib/pdok';

function isValidPlace(val: string | null | undefined): boolean {
  if (!val || typeof val !== 'string') return false;
  const v = val.trim();
  if (v.length < 2) return false;
  if (/^[-–—.…\/\\]+$/.test(v)) return false;
  if (v.includes('@')) return false;
  if (/^\+?\d[\d\s\-().]{6,}$/.test(v)) return false;
  if (/^\d+$/.test(v)) return false;
  const low = v.toLowerCase();
  if (['n/a', 'nvt', 'n.v.t.', 'onbekend', 'unknown', 'geen', 'x', 'xx', 'xxx', 'test', '?', '??', 'null', 'undefined', 'none'].includes(low)) return false;
  return true;
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();

  const { data: leads, error } = await supabase
    .from('leads')
    .select('id, postcode, huisnummer, plaatsnaam, provincie, lat, lng, land')
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
    return NextResponse.json({ enriched: 0, total: 0 });
  }

  const CONCURRENCY = 5;
  let enriched = 0;

  for (let i = 0; i < candidates.length; i += CONCURRENCY) {
    const batch = candidates.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (lead) => {
        const result = await resolveAddress(lead.postcode, lead.huisnummer, lead.land as 'NL' | 'BE' | null);
        if (!result) return null;

        const updates: Record<string, string | number> = {};
        if (!isValidPlace(lead.plaatsnaam) && result.plaatsnaam) updates.plaatsnaam = result.plaatsnaam;
        if (!isValidPlace(lead.provincie) && result.provincie) updates.provincie = result.provincie;
        if ((!lead.lat || !lead.lng) && result.lat && result.lng) {
          updates.lat = result.lat;
          updates.lng = result.lng;
        }
        if (result.land && !lead.land) updates.land = result.land;

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

  return NextResponse.json({ enriched, total: candidates.length });
}
