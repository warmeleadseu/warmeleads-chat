import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { getMetaCredentials } from '@/lib/meta';

const META_GRAPH_URL = 'https://graph.facebook.com/v21.0';

interface LeadGenForm {
  id: string;
  name: string;
  status: string;
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const credentials = await getMetaCredentials();
  if (!credentials) {
    return NextResponse.json({ error: 'Meta API niet geconfigureerd' }, { status: 400 });
  }

  try {
    const formIds = new Set<string>();
    const statuses = ['ACTIVE', 'PAUSED'].map(s => `"${s}"`).join(',');
    const MAX_PAGES = 5;

    let adsUrl: string | null =
      `${META_GRAPH_URL}/act_${credentials.adAccountId}/ads` +
      `?fields=creative{lead_gen_form_id}` +
      `&effective_status=[${statuses}]` +
      `&limit=200&access_token=${credentials.accessToken}`;

    let pages = 0;
    while (adsUrl && pages < MAX_PAGES) {
      pages++;
      const res: Response = await fetch(adsUrl);
      const data = await res.json();

      if (data.error) {
        return NextResponse.json({ error: data.error.message }, { status: 400 });
      }

      for (const ad of data.data || []) {
        const fid = ad.creative?.lead_gen_form_id;
        if (fid) formIds.add(fid);
      }
      adsUrl = data.paging?.next || null;
    }

    if (formIds.size === 0) {
      return NextResponse.json({ forms: [], message: 'Geen lead formulieren gevonden bij actieve ads in dit ad account' });
    }

    const forms: LeadGenForm[] = [];
    const formFetches = [...formIds].map(async (fid) => {
      try {
        const r = await fetch(`${META_GRAPH_URL}/${fid}?fields=id,name,status&access_token=${credentials.accessToken}`);
        const d = await r.json();
        if (!d.error) {
          return { id: d.id, name: d.name || `Form ${fid}`, status: d.status || 'ACTIVE' } as LeadGenForm;
        }
      } catch { /* ignore individual form errors */ }
      return { id: fid, name: `Form ${fid}`, status: 'unknown' } as LeadGenForm;
    });

    forms.push(...await Promise.all(formFetches));
    forms.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ forms });
  } catch (err) {
    console.error('Meta forms fetch error:', err);
    return NextResponse.json({ error: 'Kon formulieren niet ophalen' }, { status: 500 });
  }
}
