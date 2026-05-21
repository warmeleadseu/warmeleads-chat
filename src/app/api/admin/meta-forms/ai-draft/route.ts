/**
 * POST /api/admin/meta-forms/ai-draft
 *
 * Genereert een Meta Lead Form-draft met GPT-4o op basis van branche,
 * doelgroep en adminbrief. Doet GEEN write naar Meta — dat gebeurt
 * separaat via /api/admin/meta-forms/create na admin review/edit.
 *
 * Flow:
 *   1. Body valideren (branche + optionele brief + doelgroep)
 *   2. OpenAI-budget reserveren (~30ct)
 *   3. branch_fields ophalen → AI mag bestaande keys hergebruiken
 *   4. generateLeadFormDraft() aanroepen
 *   5. Draft + bestaande keys teruggeven aan UI voor preview/edit
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { generateLeadFormDraft } from '@/lib/aiLeadFormDesigner';
import { isAiCampaignsEnabled, reserveOpenAIBudget } from '@/lib/aiCampaignBudget';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BodySchema = z.object({
  branch: z.string().min(1),
  audience_problem: z.string().max(1000).optional(),
  audience_motivation: z.string().max(1000).optional(),
  age_min: z.number().int().min(18).max(99).optional(),
  age_max: z.number().int().min(18).max(99).optional(),
  /** 1=M, 2=V; weglaten = beide. */
  genders: z.array(z.number().int()).max(2).optional(),
  countries: z.array(z.string().length(2)).min(1).max(4).default(['NL']),
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

  // ── Branche-check + bestaande branch_fields ophalen ──
  const { data: branchRow } = await supabase
    .from('branches')
    .select('id, slug, name, is_active')
    .eq('slug', body.branch)
    .maybeSingle();
  if (!branchRow || branchRow.is_active === false) {
    return NextResponse.json({ error: 'Onbekende of inactieve branche' }, { status: 400 });
  }

  const { data: branchFields } = await supabase
    .from('branch_fields')
    .select('key, label')
    .eq('branch_id', branchRow.id)
    .order('sort_order', { ascending: true });

  const existingKeys = (branchFields || []).map(f => ({
    key: String(f.key),
    label: String(f.label),
  }));

  // ── OpenAI-budget reserveren (~30ct voor gpt-4o response) ──
  const guard = await reserveOpenAIBudget(body.branch, 35);
  if (!guard.ok) {
    return NextResponse.json({ error: 'OpenAI-budget bereikt', guard }, { status: 402 });
  }

  try {
    const { draft, costCents } = await generateLeadFormDraft({
      branch: body.branch,
      branchName: branchRow.name || branchRow.slug,
      audience_problem: body.audience_problem,
      audience_motivation: body.audience_motivation,
      age_min: body.age_min,
      age_max: body.age_max,
      genders: body.genders,
      countries: body.countries,
      existing_branch_field_keys: existingKeys,
    });

    return NextResponse.json({
      ok: true,
      draft,
      existing_branch_field_keys: existingKeys.map(f => f.key),
      cost_cents: costCents,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Onbekende fout';
    console.error('[ai-draft] generate failed', msg);
    return NextResponse.json({ error: 'AI-draft mislukt', details: msg }, { status: 500 });
  }
}
