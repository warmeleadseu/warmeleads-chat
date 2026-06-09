import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';

interface Body {
  prospects?: unknown;
  customers?: unknown;
}

function asUuidArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return v.filter((x): x is string => typeof x === 'string' && re.test(x));
}

/**
 * Geeft de unieke verzameling branche-slugs terug voor de meegestuurde
 * prospect- en customer-IDs. Wordt door de Compose Mail-drawer gebruikt om
 * branche-gebonden templates (bv. Nij Begun) alleen te tonen wanneer minstens
 * één geselecteerde ontvanger op die branche staat.
 */
export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 400 });
  }

  const prospectIds = asUuidArray(body.prospects);
  const customerIds = asUuidArray(body.customers);

  if (prospectIds.length === 0 && customerIds.length === 0) {
    return NextResponse.json({ branches: [] });
  }

  const supabase = createServerClient();
  const [pRes, cRes] = await Promise.all([
    prospectIds.length > 0
      ? supabase.from('prospects').select('branches').in('id', prospectIds)
      : Promise.resolve({ data: [] as { branches: string[] | null }[], error: null }),
    customerIds.length > 0
      ? supabase.from('customers').select('branches').in('id', customerIds)
      : Promise.resolve({ data: [] as { branches: string[] | null }[], error: null }),
  ]);

  const set = new Set<string>();
  for (const row of (pRes.data || []) as { branches: string[] | null }[]) {
    for (const slug of row.branches || []) {
      const s = (slug || '').trim();
      if (s) set.add(s);
    }
  }
  for (const row of (cRes.data || []) as { branches: string[] | null }[]) {
    for (const slug of row.branches || []) {
      const s = (slug || '').trim();
      if (s) set.add(s);
    }
  }

  return NextResponse.json({ branches: Array.from(set).sort() });
}
