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
    // Step 1: Get all ad creatives with lead_gen_form_id
    const formIds = new Set<string>();
    let creativesUrl: string | null = `${META_GRAPH_URL}/act_${credentials.adAccountId}/adcreatives?fields=id,name,lead_gen_form_id&limit=200&access_token=${credentials.accessToken}`;

    while (creativesUrl) {
      const res: Response = await fetch(creativesUrl);
      const data = await res.json();

      if (data.error) {
        return NextResponse.json({ error: data.error.message }, { status: 400 });
      }

      for (const creative of data.data || []) {
        if (creative.lead_gen_form_id) formIds.add(creative.lead_gen_form_id);
      }
      creativesUrl = data.paging?.next || null;
    }

    if (formIds.size === 0) {
      return NextResponse.json({ forms: [], message: 'Geen lead formulieren gevonden in dit ad account' });
    }

    // Step 2: Get form details
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
