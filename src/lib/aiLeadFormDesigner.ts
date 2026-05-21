/**
 * AI Lead Form Designer
 * ---------------------
 * Genereert een Meta Lead Form draft op basis van branche, doelgroep en
 * adminbrief. Door de strategist te voeden met `BRANCH_HINTS` en harde
 * Meta-best-practice regels krijgen we kwalificerende vragen die exact
 * passen bij de WarmeLeads-funnel.
 *
 * Output is een Zod-gevalideerde struct die 1:1 door
 * `createLeadgenForm()` (metaMarketingApi) wordt vertaald.
 *
 * Belangrijkste design-keuzes:
 *  - Custom vragen MOETEN VÓÓR prefilled-vragen komen (commitment-escalation
 *    — eerst kwalificeren, dan NAW vragen). Meta toont ze in de meegegeven
 *    volgorde dus we sorteren bewust.
 *  - Max 4 custom vragen (elke extra ≈ 5% drop-off in submit-rate).
 *  - Multiple-choice > vrije tekst (klikken converteert beter dan typen).
 *  - Question-keys hergebruiken bestaande `branch_fields`-keys waar mogelijk
 *    zodat de webhook-intake de answers niet stil dropt.
 *  - Default form_type = HIGHER_INTENT (kwaliteit > volume).
 */
import { z } from 'zod';
import {
  estimateTextCostCents,
  getOpenAIClient,
  logOpenAIUsage,
  withOpenAIRetry,
  type SupportedTextModel,
} from '@/lib/openaiClient';
import { BRANCH_HINTS } from '@/lib/aiCampaignStrategist';

// ── Public types ─────────────────────────────────────────────

/**
 * Set prefilled-velden die we standaard onderaan ALLE WarmeLeads-formulieren
 * willen hebben. Meta haalt deze uit het Facebook-profiel.
 *
 * Volgorde: NAAM → EMAIL → TELEFOON → POSTCODE. Postcode is cruciaal voor
 * onze geo-distributie (klant met focus Utrecht moet exact die postcode-rij
 * krijgen) en wordt door Meta NL prefilled-veld `POST_CODE` correct gevuld.
 */
export const DEFAULT_PREFILLED_FIELDS = [
  'FULL_NAME',
  'EMAIL',
  'PHONE',
  'POST_CODE',
] as const;

export type DefaultPrefilledField = (typeof DEFAULT_PREFILLED_FIELDS)[number];

/**
 * Eén door AI voorgestelde custom-vraag. Keys + labels zijn in het NL —
 * Meta toont ze 1:1 aan de gebruiker. Voor multiple-choice geven we 2-6
 * opties: een sweet-spot tussen variatie en cognitive load.
 */
export const AiCustomQuestionSchema = z.object({
  /**
   * Snake-case identifier (zonder spaties / accents). Wordt onze key in
   * `leads.custom_fields`. Houd kort en branche-passend, bv. `urgentie`,
   * `eigen_woning`, `dakoppervlak`.
   */
  key: z.string()
    .min(2)
    .max(40)
    .regex(/^[a-z][a-z0-9_]*$/, 'key moet snake_case zijn (a-z, 0-9, _)'),
  /** Vraag zoals zichtbaar in het Meta-formulier. */
  label: z.string().min(4).max(120),
  /** MULTIPLE_CHOICE = klikbare opties (sterk aanbevolen). SHORT_ANSWER = vrije tekst. */
  type: z.enum(['MULTIPLE_CHOICE', 'SHORT_ANSWER']),
  /** Bij MULTIPLE_CHOICE: 2-6 opties met label+value. Bij SHORT_ANSWER: leeg/undefined. */
  options: z.array(z.object({
    value: z.string().min(1).max(40),
    label: z.string().min(1).max(60),
  })).min(2).max(6).optional(),
  /** Korte hint onder het label. Bv. "(één antwoord)". Optioneel. */
  inline_context: z.string().max(120).optional(),
  /**
   * Of dit veld al bestaat in `branch_fields` voor deze branche. Wordt door
   * de UI gebruikt om een "nieuw veld"-badge te tonen, niet door OpenAI.
   * In de AI-output is dit altijd undefined; we vullen het post-hoc in.
   */
  is_new_branch_field: z.boolean().optional(),
});
export type AiCustomQuestion = z.infer<typeof AiCustomQuestionSchema>;

export const AiContextCardSchema = z.object({
  title: z.string().min(4).max(80),
  /** Body als array (Meta verwacht paragraphs). 1-3 paragrafen, samen max ~400 chars. */
  content: z.array(z.string().min(4).max(280)).min(1).max(3),
  button_text: z.string().min(2).max(30).default('Verder'),
});
export type AiContextCard = z.infer<typeof AiContextCardSchema>;

export const AiThankYouPageSchema = z.object({
  title: z.string().min(4).max(60),
  body: z.string().min(8).max(300),
  /**
   * VIEW_WEBSITE = link naar website, CALL_BUSINESS = "Bel ons" knop. We
   * staan beide toe; de AI mag de meest converterende kiezen op basis van
   * branche-context.
   */
  button_type: z.enum(['VIEW_WEBSITE', 'CALL_BUSINESS', 'NONE']).default('VIEW_WEBSITE'),
  button_text: z.string().min(2).max(30).default('Bezoek website'),
  website_url: z.string().url().optional(),
  business_phone_number: z.string().min(6).max(20).optional(),
});
export type AiThankYouPage = z.infer<typeof AiThankYouPageSchema>;

export const AiPrivacyPolicySchema = z.object({
  url: z.string().url(),
  link_text: z.string().min(4).max(60).default('Privacybeleid WarmeLeads'),
});

export const AiLeadFormDraftSchema = z.object({
  /** Naam in Meta Ads Manager. Bv. "Thuisbatterij NL — Hoog intent v1". Max 60 chars. */
  name: z.string().min(6).max(60),
  /** Meta locale, default nl_NL. Voor BE-only mag de AI nl_BE / fr_BE kiezen. */
  locale: z.enum(['nl_NL', 'nl_BE', 'fr_BE', 'en_US']).default('nl_NL'),
  /** HIGHER_INTENT = review-screen aan (default voor WarmeLeads). MORE_VOLUME = snel, lagere kwaliteit. */
  form_type: z.enum(['HIGHER_INTENT', 'MORE_VOLUME']).default('HIGHER_INTENT'),
  /**
   * 2-4 custom vragen. Worden VÓÓR de prefilled velden gerenderd zodat we
   * eerst kwalificeren, daarna NAW.
   */
  custom_questions: z.array(AiCustomQuestionSchema).min(2).max(4),
  /** Prefilled velden uit FB-profiel. Default = FULL_NAME, EMAIL, PHONE, POST_CODE. */
  prefilled_fields: z.array(z.enum([
    'FULL_NAME', 'FIRST_NAME', 'LAST_NAME',
    'EMAIL', 'PHONE',
    'STREET_ADDRESS', 'CITY', 'STATE', 'POST_CODE', 'ZIP', 'COUNTRY',
    'DATE_OF_BIRTH', 'GENDER',
  ])).min(1).max(8),
  context_card: AiContextCardSchema.optional(),
  thank_you_page: AiThankYouPageSchema,
  privacy_policy: AiPrivacyPolicySchema,
  /** 1-3 zinnen waarom deze formulier-structuur converteert (audit/log). */
  design_rationale: z.string().min(20).max(600),
});
export type AiLeadFormDraft = z.infer<typeof AiLeadFormDraftSchema>;

// ── Designer input ───────────────────────────────────────────

export interface DesignerInput {
  branch: string;
  branchName?: string;
  /** Korte beschrijving van het probleem dat de doelgroep ervaart. */
  audience_problem?: string;
  /** De motivatie / trigger die ze nu doet bewegen. */
  audience_motivation?: string;
  /** Leeftijdsrange + gender voor tone-calibration. */
  age_min?: number;
  age_max?: number;
  /** 1=male, 2=female, undefined/empty = beide. */
  genders?: number[];
  /** Doelgebied (NL/BE). Bepaalt o.a. de privacy URL en taal. */
  countries?: string[];
  /**
   * Bestaande `branch_fields`-keys voor deze branche. AI mag (en zal)
   * hergebruiken waar de semantiek matcht — anders dropt webhook de answers.
   */
  existing_branch_field_keys?: Array<{ key: string; label: string }>;
}

/**
 * Standaard privacy URL voor alle WarmeLeads-formulieren. Eén juridische
 * partij (WarmeLeads) is verwerker → één URL is correct en simpel.
 */
export const DEFAULT_PRIVACY_URL = 'https://warmeleads.eu/privacy';
export const DEFAULT_WEBSITE_URL = 'https://warmeleads.eu';

// ── System prompt ────────────────────────────────────────────

function getBranchHint(branch: string) {
  return BRANCH_HINTS[branch] || {
    persona: 'Huiseigenaar 30-65 in Nederland/België',
    motivations: ['besparen', 'comfort', 'duurzaamheid'],
    objections: ['kosten', 'complexiteit'],
    qualifying_signals: ['eigen woning'],
    default_interest_keywords: [],
    default_age_min: 30,
    default_age_max: 65,
  };
}

function buildSystemPrompt(input: DesignerInput): string {
  const hint = getBranchHint(input.branch);
  const branch = input.branchName || input.branch;
  const ageMin = input.age_min ?? hint.default_age_min ?? 30;
  const ageMax = input.age_max ?? hint.default_age_max ?? 65;
  const genderText = !input.genders || input.genders.length === 0 || (input.genders.includes(1) && input.genders.includes(2))
    ? 'mannen + vrouwen'
    : input.genders.includes(1) ? 'mannen' : 'vrouwen';
  const countries = (input.countries && input.countries.length > 0 ? input.countries : ['NL']).join(' + ');

  const existingKeys = (input.existing_branch_field_keys || [])
    .slice(0, 24)
    .map(f => `  - ${f.key}  (label: "${f.label}")`)
    .join('\n');

  return [
    'Je bent een senior CRO-specialist gespecialiseerd in Meta Lead Ads voor',
    'energie/woning-branches (thuisbatterij, zonnepanelen, warmtepomp, airco) in NL/BE.',
    'Je ontwerpt een Lead Form dat de hoogste KWALITATIEVE submit-rate haalt.',
    '',
    'WAT WE WILLEN:',
    '- Veel echte leads (mensen die écht klant willen worden), niet "form fillers".',
    '- Goedkope CPL: het formulier moet niet te lang zijn (drop-off).',
    '- Goed gekwalificeerd: na submit moet onze verkoper meteen weten of de lead',
    '  past (eigen huis, urgentie, budget-indicatie, branche-specifieke signalen).',
    '',
    'CONTEXT:',
    `- Branche: ${branch}`,
    `- Doelgebied: ${countries}`,
    `- Leeftijd: ${ageMin}-${ageMax}, gender: ${genderText}`,
    input.audience_problem ? `- Probleem doelgroep: ${input.audience_problem}` : '',
    input.audience_motivation ? `- Motivatie / trigger: ${input.audience_motivation}` : '',
    `- Persona-prior: ${hint.persona}`,
    `- Motivaties-prior: ${hint.motivations.join('; ')}`,
    `- Bezwaren-prior: ${hint.objections.join('; ')}`,
    `- Kwalificerende signalen-prior: ${hint.qualifying_signals.join('; ')}`,
    '',
    existingKeys ? 'BESTAANDE branch_fields KEYS (HERGEBRUIK WAAR DE SEMANTIEK MATCHT — anders dropt onze webhook de antwoorden):' : '',
    existingKeys,
    existingKeys ? '' : '',
    'HARDE REGELS VOOR HET FORMULIER:',
    '1. EXACT 2-4 custom_questions. Niet meer, niet minder. Elke extra vraag ≈ 5% drop-off.',
    '2. ELKE custom question MOET type=MULTIPLE_CHOICE zijn met 2-6 opties — TENZIJ',
    '   de informatie écht open-tekst vereist (zeer zelden, bv. "vraag/opmerking"),',
    '   dan SHORT_ANSWER. Default: alles multiple-choice.',
    '3. Sorteer custom_questions van LICHT → ZWAAR (eerst micro-commitment, dan harde',
    '   kwalificatie). Bijvoorbeeld eerst "wil je besparen?" of "eigen woning?", later',
    '   "wat is je urgentie/budget?".',
    '4. Hergebruik bestaande branch_field keys wanneer de vraag semantisch identiek is.',
    '5. Stel "intent"-vragen boven "data"-vragen. Voorbeeld goed: "Wanneer wil je dit',
    '   geplaatst hebben?" (urgentie). Voorbeeld slecht: "Wat is je geboortedatum?"',
    '   (Meta heeft dat al + niet relevant voor sales).',
    '6. Vraag NOOIT om gegevens die we al via prefilled_fields krijgen (NAAM, EMAIL,',
    '   TELEFOON, POSTCODE).',
    '7. Opties moeten EXCLUSIEF en COLLECTIEF UITPUTTEND zijn (geen overlap, dekken',
    '   alle realistische antwoorden). Voeg waar zinvol een "Anders / weet ik niet"',
    '   optie toe.',
    '',
    'STRUCTUUR:',
    '- form_type = "HIGHER_INTENT" (default voor WarmeLeads — review-screen verhoogt',
    '  kwaliteit). Alleen kiezen voor MORE_VOLUME als de admin context expliciet',
    '  vraagt om laag-budget volumetest.',
    '- locale = "nl_NL" voor NL-only, "nl_BE" voor BE-NL, "fr_BE" alleen voor',
    '  Wallonië-only campagnes. Default: nl_NL.',
    '- prefilled_fields ALTIJD: ["FULL_NAME","EMAIL","PHONE","POST_CODE"].',
    '',
    'CONTEXT-CARD (intro-screen, optioneel maar STERK aanbevolen):',
    '- Title: krachtige USP-uitspraak van 4-8 woorden (zoals een ad-headline).',
    '- Content: 1-3 korte paragraphs. Eerste = waarom NU, tweede = wat krijg je,',
    '  derde = waarom WarmeLeads/de installateur. Geen "we" zonder context.',
    '- Button_text: "Verder" / "Bekijk mijn opties" / "Start gratis check".',
    '',
    'THANK-YOU PAGE:',
    '- button_type = "VIEW_WEBSITE" (default) met website_url = "https://warmeleads.eu".',
    '- Alleen "CALL_BUSINESS" kiezen als de lead direct gebeld moet worden EN',
    '  business_phone_number meegeven in E.164 (+31...). Default: VIEW_WEBSITE.',
    '- body: 1-2 zinnen "we nemen binnen X uur contact op + check je inbox".',
    '',
    'PRIVACY POLICY:',
    `- url = "${DEFAULT_PRIVACY_URL}"`,
    '- link_text = "Privacybeleid WarmeLeads"',
    '',
    'NAAM:',
    '- Format: "{Branche} {NL|BE} — {type} v1". Bv. "Thuisbatterij NL — Hoog intent v1".',
    '- Max 60 chars.',
    '',
    'OUTPUT: enkel JSON volgens response_format. Geen prose buiten JSON.',
  ].filter(Boolean).join('\n');
}

function buildUserPrompt(input: DesignerInput): string {
  return JSON.stringify({
    instructie: 'Genereer een Meta Lead Form draft volgens response_format schema.',
    input: {
      branch: input.branch,
      branchName: input.branchName,
      audience_problem: input.audience_problem || null,
      audience_motivation: input.audience_motivation || null,
      age_min: input.age_min,
      age_max: input.age_max,
      genders: input.genders || null,
      countries: input.countries || ['NL'],
    },
  });
}

// ── JSON schema voor strict response_format ──────────────────

const PREFILLED_ENUM = [
  'FULL_NAME', 'FIRST_NAME', 'LAST_NAME',
  'EMAIL', 'PHONE',
  'STREET_ADDRESS', 'CITY', 'STATE', 'POST_CODE', 'ZIP', 'COUNTRY',
  'DATE_OF_BIRTH', 'GENDER',
];

const LEADFORM_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'name', 'locale', 'form_type', 'custom_questions',
    'prefilled_fields', 'thank_you_page', 'privacy_policy', 'design_rationale',
  ],
  properties: {
    name: { type: 'string' },
    locale: { type: 'string', enum: ['nl_NL', 'nl_BE', 'fr_BE', 'en_US'] },
    form_type: { type: 'string', enum: ['HIGHER_INTENT', 'MORE_VOLUME'] },
    custom_questions: {
      type: 'array',
      minItems: 2,
      maxItems: 4,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['key', 'label', 'type'],
        properties: {
          key: { type: 'string' },
          label: { type: 'string' },
          type: { type: 'string', enum: ['MULTIPLE_CHOICE', 'SHORT_ANSWER'] },
          options: {
            type: 'array',
            minItems: 2,
            maxItems: 6,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['value', 'label'],
              properties: {
                value: { type: 'string' },
                label: { type: 'string' },
              },
            },
          },
          inline_context: { type: 'string' },
        },
      },
    },
    prefilled_fields: {
      type: 'array',
      minItems: 1,
      maxItems: 8,
      items: { type: 'string', enum: PREFILLED_ENUM },
    },
    context_card: {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'content'],
      properties: {
        title: { type: 'string' },
        content: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 3 },
        button_text: { type: 'string' },
      },
    },
    thank_you_page: {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'body'],
      properties: {
        title: { type: 'string' },
        body: { type: 'string' },
        button_type: { type: 'string', enum: ['VIEW_WEBSITE', 'CALL_BUSINESS', 'NONE'] },
        button_text: { type: 'string' },
        website_url: { type: 'string' },
        business_phone_number: { type: 'string' },
      },
    },
    privacy_policy: {
      type: 'object',
      additionalProperties: false,
      required: ['url'],
      properties: {
        url: { type: 'string' },
        link_text: { type: 'string' },
      },
    },
    design_rationale: { type: 'string' },
  },
} as const;

// ── Public entrypoint ────────────────────────────────────────

export interface DesignerOutput {
  draft: AiLeadFormDraft;
  costCents: number;
}

/**
 * Roep gpt-4o aan om een Meta Lead Form-draft te genereren. Validatie via
 * Zod erna; sanity-defaults (privacy URL, prefilled velden) worden hier
 * geïnjecteerd voor het geval de AI er een vergeet.
 */
export async function generateLeadFormDraft(input: DesignerInput): Promise<DesignerOutput> {
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
      temperature: 0.5,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'lead_form_draft',
          strict: false,
          schema: LEADFORM_JSON_SCHEMA,
        },
      },
    }),
  );

  const raw = completion.choices?.[0]?.message?.content;
  if (!raw) throw new Error('Designer gaf geen content terug');

  let parsed: AiLeadFormDraft;
  try {
    const json = JSON.parse(raw);
    // Defaults injecteren voordat we valideren (Zod heeft .default() maar
    // alleen op velden die undefined zijn — strict mode AI kan ze ook
    // weglaten ondanks de prompt).
    if (!json.privacy_policy) {
      json.privacy_policy = { url: DEFAULT_PRIVACY_URL, link_text: 'Privacybeleid WarmeLeads' };
    } else if (!json.privacy_policy.url) {
      json.privacy_policy.url = DEFAULT_PRIVACY_URL;
    }
    if (!json.prefilled_fields || json.prefilled_fields.length === 0) {
      json.prefilled_fields = [...DEFAULT_PREFILLED_FIELDS];
    }
    if (json.thank_you_page && !json.thank_you_page.website_url && json.thank_you_page.button_type !== 'CALL_BUSINESS') {
      json.thank_you_page.website_url = DEFAULT_WEBSITE_URL;
    }
    parsed = AiLeadFormDraftSchema.parse(json);
  } catch (e) {
    throw new Error(`LeadForm JSON ongeldig: ${(e as Error).message}`);
  }

  // Hergebruik-flag invullen: per custom question kijken of de key
  // (case-insensitive) al in branch_fields voorkomt. Dit gaat NIET via OpenAI
  // — strictly post-hoc om de UI 'nieuw veld'-badge correct te tonen.
  const existingKeys = new Set(
    (input.existing_branch_field_keys || []).map(f => f.key.toLowerCase()),
  );
  for (const q of parsed.custom_questions) {
    q.is_new_branch_field = !existingKeys.has(q.key.toLowerCase());
  }

  const usage = completion.usage;
  const inputTokens = usage?.prompt_tokens ?? 0;
  const outputTokens = usage?.completion_tokens ?? 0;
  const costCents = estimateTextCostCents(model, inputTokens, outputTokens);

  await logOpenAIUsage({
    branch: input.branch,
    kind: 'copy',
    model,
    costCents,
    inputTokens,
    outputTokens,
    metadata: {
      kind: 'lead_form_designer',
      questions: parsed.custom_questions.length,
      form_type: parsed.form_type,
      locale: parsed.locale,
    },
  });

  return { draft: parsed, costCents };
}

// ── Internal exports voor tests ──────────────────────────────
export const __internal = {
  buildSystemPrompt,
  buildUserPrompt,
  LEADFORM_JSON_SCHEMA,
  getBranchHint,
};
