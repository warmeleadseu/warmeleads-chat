import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { getMetaCredentials, listMetaPages, META_GRAPH_URL } from '@/lib/meta';
import { createServerClient } from '@/lib/supabase';

interface LeadGenForm {
  id: string;
  name: string;
  status: string;
  /** Page-id van de FB-pagina waar dit Lead Form aan hangt. */
  page_id?: string;
  /** Aantal vragen in het formulier (excl. NAW). Indicator voor "kwaliteit". */
  questions_count?: number;
}

async function metaGet(path: string, token: string): Promise<Record<string, unknown> | null> {
  const sep = path.includes('?') ? '&' : '?';
  const res: Response = await fetch(`${META_GRAPH_URL}/${path}${sep}access_token=${token}`);
  return res.json();
}

/**
 * Lijst alle leadgen-forms van één pagina, met paginatie.
 *
 * BELANGRIJK: de `/{page_id}/leadgen_forms`-edge MOET met een **Page Access
 * Token** worden aangeroepen. Met een user-/system-user-token geeft Meta
 * `(#190) This method must be called with a Page Access Token` en kregen we
 * vroeger stilzwijgend 0 formulieren terug ("Geen lead formulieren gevonden").
 */
async function listFormsForPage(
  pageId: string,
  pageToken: string,
  into: Map<string, LeadGenForm>,
): Promise<void> {
  let url: string | null = `${pageId}/leadgen_forms?fields=id,name,status&limit=100`;
  let guard = 0;
  while (url && guard < 10) {
    guard++;
    const data: Record<string, unknown> | null = await metaGet(url, pageToken).catch(() => null);
    if (!data || data.error) break;
    for (const form of (data.data as Array<{ id: string; name?: string; status?: string }>) || []) {
      into.set(form.id, {
        id: form.id,
        name: form.name || `Form ${form.id}`,
        status: form.status || 'ACTIVE',
        page_id: pageId,
      });
    }
    const paging = data.paging as { next?: string } | undefined;
    url = paging?.next ? paging.next.replace(`${META_GRAPH_URL}/`, '') : null;
  }
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
    // Page-access-tokens voor alle pagina's die onze (system-)user beheert.
    // leadgen_forms vereist een page-token (zie listFormsForPage). 5-min cached.
    let managedPages: { id: string; access_token: string }[] = [];
    try {
      managedPages = await listMetaPages();
    } catch (e) {
      console.error('[meta-forms] listMetaPages faalde:', e);
    }
    const pageTokenById = new Map(managedPages.map(p => [p.id, p.access_token]));

    const candidatePageIds = new Set<string>();
    const directFormIds = new Set<string>();

    // ── Strategy 1: leid pagina's af uit bestaande CRM-leads van deze branche ──
    if (branch) {
      const { data: leads } = await supabase
        .from('leads')
        .select('meta_ad_id, meta_campaign_id')
        .eq('branch', branch)
        .or('meta_ad_id.neq.,meta_campaign_id.neq.')
        .limit(50);

      const campaignIds = [...new Set((leads || []).map(l => l.meta_campaign_id).filter(Boolean))];
      const adIds = [...new Set((leads || []).map(l => l.meta_ad_id).filter(Boolean))];

      // Campagnes → promoted_object.page_id (vaak leeg op campagne-niveau).
      const campaignResults = await Promise.all(
        campaignIds.slice(0, 10).map(cid => metaGet(`${cid}?fields=promoted_object`, token).catch(() => null)),
      );
      for (const cr of campaignResults) {
        const pid = (cr?.promoted_object as { page_id?: string } | undefined)?.page_id;
        if (pid) candidatePageIds.add(pid);
      }

      // Ads → adset.promoted_object.page_id (hier zit de page_id meestal wél),
      // plus creative.object_story_spec voor page_id én een directe lead_gen_form_id.
      const adResults = await Promise.all(
        adIds.slice(0, 15).map(aid =>
          metaGet(`${aid}?fields=adset{promoted_object},creative{object_story_spec}`, token).catch(() => null),
        ),
      );
      for (const ar of adResults) {
        if (!ar) continue;
        const adset = ar.adset as { promoted_object?: { page_id?: string } } | undefined;
        if (adset?.promoted_object?.page_id) candidatePageIds.add(adset.promoted_object.page_id);

        const spec = (ar.creative as { object_story_spec?: Record<string, unknown> } | undefined)?.object_story_spec;
        if (spec?.page_id) candidatePageIds.add(spec.page_id as string);
        const linkData = spec?.link_data as { call_to_action?: { value?: { lead_gen_form_id?: string } } } | undefined;
        const videoData = spec?.video_data as { call_to_action?: { value?: { lead_gen_form_id?: string } } } | undefined;
        const fid = linkData?.call_to_action?.value?.lead_gen_form_id || videoData?.call_to_action?.value?.lead_gen_form_id;
        if (fid) directFormIds.add(fid);
      }
    }

    // ── Strategy 2 (fallback): pagina's uit de ad-sets van het ad-account ──
    // We lezen promoted_object op AD-SET-niveau (niet campagne), want daar staat
    // de page_id doorgaans wél.
    if (candidatePageIds.size === 0 && directFormIds.size === 0) {
      let url: string | null =
        `act_${credentials.adAccountId}/adsets?fields=promoted_object&effective_status=["ACTIVE","PAUSED"]&limit=200`;
      let guard = 0;
      while (url && guard < 5) {
        guard++;
        const d: Record<string, unknown> | null = await metaGet(url, token).catch(() => null);
        if (!d || d.error) break;
        for (const a of (d.data as Array<{ promoted_object?: { page_id?: string } }>) || []) {
          if (a.promoted_object?.page_id) candidatePageIds.add(a.promoted_object.page_id);
        }
        const paging = d.paging as { next?: string } | undefined;
        url = paging?.next ? paging.next.replace(`${META_GRAPH_URL}/`, '') : null;
      }
    }

    // ── Laatste fallback: alle beheerde pagina's ──
    // Zo is de lijst nooit onterecht leeg wanneer er wél formulieren bestaan
    // (bv. een branche zonder Meta-geattribueerde leads of campagnes).
    if (candidatePageIds.size === 0 && directFormIds.size === 0) {
      for (const p of managedPages) candidatePageIds.add(p.id);
    }

    // ── Forms per pagina ophalen met PAGE-token (parallel over pagina's) ──
    const formsById = new Map<string, LeadGenForm>();
    await Promise.all(
      [...candidatePageIds].map(pid => listFormsForPage(pid, pageTokenById.get(pid) || token, formsById)),
    );

    // Direct via creatives gevonden form-ids die nog niet in de lijst staan
    // (bv. forms op een pagina zonder page-token): resolve per id met user-token.
    const missingDirect = [...directFormIds].filter(fid => !formsById.has(fid));
    await Promise.all(
      missingDirect.map(async fid => {
        const d = await metaGet(`${fid}?fields=id,name,status,page`, token).catch(() => null);
        if (d && !d.error) {
          formsById.set(d.id as string, {
            id: d.id as string,
            name: (d.name as string) || `Form ${fid}`,
            status: (d.status as string) || 'ACTIVE',
            page_id: (d.page as { id?: string } | undefined)?.id,
          });
        }
      }),
    );

    if (formsById.size === 0) {
      return NextResponse.json({
        forms: [],
        message: 'Geen lead formulieren gevonden. Controleer of de Meta-koppeling toegang heeft tot de juiste Facebook-pagina.',
      });
    }

    const forms = [...formsById.values()];

    // questions_count alleen verrijken bij een overzichtelijke (branche-gerichte)
    // lijst — voor grote fallback-lijsten slaan we dit over i.v.m. snelheid.
    if (forms.length <= 60) {
      await Promise.all(
        forms.map(async f => {
          const tok = (f.page_id && pageTokenById.get(f.page_id)) || token;
          const d = await metaGet(`${f.id}?fields=questions{id}`, tok).catch(() => null);
          const qs = (d?.questions as { data?: unknown[] } | undefined)?.data;
          if (Array.isArray(qs)) f.questions_count = qs.length;
        }),
      );
    }

    forms.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ forms });
  } catch (err) {
    console.error('Meta forms fetch error:', err);
    return NextResponse.json({ error: 'Kon formulieren niet ophalen' }, { status: 500 });
  }
}
