import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { getMetaCredentials, META_GRAPH_URL } from '@/lib/meta';

const MAX_RESULTS = 25;
const MAX_PAGES = 15;
const PAGE_LIMIT = 100;

/**
 * Zoek campagnes op naam binnen het geconfigureerde Meta-advertentieaccount.
 * GET ?q=minimaal 2 tekens
 */
export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const q = (request.nextUrl.searchParams.get('q') || '').trim();
  if (q.length < 2) {
    return NextResponse.json({ campaigns: [], hint: 'Typ minimaal 2 tekens' });
  }

  const credentials = await getMetaCredentials();
  if (!credentials) {
    return NextResponse.json({ error: 'Meta API niet geconfigureerd' }, { status: 400 });
  }

  const accountId = credentials.adAccountId.startsWith('act_')
    ? credentials.adAccountId
    : `act_${credentials.adAccountId}`;
  const needle = q.toLowerCase();
  const token = encodeURIComponent(credentials.accessToken);
  const matches: { id: string; name: string; status?: string; effective_status?: string }[] = [];

  let url: string | null =
    `${META_GRAPH_URL}/${accountId}/campaigns?fields=id,name,status,effective_status&limit=${PAGE_LIMIT}&access_token=${token}`;
  let pages = 0;

  while (url && matches.length < MAX_RESULTS && pages < MAX_PAGES) {
    const res = await fetch(url);
    const json = (await res.json().catch(() => ({}))) as {
      data?: { id: string; name?: string; status?: string; effective_status?: string }[];
      paging?: { next?: string };
      error?: { message?: string };
    };
    pages++;

    if (!res.ok || json.error) {
      return NextResponse.json(
        { error: json.error?.message || `Meta API (${res.status})` },
        { status: 400 },
      );
    }

    for (const c of json.data || []) {
      const name = (c.name || '').toLowerCase();
      if (name.includes(needle)) {
        matches.push({
          id: c.id,
          name: c.name || c.id,
          status: c.status,
          effective_status: c.effective_status,
        });
        if (matches.length >= MAX_RESULTS) break;
      }
    }

    if (matches.length >= MAX_RESULTS) break;
    url = json.paging?.next || null;
  }

  return NextResponse.json({ campaigns: matches });
}
