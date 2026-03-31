import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { getMetaCredentials } from '@/lib/meta';
import { createServerClient } from '@/lib/supabase';

const META_GRAPH_URL = 'https://graph.facebook.com/v21.0';

interface LeadGenForm {
  id: string;
  name: string;
  status: string;
}

async function metaGet(path: string, token: string) {
  const sep = path.includes('?') ? '&' : '?';
  const res: Response = await fetch(`${META_GRAPH_URL}/${path}${sep}access_token=${token}`);
  return res.json();
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const credentials = await getMetaCredentials();
  if (!credentials) {
    return NextResponse.json({ error: 'Meta API niet geconfigureerd' }, { status: 400 });
  }

  const branch = request.nextUrl.searchParams.get('branch') || '';
  const token = credentials.accessToken;
  const supabase = createServerClient();

  try {
    const formIds = new Set<string>();
    const pageIds = new Set<string>();

    // ── Strategy 1: Detect forms from existing leads in CRM ─────────
    if (branch) {
      const { data: leads } = await supabase
        .from('leads')
        .select('meta_ad_id, meta_campaign_id')
        .eq('branch', branch)
        .or('meta_ad_id.neq.,meta_campaign_id.neq.')
        .limit(50);

      const campaignIds = [...new Set((leads || []).map(l => l.meta_campaign_id).filter(Boolean))];
      const adIds = [...new Set((leads || []).map(l => l.meta_ad_id).filter(Boolean))];

      // From campaigns → get page_id (promoted_object)
      const campaignFetches = campaignIds.slice(0, 10).map(cid =>
        metaGet(`${cid}?fields=promoted_object`, token).catch(() => null),
      );
      const campaignResults = await Promise.all(campaignFetches);
      for (const cr of campaignResults) {
        if (cr?.promoted_object?.page_id) pageIds.add(cr.promoted_object.page_id);
      }

      // From pages → get all leadgen_forms directly
      for (const pageId of pageIds) {
        let formsUrl: string | null = `${pageId}/leadgen_forms?fields=id,name,status&limit=100`;
        while (formsUrl) {
          const pgData: Record<string, unknown> | null = await metaGet(formsUrl, token).catch(() => null);
          if (!pgData || pgData.error) break;
          for (const form of (pgData.data as Array<{ id: string }>) || []) {
            formIds.add(form.id);
          }
          const paging = pgData.paging as { next?: string } | undefined;
          formsUrl = paging?.next
            ? paging.next.replace(`${META_GRAPH_URL}/`, '')
            : null;
        }
      }

      // Fallback: if no page found, try ad → creative → form
      if (formIds.size === 0 && adIds.length > 0) {
        const adFetches = adIds.slice(0, 10).map(aid =>
          metaGet(`${aid}?fields=creative`, token).catch(() => null),
        );
        const adResults = await Promise.all(adFetches);
        const creativeIds = [...new Set(
          adResults.map(r => r?.creative?.id).filter(Boolean),
        )];

        const creativeFetches = creativeIds.map(cid =>
          metaGet(`${cid}?fields=object_story_spec`, token).catch(() => null),
        );
        const creativeResults = await Promise.all(creativeFetches);
        for (const cr of creativeResults) {
          const spec = cr?.object_story_spec;
          const fid =
            spec?.link_data?.call_to_action?.value?.lead_gen_form_id ||
            spec?.video_data?.call_to_action?.value?.lead_gen_form_id;
          if (fid) formIds.add(fid);
        }
      }
    }

    // ── Strategy 2 (fallback): Get pages from ad account ────────────
    if (formIds.size === 0) {
      const acctData = await metaGet(
        `act_${credentials.adAccountId}/campaigns?fields=promoted_object&effective_status=["ACTIVE","PAUSED"]&limit=50`,
        token,
      ).catch(() => null);

      if (acctData?.data) {
        for (const camp of acctData.data) {
          if (camp.promoted_object?.page_id) pageIds.add(camp.promoted_object.page_id);
        }
      }

      for (const pageId of pageIds) {
        const data = await metaGet(`${pageId}/leadgen_forms?fields=id,name,status&limit=50`, token).catch(() => null);
        if (data?.data) {
          for (const form of data.data) formIds.add(form.id);
        }
      }
    }

    if (formIds.size === 0) {
      return NextResponse.json({
        forms: [],
        message: 'Geen lead formulieren gevonden. Zorg dat er leads met Meta IDs in het CRM staan of dat er actieve Lead Ads draaien.',
      });
    }

    // ── Get form details (parallel) ─────────────────────────────────
    const formFetches = [...formIds].map(async (fid): Promise<LeadGenForm> => {
      try {
        const d = await metaGet(`${fid}?fields=id,name,status`, token);
        if (!d.error) {
          return { id: d.id, name: d.name || `Form ${fid}`, status: d.status || 'ACTIVE' };
        }
      } catch { /* ignore */ }
      return { id: fid, name: `Form ${fid}`, status: 'unknown' };
    });

    const forms = await Promise.all(formFetches);
    forms.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ forms });
  } catch (err) {
    console.error('Meta forms fetch error:', err);
    return NextResponse.json({ error: 'Kon formulieren niet ophalen' }, { status: 500 });
  }
}
