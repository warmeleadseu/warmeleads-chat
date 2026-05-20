/**
 * Visual DNA Advisor route.
 *
 * StudioForm roept dit endpoint aan met de actuele waarden uit "Brief"
 * (branche/probleem/motivatie) + "Targeting" (leeftijd/gender/landen/regio's).
 * Wij delegeren naar `suggestVisualDNA` in de advisor-lib en geven een
 * complete VisualDNA + rationale terug, klaar om als state in de UI te zetten.
 *
 * Veiligheid:
 *  - super-admin only;
 *  - master AI-switch moet aan staan;
 *  - per branch een kleine OpenAI-budget reservering (~5 cent) zodat een
 *    misbruikte UI niet ongelimiteerd kan querien.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { isAiCampaignsEnabled, reserveOpenAIBudget } from '@/lib/aiCampaignBudget';
import { suggestVisualDNA } from '@/lib/aiVisualDNAAdvisor';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BodySchema = z.object({
  branch: z.string().min(1),
  audience_problem: z.string().max(2000).optional(),
  audience_motivation: z.string().max(2000).optional(),
  form_questions_count: z.number().int().nonnegative().nullable().optional(),
  targeting: z.object({
    countries: z.array(z.string()).min(1).default(['NL']),
    regions: z.array(z.object({ key: z.string().optional(), name: z.string() })).optional(),
    age_min: z.number().int().min(13).max(99).nullable().optional(),
    age_max: z.number().int().min(13).max(99).nullable().optional(),
    genders: z.array(z.number().int()).nullable().optional(),
  }),
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
  const { data: branchRow } = await supabase
    .from('branches')
    .select('slug, name, is_active')
    .eq('slug', body.branch)
    .maybeSingle();
  if (!branchRow || branchRow.is_active === false) {
    return NextResponse.json({ error: 'Onbekende of inactieve branche' }, { status: 400 });
  }

  // Kleine reservering — gpt-4o-mini visual-dna call ligt rond 1-3 cent.
  // We reserveren 5 cent zodat hier echt geen runaway-loop kan ontstaan.
  const guard = await reserveOpenAIBudget(body.branch, 5);
  if (!guard.ok) {
    return NextResponse.json({ error: 'OpenAI-budget bereikt', guard }, { status: 402 });
  }

  try {
    const result = await suggestVisualDNA({
      branch: body.branch,
      branchName: branchRow.name,
      audienceProblem: body.audience_problem ?? null,
      audienceMotivation: body.audience_motivation ?? null,
      formQuestionsCount: body.form_questions_count ?? null,
      targeting: {
        countries: body.targeting.countries,
        regions: body.targeting.regions,
        age_min: body.targeting.age_min ?? null,
        age_max: body.targeting.age_max ?? null,
        genders: body.targeting.genders ?? null,
      },
    });

    return NextResponse.json({
      ok: true,
      dna: result.dna,
      rationale: result.rationale,
      cost_cents: result.costCents,
      model: result.model,
      source: result.source,
      fallback_reason: result.fallbackReason ?? null,
    });
  } catch (e) {
    return NextResponse.json({
      error: 'Advisor faalde',
      details: (e as Error).message,
    }, { status: 502 });
  }
}
