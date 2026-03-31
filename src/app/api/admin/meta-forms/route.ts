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
    const adsUrl = `${META_GRAPH_URL}/act_${credentials.adAccountId}/ads?fields=name,creative{lead_gen_form_id}&effective_status=["ACTIVE","PAUSED"]&limit=200&access_token=${credentials.accessToken}`;
    const adsRes = await fetch(adsUrl);
    const adsData = await adsRes.json();

    if (adsData.error) {
      return NextResponse.json({ error: adsData.error.message }, { status: 400 });
    }

    const formIds = new Set<string>();
    for (const ad of adsData.data || []) {
      const fid = ad.creative?.lead_gen_form_id;
      if (fid) formIds.add(fid);
    }

    if (formIds.size === 0) {
      return NextResponse.json({ forms: [], message: 'Geen lead formulieren gevonden in actieve ads' });
    }

    const forms: LeadGenForm[] = [];
    for (const fid of formIds) {
      try {
        const formRes = await fetch(`${META_GRAPH_URL}/${fid}?fields=id,name,status&access_token=${credentials.accessToken}`);
        const formData = await formRes.json();
        if (!formData.error) {
          forms.push({ id: formData.id, name: formData.name || `Form ${fid}`, status: formData.status || 'ACTIVE' });
        }
      } catch {
        forms.push({ id: fid, name: `Form ${fid}`, status: 'unknown' });
      }
    }

    forms.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ forms });
  } catch (err) {
    console.error('Meta forms fetch error:', err);
    return NextResponse.json({ error: 'Kon formulieren niet ophalen' }, { status: 500 });
  }
}
