import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { enrichLeadAddress } from '@/lib/pdok';
import { distributeLead } from '@/lib/distribution';
import { isPhoneValid } from '@/lib/phoneValidation';
import { checkLeadProfanity } from '@/lib/profanityFilter';
import { checkRateLimit } from '@/lib/rateLimit';
import { calculateQualityScore } from '@/lib/leadQuality';
import {
  buildPartnerProspectInsertRow,
  findRecentPartnerProspectByEmail,
  insertPartnerProspect,
  isPartnerProspectBranch,
  type PartnerProspectPayload,
} from '@/lib/partnerProspectIngest';
import { resolvePartnerProspectAccountManagerId } from '@/lib/partnerProspectAssignment';

const COMMON_KEYS = new Set([
  'branch', 'customer_id', 'naam_klant', 'name', 'email', 'telefoonnummer', 'phone',
  'postcode', 'huisnummer', 'plaatsnaam', 'city', 'provincie', 'wervingsdatum',
  'status', 'bron', 'notities', 'land',
  'meta_campaign_id', 'meta_adset_id', 'meta_ad_id',
  'campaign_id', 'adset_id', 'ad_id',
  'bedrijfsnaam', 'company_name',
]);

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey) {
      return NextResponse.json({ error: 'API key ontbreekt' }, { status: 401 });
    }

    const supabase = createServerClient();

    const { data: keyRecord, error: keyError } = await supabase
      .from('webhook_keys')
      .select('*, customers(id, name)')
      .eq('key', apiKey)
      .eq('is_active', true)
      .single();

    if (keyError || !keyRecord) {
      return NextResponse.json({ error: 'Ongeldige of inactieve API key' }, { status: 401 });
    }

    const rl = await checkRateLimit(`webhook:${apiKey}`, 100, 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limit overschreden' }, { status: 429 });
    }

    const body = await request.json();
    const branchSlug = body.branch || keyRecord.branch;

    const { data: branchFields } = await supabase
      .from('branch_fields')
      .select('key')
      .eq('branch_id', (
        await supabase.from('branches').select('id').eq('slug', branchSlug).single()
      ).data?.id || '');

    const fieldKeys = new Set((branchFields || []).map((f: { key: string }) => f.key));

    const customFields: Record<string, string> = {};
    for (const [k, v] of Object.entries(body)) {
      if (!COMMON_KEYS.has(k) && fieldKeys.has(k) && v) {
        customFields[k] = String(v);
      }
    }

    const phone = body.telefoonnummer || body.phone || '';
    const metaCampaignId = body.meta_campaign_id || body.campaign_id || null;
    const metaAdsetId = body.meta_adset_id || body.adset_id || null;
    const metaAdId = body.meta_ad_id || body.ad_id || null;

    const lead = await enrichLeadAddress({
      branch: branchSlug,
      naam_klant: body.naam_klant || body.name || '',
      email: body.email || '',
      telefoonnummer: phone,
      phone_valid: isPhoneValid(phone),
      postcode: body.postcode || '',
      huisnummer: body.huisnummer || '',
      plaatsnaam: body.plaatsnaam || body.city || '',
      provincie: body.provincie || '',
      land: body.land || '',
      wervingsdatum: body.wervingsdatum || new Date().toISOString().split('T')[0],
      status: 'nieuw',
      bron: 'zapier',
      notities: body.notities || '',
      custom_fields: Object.keys(customFields).length > 0 ? customFields : {},
      ...(metaCampaignId && { meta_campaign_id: metaCampaignId }),
      ...(metaAdsetId && { meta_adset_id: metaAdsetId }),
      ...(metaAdId && { meta_ad_id: metaAdId }),
    });

    if (!lead.naam_klant) {
      return NextResponse.json({ error: 'naam_klant is verplicht' }, { status: 400 });
    }

    /* ── Thuisbatterij Partners → prospects (geen lead-pool / distributie) ── */
    if (isPartnerProspectBranch(branchSlug)) {
      if (lead.email) {
        const dup = await findRecentPartnerProspectByEmail(supabase, lead.email);
        if (dup) {
          await supabase
            .from('webhook_keys')
            .update({
              last_used_at: new Date().toISOString(),
              request_count: (keyRecord.request_count || 0) + 1,
            })
            .eq('id', keyRecord.id);
          return NextResponse.json({
            success: true,
            prospect_id: dup.id,
            deduplicated: true,
            ingest: 'prospect',
          });
        }
      }

      const quality_score = calculateQualityScore(lead);

      const payload: PartnerProspectPayload = {
        ...body,
        naam_klant: lead.naam_klant,
        email: lead.email,
        telefoonnummer: lead.telefoonnummer,
        postcode: lead.postcode,
        huisnummer: lead.huisnummer,
        plaatsnaam: lead.plaatsnaam,
        provincie: lead.provincie,
        land: lead.land,
        wervingsdatum: lead.wervingsdatum as string | undefined,
        bron: lead.bron as string | undefined,
        meta_campaign_id: lead.meta_campaign_id as string | undefined,
        meta_adset_id: lead.meta_adset_id as string | undefined,
        meta_ad_id: lead.meta_ad_id as string | undefined,
        notities: lead.notities,
        custom_fields: lead.custom_fields as Record<string, unknown> | undefined,
        lat: lead.lat as number | undefined,
        lng: lead.lng as number | undefined,
        phone_valid: lead.phone_valid as boolean | undefined,
        quality_score,
        lead_status: lead.status as string | undefined,
        lead_customer_id: lead.customer_id != null ? String(lead.customer_id) : undefined,
      };

      const accountManagerId = await resolvePartnerProspectAccountManagerId(supabase, branchSlug);

      const row = buildPartnerProspectInsertRow(payload, customFields, {
        plaatsnaam: lead.plaatsnaam,
        provincie: lead.provincie,
        postcode: lead.postcode,
        land: lead.land,
      }, accountManagerId);

      const pr = await insertPartnerProspect(supabase, row, {
        title: 'Ingekomen via partner-webhook',
        body: 'Thuisbatterij Partners (Zapier/Meta).',
        type: 'created',
      });

      if (!pr) {
        return NextResponse.json({ error: 'Prospect opslaan mislukt' }, { status: 500 });
      }

      await supabase
        .from('webhook_keys')
        .update({
          last_used_at: new Date().toISOString(),
          request_count: (keyRecord.request_count || 0) + 1,
        })
        .eq('id', keyRecord.id);

      return NextResponse.json({
        success: true,
        prospect_id: pr.id,
        ingest: 'prospect',
      });
    }

    // Deduplication: if same email+branch exists within 30 days, don't create
    // a new record but still run distribution on the existing lead
    if (lead.email) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: existing } = await supabase
        .from('leads')
        .select('id, branch, lat, lng')
        .eq('email', lead.email)
        .eq('branch', lead.branch)
        .gte('created_at', thirtyDaysAgo)
        .limit(1);
      if (existing && existing.length > 0) {
        const dup = existing[0];
        if (dup.lat && dup.lng) {
          try {
            await distributeLead({ id: dup.id, branch: dup.branch, lat: dup.lat, lng: dup.lng });
          } catch { /* distribution failure should not block webhook */ }
        }
        return NextResponse.json({ success: true, lead_id: dup.id, deduplicated: true });
      }
    }

    const profanity = checkLeadProfanity(lead as Record<string, unknown>);
    if (profanity.blocked) {
      return NextResponse.json({ success: false, error: 'Lead geweigerd: ongepaste inhoud' }, { status: 422 });
    }

    const quality_score = calculateQualityScore(lead);

    const { data, error } = await supabase.from('leads').insert({ ...lead, quality_score }).select().single();

    if (error) {
      console.error('Webhook lead insert error:', error);
      return NextResponse.json({ error: 'Lead opslaan mislukt' }, { status: 500 });
    }

    await supabase
      .from('webhook_keys')
      .update({
        last_used_at: new Date().toISOString(),
        request_count: (keyRecord.request_count || 0) + 1,
      })
      .eq('id', keyRecord.id);

    if (data.lat && data.lng) {
      try {
        await distributeLead({ id: data.id, branch: data.branch, lat: data.lat, lng: data.lng });
      } catch { /* distribution failure should not block webhook */ }
    }

    return NextResponse.json({ success: true, lead_id: data.id });
  } catch (err) {
    console.error('Webhook error:', err);
    return NextResponse.json({ error: 'Verwerking mislukt' }, { status: 500 });
  }
}
