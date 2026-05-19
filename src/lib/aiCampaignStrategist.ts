/**
 * AI Campaign Strategist
 * ----------------------
 * Genereert per launch een complete "battle-plan":
 *   N campagnes (één per angle) → M ad sets (één per targeting-strategie) → K creative briefs
 *
 * Werkt met GPT-4o (niet mini — strategisch redeneren is belangrijker
 * dan kosten besparen; één call per launch ~30-50 cent).
 *
 * Het output is bewust kale JSON die de launch-route 1:1 vertaalt naar
 * Meta-creates. De LLM krijgt als context:
 *  - branche + persona-hints uit BRANCH_HINTS
 *  - doel-CPL, dagbudget, doelgebied
 *  - aantal interests/behaviors die we al weten (uit cache)
 *  - of er een lookalike audience beschikbaar is
 *  - strategy_params (angles, adsets_per_angle, creatives_per_adset)
 *
 * Output:
 *   {
 *     campaigns: [
 *       {
 *         angle, rationale, daily_budget_share,
 *         adsets: [
 *           {
 *             strategy_type, name, predicted_cpl_cents,
 *             targeting: { age_min, age_max, genders, interests:[{id,name}], ... },
 *             creative_brief: { style, framework, tone, hook, must_include, must_avoid }
 *           }
 *         ]
 *       }
 *     ],
 *     overall_rationale, predicted_avg_cpl_cents
 *   }
 */
import { z } from 'zod';
import {
  estimateTextCostCents,
  getOpenAIClient,
  logOpenAIUsage,
  withOpenAIRetry,
  type SupportedTextModel,
} from '@/lib/openaiClient';

// ── Public types ─────────────────────────────────────────────
export type StrategyType = 'broad' | 'interest' | 'behavior' | 'lookalike' | 'retargeting_excl' | 'advantage';
export type CreativeStyle = 'lifestyle' | 'product_closeup' | 'emotional' | 'social_proof' | 'infographic';
export type Framework = 'PAS' | 'AIDA' | 'BAB' | 'FAB' | '4U';

export interface StrategistTargetingSpec {
  age_min: number;
  age_max: number;
  genders?: number[];                      // [1]=M, [2]=V; weggelaten = beide
  interests?: Array<{ id: string; name: string }>;
  behaviors?: Array<{ id: string; name: string }>;
  custom_audiences?: Array<{ id: string; name: string }>;
  excluded_custom_audiences?: Array<{ id: string; name: string }>;
  locales?: number[];                       // Meta locale-codes
  regions?: Array<{ key: string; name: string }>;
  zoek_keywords?: string[];                 // optionele lijst aan keywords waarop interests gezocht moeten worden (gebruikt na strategist)
}

export interface CreativeBrief {
  style: CreativeStyle;
  framework: Framework;
  tone: string;                              // bv. "urgent maar geruststellend"
  hook: string;                              // openingszin / visual cue
  must_include?: string[];                   // proof points, USPs
  must_avoid?: string[];                     // taboe-woorden specifiek voor deze branche
}

export interface PlannedAdSet {
  strategy_type: StrategyType;
  name: string;
  rationale: string;
  predicted_cpl_cents: number;
  targeting: StrategistTargetingSpec;
  creative_brief: CreativeBrief;
}

export interface PlannedCampaign {
  angle: string;                              // bv. "ROI/besparing"
  rationale: string;                          // waarom deze angle voor deze branche
  daily_budget_share: number;                 // 0..1, AI verdeelt budget
  adsets: PlannedAdSet[];
}

export interface CampaignStrategy {
  campaigns: PlannedCampaign[];
  overall_rationale: string;
  predicted_avg_cpl_cents: number;
}

export interface StrategistInput {
  brief: {
    id: string;
    branch: string;
    branchName?: string;
    countries: string[];
    regions?: Array<{ key: string; name: string }>;
    daily_budget_cents: number;
    target_cpl_cents?: number | null;
    target_audience?: Record<string, unknown>;
    form_questions_count?: number | null;
  };
  params: {
    angles: number;                           // 2-5
    adsets_per_angle: number;                 // 1-3
    creatives_per_adset: number;              // 2-5
    use_lookalike: boolean;
    use_exclusion: boolean;
    age_min?: number;
    age_max?: number;
    genders?: number[];
  };
  available?: {
    lookalike_audience_id?: string | null;
    exclusion_audience_id?: string | null;
    branch_lead_count?: number;
    known_interests?: Array<{ id: string; name: string; topic?: string }>;
    known_behaviors?: Array<{ id: string; name: string }>;
  };
}

// ── Branche-hints (persona + USP-cues) ───────────────────────
// Deze cues sturen de strategist naar realistische angles. Geen
// hard-coded copy; we geven alleen de richting.
interface BranchHint {
  persona: string;
  motivations: string[];
  objections: string[];
  qualifying_signals: string[];
  default_interest_keywords: string[];
  default_age_min?: number;
  default_age_max?: number;
}

export const BRANCH_HINTS: Record<string, BranchHint> = {
  thuisbatterij: {
    persona: 'Huiseigenaar 35-65 met zonnepanelen of plannen ervoor, woont in koop, milieubewust + ROI-gedreven',
    motivations: [
      'afschaffing salderingsregeling 2027',
      'pieken zelf opvangen ipv terugleveren tegen lage prijs',
      'energieonafhankelijkheid',
      'rendement op opgewekte stroom',
      'dynamische energiecontracten',
    ],
    objections: ['terugverdientijd', 'investering vooraf', 'subsidiezekerheid'],
    qualifying_signals: ['eigen woning', 'zonnepanelen aanwezig', 'minimum jaarverbruik'],
    default_interest_keywords: ['Zonnepanelen', 'Duurzame energie', 'Energiebesparing', 'Smart home', 'Elektrische auto'],
    default_age_min: 30,
    default_age_max: 65,
  },
  airco: {
    persona: 'Huiseigenaar 35-70, comfort-gericht, hitte-perioden zomer of koude winters',
    motivations: ['hittegolven & slaapcomfort', 'verwarming via warmtepomp-airco', 'energiezuinig koelen', 'subsidie ISDE'],
    objections: ['installatiekosten', 'geluidsoverlast', 'esthetiek'],
    qualifying_signals: ['eigen woning', 'geen bestaande airco', 'budget >2000'],
    default_interest_keywords: ['Airconditioning', 'Warmtepomp', 'Klimaatbeheersing', 'Huiseigenaar'],
    default_age_min: 35,
    default_age_max: 70,
  },
  zonnepanelen: {
    persona: 'Huiseigenaar 30-65, ROI-gedreven, energierekening-bewust',
    motivations: ['besparen op energierekening', 'snelle terugverdientijd', 'duurzaam', 'koopwoning waardevermeerdering'],
    objections: ['dak geschikt?', 'kosten installatie', 'esthetiek', 'salderingsregeling'],
    qualifying_signals: ['eigen woning', 'dakoppervlak ≥20m²', 'jaarverbruik ≥2500 kWh'],
    default_interest_keywords: ['Zonnepanelen', 'Duurzaamheid', 'Energietransitie', 'Eigen huis'],
    default_age_min: 30,
    default_age_max: 65,
  },
  warmtepomp: {
    persona: 'Huiseigenaar 35-65 die van gas af wil of moet (gasloze nieuwbouw / verplichte verduurzaming)',
    motivations: ['gasloos wonen', 'ISDE-subsidie', 'lagere stookkosten op lange termijn', 'CO2-besparing'],
    objections: ['hoge initiële kosten', 'geluidsoverlast buitendeel', 'isolatie-eisen woning'],
    qualifying_signals: ['eigen woning', 'gasaansluiting nu', 'goed geïsoleerd'],
    default_interest_keywords: ['Warmtepomp', 'Energiebesparing', 'Duurzaam wonen', 'Huiseigenaar'],
    default_age_min: 35,
    default_age_max: 65,
  },
};

function getBranchHint(branch: string): BranchHint {
  return BRANCH_HINTS[branch] || {
    persona: 'Huiseigenaar 30-65 in Nederland/België',
    motivations: ['besparen', 'comfort', 'duurzaamheid'],
    objections: ['kosten', 'complexiteit'],
    qualifying_signals: ['eigen woning'],
    default_interest_keywords: ['Eigen huis', 'Woningverbetering'],
    default_age_min: 30,
    default_age_max: 65,
  };
}

// ── JSON schema voor strict-mode response_format ─────────────
const TargetingSchema = z.object({
  age_min: z.number().int().min(18).max(65),
  age_max: z.number().int().min(18).max(99),
  genders: z.array(z.number().int()).optional(),
  interests: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
  behaviors: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
  custom_audiences: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
  excluded_custom_audiences: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
  locales: z.array(z.number().int()).optional(),
  regions: z.array(z.object({ key: z.string(), name: z.string() })).optional(),
  zoek_keywords: z.array(z.string()).optional(),
});

const CreativeBriefSchema = z.object({
  style: z.enum(['lifestyle', 'product_closeup', 'emotional', 'social_proof', 'infographic']),
  framework: z.enum(['PAS', 'AIDA', 'BAB', 'FAB', '4U']),
  tone: z.string().min(3).max(80),
  hook: z.string().min(5).max(200),
  must_include: z.array(z.string()).optional(),
  must_avoid: z.array(z.string()).optional(),
});

const AdSetSchema = z.object({
  strategy_type: z.enum(['broad', 'interest', 'behavior', 'lookalike', 'retargeting_excl', 'advantage']),
  name: z.string().min(3).max(80),
  rationale: z.string().min(5).max(300),
  predicted_cpl_cents: z.number().int().min(50).max(20000),
  targeting: TargetingSchema,
  creative_brief: CreativeBriefSchema,
});

const CampaignPlanSchema = z.object({
  angle: z.string().min(3).max(80),
  rationale: z.string().min(5).max(400),
  // We renormaliseren later naar 1.0, dus geen strikte 0.05 ondergrens.
  daily_budget_share: z.number().min(0).max(1),
  adsets: z.array(AdSetSchema).min(1).max(5),
});

const StrategySchema = z.object({
  campaigns: z.array(CampaignPlanSchema).min(1).max(6),
  overall_rationale: z.string().min(10).max(800),
  predicted_avg_cpl_cents: z.number().int().min(50).max(20000),
});

// ── System prompt ────────────────────────────────────────────
function buildSystemPrompt(input: StrategistInput): string {
  const hint = getBranchHint(input.brief.branch);
  const branch = input.brief.branchName || input.brief.branch;
  const budget = (input.brief.daily_budget_cents / 100).toFixed(2);
  const targetCpl = input.brief.target_cpl_cents != null ? `EUR ${(input.brief.target_cpl_cents / 100).toFixed(2)}` : 'niet gespecificeerd (zo laag mogelijk)';

  const lookalikeNote = input.params.use_lookalike && input.available?.lookalike_audience_id
    ? `Beschikbaar: lookalike-audience (1% van ${input.available.branch_lead_count || '?'} eigen ${branch}-leads, id=${input.available.lookalike_audience_id})`
    : input.params.use_lookalike
      ? 'GEEN lookalike beschikbaar — sla lookalike-strategie over of stel het uit'
      : 'Lookalike-strategie uitgeschakeld';

  const exclusionNote = input.params.use_exclusion && input.available?.exclusion_audience_id
    ? `Auto-exclude bestaande ${branch}-leads (90d, id=${input.available.exclusion_audience_id}) — voeg dit aan ELKE ad set toe`
    : 'Geen auto-exclude actief';

  const interestList = (input.available?.known_interests || [])
    .slice(0, 30)
    .map(i => `  - ${i.name} (id=${i.id})${i.topic ? ` [${i.topic}]` : ''}`)
    .join('\n');

  return [
    'Je bent een senior Meta Ads strategist met 10+ jaar ervaring in lead-generatie',
    'voor energiebranches (zonnepanelen, thuisbatterij, warmtepomp, airco) in NL/BE.',
    '',
    'Je taak: ontwerp een complete battle-plan dat zoveel mogelijk gekwalificeerde',
    'lead-formulieren binnen het budget oplevert. We genereren leads via Meta Lead',
    'Forms — er is GEEN landingspagina, mensen vullen het formulier in op Meta zelf.',
    '',
    'CONTEXT:',
    `- Branche: ${branch}`,
    `- Doelgebied: ${input.brief.countries.join(', ')}`,
    `- Persona: ${hint.persona}`,
    `- Motivaties: ${hint.motivations.join('; ')}`,
    `- Bezwaren: ${hint.objections.join('; ')}`,
    `- Kwalificerende signalen: ${hint.qualifying_signals.join('; ')}`,
    `- Daily budget: EUR ${budget} (jij verdeelt dit over de campagnes)`,
    `- Doel-CPL: ${targetCpl}`,
    `- Aantal kwalificatievragen in formulier: ${input.brief.form_questions_count ?? 'onbekend'}`,
    `- ${lookalikeNote}`,
    `- ${exclusionNote}`,
    '',
    'STRUCTUUR DIE JE MOET ONTWERPEN:',
    `- Exact ${input.params.angles} campagnes, elk met een UNIEK angle (geen overlap)`,
    `- Per campagne exact ${input.params.adsets_per_angle} ad sets, elk met een ANDER strategy_type`,
    `- strategy_type opties: broad (geen interest-targeting), interest (1-4 interests via flexible_spec),`,
    `  behavior, lookalike (alleen als beschikbaar), advantage (= Meta Advantage+ Audience suggestie)`,
    `- daily_budget_share van alle campagnes MOET samen 1.00 zijn (binnen 0.01 tolerantie)`,
    '',
    'ANGLES (kies de sterkste 3-5 voor deze branche, varieer in framing):',
    '- ROI/besparing — "verdien je investering terug in X jaar"',
    '- Urgentie/regelgeving — "salderingsregeling stopt, NU profiteren"',
    '- Comfort/levensstandaard — "altijd warm/koel/onafhankelijk"',
    '- Status/voorlopers — "veel buurtgenoten doen het al"',
    '- Expertise/zorg — "laat een specialist meekijken"',
    '- FOMO/schaarste — "subsidiepot loopt leeg"',
    '- Risicovermijding — "voorkom hoge stookkosten 2027+"',
    '',
    'TARGETING-MIX RICHTLIJNEN:',
    `- Default leeftijd: ${input.params.age_min || hint.default_age_min || 30}-${input.params.age_max || hint.default_age_max || 65}`,
    '- broad: laat Meta\'s algoritme leren — alleen geo+leeftijd+(soms) gender',
    '- interest: max 4 interests, kies disjuncte clusters (geen overlap met broad target)',
    '- behavior: gebruik alleen als je echt een sterke behavior-match weet (bv. "Engaged shoppers")',
    '- lookalike: 1% lookalike van eigen leads, geen extra interest erbovenop (anders verklein je de pool)',
    '- advantage: vermeld "Advantage+ Audience" — gebruikt onze targeting als suggestie',
    '',
    'CREATIVE BRIEF PER AD SET:',
    '- style:',
    '  - lifestyle: mensen genieten van hun woning/auto/comfort, warm sfeervol licht',
    '  - product_closeup: het product (batterij, paneel, unit) elegant in beeld',
    '  - emotional: gezin, kinderen, geborgenheid (geen herkenbare gezichten!)',
    '  - social_proof: huis met buren, straat, "veel mensen kiezen hiervoor"',
    '  - infographic: visuele cijfers, ROI-grafiek, schematische besparing',
    '- framework:',
    '  - PAS (Problem-Agitate-Solution): goed voor urgentie & risicomijding',
    '  - AIDA (Attention-Interest-Desire-Action): klassiek, breed inzetbaar',
    '  - BAB (Before-After-Bridge): goed voor besparing/comfort',
    '  - FAB (Features-Advantages-Benefits): voor educatief geïnformeerde doelgroep',
    '  - 4U (Useful-Urgent-Unique-Ultra-specific): voor FOMO/schaarste',
    '- hook: precies de eerste zin / visual idee — moet attention-grabbing zijn',
    '- must_include: 2-4 concrete proof points / USPs uit deze branche',
    '- must_avoid: branche-specifieke taboes (geen valse beloftes, geen "100%")',
    '',
    'CPL-PREDICTIE:',
    '- Predict realistisch per ad set in CENTEN.',
    '- Broad = vaak duurste in begin maar groter potentieel.',
    '- Lookalike = vaak goedkoopste CPL als de seed-data goed is.',
    '- Interest = middelmatig.',
    '- predicted_avg_cpl_cents = budget-weighted gemiddelde over alle ad sets.',
    '',
    interestList ? 'BESCHIKBARE INTERESTS (gebruik deze IDs waar passend):' : '',
    interestList,
    '',
    'OUTPUT: enkel JSON volgens response_format. Geen prose buiten JSON.',
  ].filter(Boolean).join('\n');
}

function buildUserPrompt(input: StrategistInput): string {
  return JSON.stringify({
    instructie: 'Genereer het battle-plan volgens response_format schema.',
    extra_context: input.brief.target_audience ?? {},
    params: input.params,
  });
}

// ── JSON schema (strict mode voor GPT-4o) ────────────────────
const STRATEGY_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['campaigns', 'overall_rationale', 'predicted_avg_cpl_cents'],
  properties: {
    campaigns: {
      type: 'array',
      minItems: 1,
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['angle', 'rationale', 'daily_budget_share', 'adsets'],
        properties: {
          angle: { type: 'string' },
          rationale: { type: 'string' },
          daily_budget_share: { type: 'number' },
          adsets: {
            type: 'array',
            minItems: 1,
            maxItems: 5,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['strategy_type', 'name', 'rationale', 'predicted_cpl_cents', 'targeting', 'creative_brief'],
              properties: {
                strategy_type: { type: 'string', enum: ['broad', 'interest', 'behavior', 'lookalike', 'retargeting_excl', 'advantage'] },
                name: { type: 'string' },
                rationale: { type: 'string' },
                predicted_cpl_cents: { type: 'integer' },
                targeting: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['age_min', 'age_max'],
                  properties: {
                    age_min: { type: 'integer' },
                    age_max: { type: 'integer' },
                    genders: { type: 'array', items: { type: 'integer' } },
                    interests: { type: 'array', items: {
                      type: 'object', additionalProperties: false,
                      required: ['id', 'name'],
                      properties: { id: { type: 'string' }, name: { type: 'string' } },
                    } },
                    behaviors: { type: 'array', items: {
                      type: 'object', additionalProperties: false,
                      required: ['id', 'name'],
                      properties: { id: { type: 'string' }, name: { type: 'string' } },
                    } },
                    custom_audiences: { type: 'array', items: {
                      type: 'object', additionalProperties: false,
                      required: ['id', 'name'],
                      properties: { id: { type: 'string' }, name: { type: 'string' } },
                    } },
                    excluded_custom_audiences: { type: 'array', items: {
                      type: 'object', additionalProperties: false,
                      required: ['id', 'name'],
                      properties: { id: { type: 'string' }, name: { type: 'string' } },
                    } },
                    locales: { type: 'array', items: { type: 'integer' } },
                    regions: { type: 'array', items: {
                      type: 'object', additionalProperties: false,
                      required: ['key', 'name'],
                      properties: { key: { type: 'string' }, name: { type: 'string' } },
                    } },
                    zoek_keywords: { type: 'array', items: { type: 'string' } },
                  },
                },
                creative_brief: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['style', 'framework', 'tone', 'hook'],
                  properties: {
                    style: { type: 'string', enum: ['lifestyle', 'product_closeup', 'emotional', 'social_proof', 'infographic'] },
                    framework: { type: 'string', enum: ['PAS', 'AIDA', 'BAB', 'FAB', '4U'] },
                    tone: { type: 'string' },
                    hook: { type: 'string' },
                    must_include: { type: 'array', items: { type: 'string' } },
                    must_avoid: { type: 'array', items: { type: 'string' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    overall_rationale: { type: 'string' },
    predicted_avg_cpl_cents: { type: 'integer' },
  },
} as const;

// ── Public entrypoint ────────────────────────────────────────
export async function planStrategy(input: StrategistInput): Promise<{
  strategy: CampaignStrategy;
  costCents: number;
}> {
  const client = getOpenAIClient();
  if (!client) {
    throw new Error('OpenAI niet geconfigureerd');
  }

  const model: SupportedTextModel = 'gpt-4o';
  const systemPrompt = buildSystemPrompt(input);
  const userPrompt = buildUserPrompt(input);

  const completion = await withOpenAIRetry(() =>
    client.chat.completions.create({
      model,
      temperature: 0.6,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          // strict:true vereist dat ELKE property in required staat én geen
          // additionalProperties heeft. Onze targeting heeft veel optionele
          // velden (interests/behaviors/locales/...). We kiezen voor
          // strict:false + Zod-validatie achteraf voor flexibiliteit.
          name: 'campaign_strategy',
          strict: false,
          schema: STRATEGY_JSON_SCHEMA,
        },
      },
    }),
  );

  const raw = completion.choices?.[0]?.message?.content;
  if (!raw) throw new Error('Strategist gaf geen content terug');
  let parsed: CampaignStrategy;
  try {
    const json = JSON.parse(raw);
    parsed = StrategySchema.parse(json) as CampaignStrategy;
  } catch (e) {
    throw new Error(`Strategy JSON ongeldig: ${(e as Error).message}`);
  }

  // Normalisatie: daily_budget_share moet ~1 zijn. Re-normaliseer als dat niet zo is.
  const totalShare = parsed.campaigns.reduce((s, c) => s + c.daily_budget_share, 0);
  if (Math.abs(totalShare - 1) > 0.01 && totalShare > 0) {
    parsed.campaigns = parsed.campaigns.map(c => ({
      ...c,
      daily_budget_share: Math.round((c.daily_budget_share / totalShare) * 1000) / 1000,
    }));
  }

  const usage = completion.usage;
  const inputTokens = usage?.prompt_tokens ?? 0;
  const outputTokens = usage?.completion_tokens ?? 0;
  const costCents = estimateTextCostCents(model, inputTokens, outputTokens);

  await logOpenAIUsage({
    briefId: input.brief.id,
    branch: input.brief.branch,
    kind: 'copy',
    model,
    costCents,
    inputTokens,
    outputTokens,
    metadata: {
      kind: 'strategist',
      angles: input.params.angles,
      adsets_per_angle: input.params.adsets_per_angle,
      predicted_avg_cpl_cents: parsed.predicted_avg_cpl_cents,
    },
  });

  return { strategy: parsed, costCents };
}

// ── Internal exports for tests ───────────────────────────────
export const __internal = {
  buildSystemPrompt,
  buildUserPrompt,
  StrategySchema,
  getBranchHint,
};
