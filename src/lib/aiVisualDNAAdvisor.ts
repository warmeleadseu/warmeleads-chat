/**
 * AI Visual DNA Advisor.
 *
 * Op basis van de "brief" (branche, probleem doelgroep, motivatie) en het
 * targeting-spec (leeftijd, gender, landen, regio's) laat dit module een
 * lichtgewicht OpenAI-model een complete `VisualDNA` voorstellen — inclusief:
 *   - chip-selecties die binnen onze enums passen (deterministisch, geen
 *     verrassingen in downstream prompts of in de StudioForm UI);
 *   - vrije velden waar de AI extra concepten/aandachtspunten kan opschrijven
 *     die nét niet in de chip-lijst staan (must_include, must_avoid,
 *     example_overlays, brand_identity). Zo "voegt de AI nieuwe opties toe"
 *     zonder dat we onze typed enum hoeven open te breken.
 *
 * De output is een complete VisualDNA en een korte rationale-string. Beide
 * worden door de StudioForm getoond zodat de admin precies ziet wat de AI
 * heeft besloten en waarom, en eventueel kan tweaken.
 *
 * Belangrijk: dit is een advies-stap. De waarheid voor de uiteindelijke
 * strategist + image-generator blijft het VisualDNA-object dat de StudioForm
 * doorstuurt — wij persisten het advies niet zelf in de DB.
 */
import { z } from 'zod';
import {
  VISUAL_STYLES,
  AUDIENCE_LOOKS,
  SETTINGS,
  MOODS,
  COLOR_FOCUSES,
  OVERLAY_FREQUENCIES,
  buildDefaultVisualDNA,
  getBranchVisualDefaults,
  type VisualDNA,
} from './aiVisualDNA';
import {
  getOpenAIClient,
  withOpenAIRetry,
  estimateTextCostCents,
  logOpenAIUsage,
  type SupportedTextModel,
} from './openaiClient';

// ── Public input/output shape ────────────────────────────────

export interface AdvisorInput {
  branch: string;
  branchName?: string | null;
  audienceProblem?: string | null;
  audienceMotivation?: string | null;
  /** Optioneel: brief uit lead form (aantal vragen + andere context) */
  formQuestionsCount?: number | null;
  targeting: {
    countries: string[];
    regions?: Array<{ key?: string; name: string }>;
    age_min?: number | null;
    age_max?: number | null;
    /** Meta gender codes: [1]=men, [2]=women, undefined=alle */
    genders?: number[] | null;
  };
}

export interface AdvisorOutput {
  dna: VisualDNA;
  rationale: string;
  costCents: number;
  model: SupportedTextModel;
}

// ── Zod schema voor wat OpenAI ons mag teruggeven ────────────

const AdvisorJsonSchema = z.object({
  audience_looks: z.array(z.enum(AUDIENCE_LOOKS)).max(AUDIENCE_LOOKS.length),
  settings: z.array(z.enum(SETTINGS)).max(SETTINGS.length),
  moods: z.array(z.enum(MOODS)).max(MOODS.length),
  color_focuses: z.array(z.enum(COLOR_FOCUSES)).max(COLOR_FOCUSES.length),
  styles_enabled: z.array(z.enum(VISUAL_STYLES)).max(VISUAL_STYLES.length),
  overlay_frequency: z.enum(OVERLAY_FREQUENCIES),
  must_include: z.array(z.string().min(1).max(120)).max(20),
  must_avoid: z.array(z.string().min(1).max(120)).max(20),
  brand_identity: z.string().max(500),
  example_overlays: z.array(z.string().min(1).max(60)).max(20),
  rationale: z.string().min(1).max(500),
});

type AdvisorJson = z.infer<typeof AdvisorJsonSchema>;

const OPENAI_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'audience_looks',
    'settings',
    'moods',
    'color_focuses',
    'styles_enabled',
    'overlay_frequency',
    'must_include',
    'must_avoid',
    'brand_identity',
    'example_overlays',
    'rationale',
  ],
  properties: {
    audience_looks: { type: 'array', items: { type: 'string', enum: [...AUDIENCE_LOOKS] } },
    settings: { type: 'array', items: { type: 'string', enum: [...SETTINGS] } },
    moods: { type: 'array', items: { type: 'string', enum: [...MOODS] } },
    color_focuses: { type: 'array', items: { type: 'string', enum: [...COLOR_FOCUSES] } },
    styles_enabled: { type: 'array', items: { type: 'string', enum: [...VISUAL_STYLES] } },
    overlay_frequency: { type: 'string', enum: [...OVERLAY_FREQUENCIES] },
    must_include: { type: 'array', items: { type: 'string' } },
    must_avoid: { type: 'array', items: { type: 'string' } },
    brand_identity: { type: 'string' },
    example_overlays: { type: 'array', items: { type: 'string' } },
    rationale: { type: 'string' },
  },
} as const;

// ── Prompt-bouw ───────────────────────────────────────────────

function describeGender(genders?: number[] | null): string {
  if (!genders || genders.length === 0) return 'alle genders';
  const hasM = genders.includes(1);
  const hasF = genders.includes(2);
  if (hasM && hasF) return 'alle genders';
  if (hasM) return 'mannen';
  if (hasF) return 'vrouwen';
  return 'alle genders';
}

function describeTargeting(input: AdvisorInput): string {
  const t = input.targeting;
  const lines: string[] = [];
  lines.push(`- Landen: ${t.countries.join(', ') || 'NL'}`);
  if (t.regions && t.regions.length > 0) {
    lines.push(`- Regio's: ${t.regions.map(r => r.name).slice(0, 10).join(', ')}${t.regions.length > 10 ? '…' : ''}`);
  }
  const ageMin = t.age_min ?? null;
  const ageMax = t.age_max ?? null;
  if (ageMin != null && ageMax != null) {
    lines.push(`- Leeftijd: ${ageMin}-${ageMax}`);
  }
  lines.push(`- Gender: ${describeGender(t.genders)}`);
  return lines.join('\n');
}

function buildSystemPrompt(): string {
  return [
    'Je bent een senior creative director voor Facebook Lead Ads in de Nederlandse/Belgische woningmarkt.',
    'Op basis van een branche-brief en doelgroep-targeting stel je het "Visueel DNA" samen waarmee onze AI vervolgens scroll-stoppende advertenties maakt.',
    'Je bent extreem concreet en pragmatisch — geen hype-taal, alleen keuzes die meetbaar converteren.',
    '',
    'Outputregels (KRITIEK):',
    '1. Alle chip-velden (audience_looks, settings, moods, color_focuses, styles_enabled) MOETEN strikt uit de bijgeleverde enum-waarden komen. Geen synoniemen, geen vertalingen.',
    '2. Kies per chip-categorie 3-6 waarden — geen lange lijsten. Liever scherp dan inclusief.',
    '3. Voor styles_enabled: kies 4-7 stijlen die binnen de branche/doelgroep echt converteren. Mix bewust 2-3 overlay-vriendelijke stijlen (bold_promo, price_badge, urgency_banner, testimonial_card, data_visual, infographic) met 2-3 natuurlijke stijlen (lifestyle, product_closeup, emotional, social_proof).',
    '4. overlay_frequency: kies "ai_decides" tenzij de motivatie een duidelijke deadline/prijsclaim heeft — dan "mixed" of "high".',
    '5. must_include: 2-5 visuele concrete elementen die in beeld TERUGKOMEN (bv. "Nederlandse rijwoning", "rood pannendak", "modern energielabel-paneel"). Hier MAG je nieuwe concepten toevoegen die niet bestaan als chip — die worden tekstueel in de image-prompts gebruikt.',
    '6. must_avoid: 1-4 elementen die we structureel WEREN (bv. "stockfoto-glimlach", "voor-na splitscreens", "kinderen zonder ouder erbij").',
    '7. example_overlays: 4-6 voorbeeld overlay-teksten in HOOFDLETTERS, 3-6 woorden, scroll-stoppers (deadline/prijs/gratis/besparing) gebaseerd op de motivatie.',
    '8. brand_identity: 1-2 zinnen die het visuele "merkgevoel" vastleggen voor deze branche+doelgroep (bv. "Eerlijk Nederlands middenklasse-huishouden, geen overdreven luxe").',
    '9. rationale: 1 alinea (max 4 zinnen NL) waarin je uitlegt waarom deze combinatie van keuzes converteert voor deze doelgroep.',
    '',
    'Belangrijk: vermijd dezelfde generieke selecties voor elke briefing — gebruik écht de doelgroep-leeftijd, het probleem en de motivatie om verschil te maken.',
  ].join('\n');
}

function buildUserPrompt(input: AdvisorInput): string {
  const branchDefaults = getBranchVisualDefaults(input.branch);
  return [
    `Branche: ${input.branchName || input.branch}`,
    '',
    'Doelgroep brief:',
    `- Probleem: ${input.audienceProblem?.trim() || '(niet gespecificeerd)'}`,
    `- Motivatie/trigger: ${input.audienceMotivation?.trim() || '(niet gespecificeerd)'}`,
    input.formQuestionsCount != null ? `- Lead form heeft ${input.formQuestionsCount} kwalificatie-vraag/-vragen.` : '',
    '',
    'Targeting:',
    describeTargeting(input),
    '',
    'Branche-context (huidige defaults, je MAG hiervan afwijken als de doelgroep daarom vraagt):',
    `- audience_looks: ${branchDefaults.audience_looks.join(', ')}`,
    `- settings: ${branchDefaults.settings.join(', ')}`,
    `- moods: ${branchDefaults.moods.join(', ')}`,
    `- color_focuses: ${branchDefaults.color_focuses.join(', ')}`,
    `- styles_enabled: ${branchDefaults.styles_enabled.join(', ')}`,
    `- voorbeeld overlays: ${branchDefaults.example_overlays.join(', ')}`,
    branchDefaults.brand_identity_hint ? `- merkidentiteit-hint: ${branchDefaults.brand_identity_hint}` : '',
    '',
    'Geef nu het optimale Visueel DNA in JSON volgens het schema.',
  ].filter(Boolean).join('\n');
}

// ── Public entrypoint ────────────────────────────────────────

/**
 * Vraagt OpenAI om een complete VisualDNA. Faalt het OF is OpenAI niet
 * geconfigureerd, dan vallen we terug op `buildDefaultVisualDNA(branch)` en
 * loggen een waarschuwing. Wij gooien dus NOOIT — de StudioForm krijgt
 * altijd iets werkends terug.
 */
export async function suggestVisualDNA(input: AdvisorInput): Promise<AdvisorOutput> {
  const branchFallback = buildDefaultVisualDNA(input.branch);
  const client = getOpenAIClient();
  const fallback: AdvisorOutput = {
    dna: branchFallback,
    rationale: 'OpenAI niet beschikbaar — branche-defaults gebruikt.',
    costCents: 0,
    model: 'gpt-4o-mini',
  };
  if (!client) return fallback;

  const model: SupportedTextModel = 'gpt-4o-mini';
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(input);

  let parsed: AdvisorJson | null = null;
  let inputTokens = 0;
  let outputTokens = 0;
  try {
    const completion = await withOpenAIRetry(() =>
      client.chat.completions.create({
        model,
        temperature: 0.5,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'visual_dna_advice',
            strict: true,
            schema: OPENAI_JSON_SCHEMA,
          },
        },
      }),
    );
    const raw = completion.choices?.[0]?.message?.content;
    if (raw) {
      const json = JSON.parse(raw);
      parsed = AdvisorJsonSchema.parse(json);
    }
    inputTokens = completion.usage?.prompt_tokens ?? 0;
    outputTokens = completion.usage?.completion_tokens ?? 0;
  } catch (e) {
    console.warn('[visual-dna-advisor] OpenAI faalde, fallback op defaults:', (e as Error).message);
    return fallback;
  }

  if (!parsed) return fallback;

  const dna: VisualDNA = {
    audience_looks: parsed.audience_looks,
    settings: parsed.settings,
    moods: parsed.moods,
    color_focuses: parsed.color_focuses,
    styles_enabled: parsed.styles_enabled,
    overlay_frequency: parsed.overlay_frequency,
    must_include: parsed.must_include,
    must_avoid: parsed.must_avoid,
    brand_identity: parsed.brand_identity,
    example_overlays: parsed.example_overlays,
  };

  const costCents = estimateTextCostCents(model, inputTokens, outputTokens);

  await logOpenAIUsage({
    branch: input.branch,
    kind: 'copy',
    model,
    costCents,
    inputTokens,
    outputTokens,
    metadata: {
      kind: 'visual_dna_advisor',
      audience_looks: parsed.audience_looks.length,
      styles_enabled: parsed.styles_enabled.length,
      overlay_frequency: parsed.overlay_frequency,
    },
  });

  return {
    dna,
    rationale: parsed.rationale,
    costCents,
    model,
  };
}

// ── Internals voor tests ────────────────────────────────────

export const __internal = {
  buildSystemPrompt,
  buildUserPrompt,
  AdvisorJsonSchema,
  OPENAI_JSON_SCHEMA,
};
