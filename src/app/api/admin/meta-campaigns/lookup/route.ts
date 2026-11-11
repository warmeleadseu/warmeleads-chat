import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { getMetaCredentials, META_GRAPH_URL } from '@/lib/meta';
import { createServerClient } from '@/lib/supabase';
import { laadOpgeslagenCampagneNamen } from '@/lib/metaCampagneNamen';

const MAX_IDS = 10;

function normActId(id: string): string {
  const t = id.trim();
  return t.startsWith('act_') ? t : `act_${t}`;
}

/**
 * Haal campagnenamen op voor bestaande Graph campaign-ID's (batch detail / editor init).
 * GET ?ids=id1,id2,...
 *
 * Eerst de actuele naam bij Meta; lukt dat niet, de laatst bekende naam uit
 * onze eigen kostendata. Alleen als beide niets opleveren blijft het nummer.
 */
export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const raw = request.nextUrl.searchParams.get('ids') || '';
  const ids = [...new Set(raw.split(/[\s,]+/).map(s => s.trim()).filter(s => /^\d+$/.test(s)))].slice(
    0,
    MAX_IDS,
  );
  if (ids.length === 0) {
    return NextResponse.json({ campaigns: [] });
  }

  const opgeslagen = await laadOpgeslagenCampagneNamen(createServerClient(), ids);
  const terugval = (id: string) => ({ id, name: opgeslagen.get(id) || id });

  const credentials = await getMetaCredentials().catch(() => null);
  if (!credentials) {
    return NextResponse.json({ campaigns: ids.map(terugval) });
  }

  const expected = normActId(credentials.adAccountId);
  const token = encodeURIComponent(credentials.accessToken);
  const campaigns: { id: string; name: string }[] = [];

  for (const id of ids) {
    const res = await fetch(`${META_GRAPH_URL}/${id}?fields=id,name,account_id&access_token=${token}`).catch(() => null);
    const json = (res ? await res.json().catch(() => ({})) : {}) as {
      id?: string;
      name?: string;
      account_id?: string;
      error?: { message?: string };
    };
    if (!res || !res.ok || json.error || !json.id) {
      campaigns.push(terugval(id));
      continue;
    }
    if (normActId(json.account_id || '') !== expected) {
      campaigns.push({ id, name: `${opgeslagen.get(id) || id} (ander ad account)` });
      continue;
    }
    campaigns.push({ id: json.id, name: json.name || opgeslagen.get(id) || json.id });
  }

  return NextResponse.json({ campaigns });
}
