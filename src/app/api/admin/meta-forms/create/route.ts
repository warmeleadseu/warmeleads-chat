/**
 * POST /api/admin/meta-forms/create
 *
 * Maakt een nieuw Meta Lead Form aan in een door admin gekozen
 * Facebook-page. Wordt aangeroepen na admin review/edit van de AI-draft.
 *
 * Flow:
 *   1. Body valideren (page_id + form payload)
 *   2. Page-ownership-guard: page_id MOET in /me/accounts staan (security
 *      én laat ons direct het page-access-token ophalen).
 *   3. createLeadgenForm() naar Meta met page-token
 *   4. branch_fields auto-sync voor nieuwe question-keys (anders dropt
 *      onze webhook-intake antwoorden silent).
 *   5. Audit-row in ai_lead_forms_created.
 *   6. Return form_id voor de UI-refresh.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { getPageAccessToken } from '@/lib/meta';
import {
  createLeadgenForm,
  formatMetaLeadFormCreateError,
  type LeadgenQuestion,
  type LeadgenContextCard,
  type LeadgenThankYouPage,
  type LeadgenPrivacyPolicy,
  type MetaApiError,
} from '@/lib/metaMarketingApi';
import { isAiCampaignsEnabled } from '@/lib/aiCampaignBudget';

export const runtime = 'nodejs';
export const maxDuration = 30;

const CustomQuestionSchema = z.object({
  key: z.string().min(2).max(40).regex(/^[a-z][a-z0-9_]*$/, 'key moet snake_case zijn'),
  label: z.string().min(4).max(120),
  type: z.enum(['MULTIPLE_CHOICE', 'SHORT_ANSWER']),
  options: z.array(z.object({
    value: z.string().min(1).max(40),
    label: z.string().min(1).max(60),
  })).min(2).max(6).optional(),
  inline_context: z.string().max(120).optional(),
});

const BodySchema = z.object({
  page_id: z.string().min(1),
  branch: z.string().min(1),
  form: z.object({
    name: z.string().min(6).max(60),
    locale: z.enum(['nl_NL', 'nl_BE', 'fr_BE', 'en_US']).default('nl_NL'),
    form_type: z.enum(['HIGHER_INTENT', 'MORE_VOLUME']).default('HIGHER_INTENT'),
    custom_questions: z.array(CustomQuestionSchema).min(1).max(6),
    prefilled_fields: z.array(z.enum([
      'FULL_NAME', 'FIRST_NAME', 'LAST_NAME',
      'EMAIL', 'PHONE',
      'STREET_ADDRESS', 'CITY', 'STATE', 'POST_CODE', 'ZIP', 'COUNTRY',
      'DATE_OF_BIRTH', 'GENDER',
    ])).min(1).max(8),
    context_card: z.object({
      title: z.string().min(4).max(80),
      content: z.array(z.string().min(4).max(280)).min(1).max(3),
      button_text: z.string().min(2).max(30).optional(),
    }).optional(),
    thank_you_page: z.object({
      title: z.string().min(4).max(60),
      body: z.string().min(8).max(300),
      button_type: z.enum(['VIEW_WEBSITE', 'CALL_BUSINESS', 'NONE']).default('VIEW_WEBSITE'),
      button_text: z.string().min(2).max(30).optional(),
      website_url: z.string().url().optional(),
      business_phone_number: z.string().min(6).max(20).optional(),
    }),
    privacy_policy: z.object({
      url: z.string().url(),
      link_text: z.string().min(4).max(60).optional(),
    }),
  }),
  /** AI-cost van de draft-call. Geforward voor audit. */
  ai_cost_cents: z.number().int().nonnegative().default(0),
});

export async function POST(request: NextRequest) {
  const { admin, error: authErr } = await requireSuperAdmin(request);
  if (authErr || !admin) return authErr;

  if (!(await isAiCampaignsEnabled())) {
    return NextResponse.json({ error: 'AI campaigns master switch staat uit.' }, { status: 409 });
  }

  const parse = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parse.success) {
    return NextResponse.json({ error: 'Ongeldige input', details: parse.error.issues }, { status: 400 });
  }
  const body = parse.data;
  const supabase = createServerClient();

  // ── Branche-check ──
  const { data: branchRow } = await supabase
    .from('branches')
    .select('id, slug, name, is_active')
    .eq('slug', body.branch)
    .maybeSingle();
  if (!branchRow || branchRow.is_active === false) {
    return NextResponse.json({ error: 'Onbekende of inactieve branche' }, { status: 400 });
  }

  // ── Page-ownership-guard (haalt ook page-token op) ──
  let pageToken: string | null = null;
  try {
    pageToken = await getPageAccessToken(body.page_id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Onbekende fout';
    return NextResponse.json({ error: `Kon Meta-pages niet verifiëren: ${msg}` }, { status: 502 });
  }
  if (!pageToken) {
    return NextResponse.json({
      error: 'Page niet toegankelijk',
      details: 'Deze Facebook-page is niet vindbaar in /me/accounts met de huidige Meta-token. Vereiste: pagina-admin + token-scopes pages_show_list + pages_manage_ads.',
    }, { status: 403 });
  }

  // ── Mappen draft → metaMarketingApi payload ──
  // Custom-questions EERST (commitment-escalation) dan prefilled.
  const questions: LeadgenQuestion[] = [];
  for (const q of body.form.custom_questions) {
    questions.push({
      type: 'CUSTOM',
      key: q.key,
      label: q.label,
      options: q.options,
      inline_context: q.inline_context,
    });
  }
  for (const p of body.form.prefilled_fields) {
    questions.push({ type: p });
  }

  const contextCard: LeadgenContextCard | undefined = body.form.context_card
    ? {
        title: body.form.context_card.title,
        content: body.form.context_card.content,
        button_text: body.form.context_card.button_text || 'Verder',
        style: 'PARAGRAPH_STYLE',
      }
    : undefined;

  const thankYou: LeadgenThankYouPage = {
    title: body.form.thank_you_page.title,
    body: body.form.thank_you_page.body,
    button_type: body.form.thank_you_page.button_type,
    button_text: body.form.thank_you_page.button_text,
    website_url: body.form.thank_you_page.website_url,
    business_phone_number: body.form.thank_you_page.business_phone_number,
  };

  const privacy: LeadgenPrivacyPolicy = {
    url: body.form.privacy_policy.url,
    link_text: body.form.privacy_policy.link_text || 'Privacybeleid WarmeLeads',
  };

  // ── Meta API call ──
  let formId: string;
  try {
    const res = await createLeadgenForm(body.page_id, pageToken, {
      name: body.form.name,
      form_type: body.form.form_type,
      locale: body.form.locale,
      questions,
      context_card: contextCard,
      thank_you_page: thankYou,
      privacy_policy: privacy,
      follow_up_action_url: body.form.thank_you_page.website_url || privacy.url,
    });
    formId = res.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Onbekende fout';
    const metaCode = (e as MetaApiError).code;
    const mapped = formatMetaLeadFormCreateError(msg, metaCode);
    return NextResponse.json({
      error: mapped.error,
      hint: mapped.hint,
      details: msg,
      meta_code: metaCode,
    }, { status: 502 });
  }

  // ── branch_fields auto-sync ──
  // Custom-vragen krijgen een rij in branch_fields anders dropt de
  // webhook-intake de answers (zie src/app/api/admin/webhook/leads/route.ts
  // regels 59-73). We doen dit best-effort: faalt het, dan loggen we maar
  // we blokkeren het form-create-pad niet.
  const newBranchFieldRows = body.form.custom_questions.map((q, idx) => ({
    branch_id: branchRow.id,
    key: q.key,
    label: q.label,
    field_type: q.type === 'MULTIPLE_CHOICE' ? 'select' : 'text',
    options: q.options ? q.options.map(o => o.label) : [],
    is_required: false,
    // Plaats nieuwe AI-gegenereerde keys onderaan, na bestaande velden,
    // door sort_order op 1000+idx te zetten — geen botsing met bestaande
    // sort_orders (die starten op 0..N).
    sort_order: 1000 + idx,
  }));

  if (newBranchFieldRows.length > 0) {
    const { error: bfError } = await supabase
      .from('branch_fields')
      .upsert(newBranchFieldRows, { onConflict: 'branch_id,key', ignoreDuplicates: true });
    if (bfError) {
      console.warn('[meta-forms/create] branch_fields upsert faalde', bfError);
    }
  }

  // ── Audit-row schrijven ──
  const { error: auditError } = await supabase
    .from('ai_lead_forms_created')
    .insert({
      form_id: formId,
      page_id: body.page_id,
      branch: body.branch,
      form_name: body.form.name,
      locale: body.form.locale,
      form_type: body.form.form_type,
      questions_count: body.form.custom_questions.length,
      questions_json: questions,
      context_card_json: contextCard ?? null,
      thank_you_page_json: thankYou,
      privacy_policy_url: privacy.url,
      ai_cost_cents: body.ai_cost_cents,
      ai_model: 'gpt-4o',
      created_by: admin.id,
    });
  if (auditError) {
    // Best-effort: form bestaat al in Meta. We loggen, maar geven succes terug.
    console.warn('[meta-forms/create] audit-insert faalde', auditError);
  }

  return NextResponse.json({
    ok: true,
    form_id: formId,
    page_id: body.page_id,
    name: body.form.name,
    questions_count: body.form.custom_questions.length,
  });
}
