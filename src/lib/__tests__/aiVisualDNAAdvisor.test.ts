/**
 * Unit tests voor de Visual DNA Advisor.
 *
 * Belangrijke gedragingen:
 *  - System prompt en user prompt bevatten de juiste contextvelden (branche,
 *    probleem, motivatie, leeftijd, gender, regio's) zodat de AI écht
 *    rekening houdt met de admin-input.
 *  - Het Zod-schema valideert de OpenAI-output strikt op de enum-chip-velden.
 *  - Zonder OpenAI client retourneert `suggestVisualDNA` netjes een fallback
 *    (branche-defaults) i.p.v. te gooien.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { suggestVisualDNA, __internal } from '@/lib/aiVisualDNAAdvisor';

describe('aiVisualDNAAdvisor prompt-bouw', () => {
  it('system prompt benoemt scroll-stoppers en enum-strictheid', () => {
    const sys = __internal.buildSystemPrompt();
    expect(sys).toMatch(/Facebook Lead Ads/i);
    expect(sys).toMatch(/strikt uit de bijgeleverde enum-waarden/i);
    expect(sys).toMatch(/must_include/i);
  });

  it('user prompt vermeldt branche + probleem + motivatie + leeftijd + gender', () => {
    const userPrompt = __internal.buildUserPrompt({
      branch: 'thuisbatterij',
      branchName: 'Thuisbatterij',
      audienceProblem: 'hoge energierekening en piekverbruik',
      audienceMotivation: 'afschaffing salderingsregeling 2027',
      formQuestionsCount: 4,
      targeting: {
        countries: ['NL'],
        regions: [{ name: 'Utrecht' }, { name: 'Noord-Holland' }],
        age_min: 45,
        age_max: 70,
        genders: [1],
      },
    });
    expect(userPrompt).toContain('Thuisbatterij');
    expect(userPrompt).toContain('hoge energierekening en piekverbruik');
    expect(userPrompt).toContain('afschaffing salderingsregeling 2027');
    expect(userPrompt).toContain('45-70');
    expect(userPrompt).toContain('mannen');
    expect(userPrompt).toContain('Utrecht');
  });

  it('user prompt valt netjes terug op placeholders bij ontbrekende brief-velden', () => {
    const userPrompt = __internal.buildUserPrompt({
      branch: 'airco',
      targeting: { countries: ['NL'] },
    });
    expect(userPrompt).toContain('airco');
    expect(userPrompt).toContain('niet gespecificeerd');
    expect(userPrompt).toContain('alle genders');
  });
});

describe('AdvisorJsonSchema', () => {
  it('accepteert geldige output', () => {
    const ok = __internal.AdvisorJsonSchema.safeParse({
      audience_looks: ['gezin', 'stel-50plus'],
      settings: ['dak', 'tuin'],
      moods: ['urgent-actie', 'warm-eerlijk'],
      color_focuses: ['warme-aardetinten'],
      styles_enabled: ['lifestyle', 'bold_promo', 'price_badge'],
      overlay_frequency: 'mixed',
      must_include: ['Nederlandse rijwoning'],
      must_avoid: ['kinderen alleen'],
      brand_identity: 'Eerlijk middenklasse-huishouden.',
      example_overlays: ['BESPAAR EUR 1200/JAAR'],
      rationale: 'Bewuste mix.',
    });
    expect(ok.success).toBe(true);
  });

  it('weigert chip-waarden buiten de enum (geen synoniemen)', () => {
    const bad = __internal.AdvisorJsonSchema.safeParse({
      audience_looks: ['middelbare-leeftijd'],
      settings: ['dak'],
      moods: ['urgent-actie'],
      color_focuses: ['warme-aardetinten'],
      styles_enabled: ['lifestyle'],
      overlay_frequency: 'mixed',
      must_include: [],
      must_avoid: [],
      brand_identity: '',
      example_overlays: [],
      rationale: 'x',
    });
    expect(bad.success).toBe(false);
  });

  it('weigert onbekende overlay_frequency', () => {
    const bad = __internal.AdvisorJsonSchema.safeParse({
      audience_looks: ['gezin'],
      settings: ['dak'],
      moods: ['urgent-actie'],
      color_focuses: ['warme-aardetinten'],
      styles_enabled: ['lifestyle'],
      overlay_frequency: 'sometimes',
      must_include: [],
      must_avoid: [],
      brand_identity: '',
      example_overlays: [],
      rationale: 'x',
    });
    expect(bad.success).toBe(false);
  });
});

describe('suggestVisualDNA fallback', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.OPENAI_API_KEY;
  });

  it('valt terug op branche-defaults wanneer OPENAI_API_KEY ontbreekt', async () => {
    delete process.env.OPENAI_API_KEY;
    const out = await suggestVisualDNA({
      branch: 'thuisbatterij',
      branchName: 'Thuisbatterij',
      targeting: { countries: ['NL'], age_min: 30, age_max: 65 },
    });
    expect(out.dna.styles_enabled).toContain('lifestyle');
    expect(out.dna.styles_enabled.length).toBeGreaterThan(0);
    expect(out.dna.settings.length).toBeGreaterThan(0);
    expect(out.costCents).toBe(0);
    expect(out.source).toBe('fallback');
    expect(out.fallbackReason).toBe('no_api_key');
    expect(out.rationale).toMatch(/niet geconfigureerd/i);
  });
});

describe('aiVisualDNAAdvisor extra prompt checks', () => {
  it('system prompt benoemt Meta Ad policy guardrails', () => {
    const sys = __internal.buildSystemPrompt();
    expect(sys).toMatch(/voor\/na/i);
    expect(sys).toMatch(/medische beelden/i);
    expect(sys).toMatch(/in het nederlands/i);
  });
});
