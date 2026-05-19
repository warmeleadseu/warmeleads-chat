import { describe, it, expect } from 'vitest';
import { __internal } from '../aiCreativeGenerator';

const { regexPolicyCheck, policyCheckVariant, VariantsResponseSchema, buildSystemPrompt } = __internal;

describe('regexPolicyCheck', () => {
  it('flags gegarandeerd', () => {
    expect(regexPolicyCheck('Wij beloven gegarandeerd resultaat')).toContain('absolute_guarantee');
  });

  it('flags health attribute with second person', () => {
    expect(regexPolicyCheck('Heb jij ook last van diabetes?'))
      .toEqual(expect.arrayContaining(['personal_attribute_health_or_finance', 'health_condition_attribute']));
  });

  it('returns empty list for safe copy', () => {
    expect(regexPolicyCheck('Vraag een vrijblijvende offerte aan voor je thuisbatterij')).toHaveLength(0);
  });

  it('flags clickbait', () => {
    expect(regexPolicyCheck('KLIK HIER voor de aanbieding')).toContain('clickbait_phrase');
  });
});

describe('policyCheckVariant', () => {
  it('combines all fields', () => {
    const variant = {
      angle: 'besparing',
      tone: 'helder',
      headline: 'Bespaar nu',
      primary_text: 'Wij beloven gegarandeerd resultaat',
      description: 'Vrijblijvend',
      cta: 'GET_QUOTE' as const,
      image_prompt: 'Photo of a battery',
      policy_warnings: [],
    };
    const warnings = policyCheckVariant(variant);
    expect(warnings).toContain('absolute_guarantee');
  });
});

describe('VariantsResponseSchema', () => {
  it('accepts valid variants', () => {
    const valid = {
      variants: [
        {
          angle: 'besparing',
          tone: 'helder',
          headline: 'Bespaar op je energierekening',
          primary_text: 'Een thuisbatterij verlaagt je piekverbruik en bespaart op de jaarrekening.',
          description: 'Vrijblijvende offerte op maat',
          cta: 'GET_QUOTE',
          image_prompt: 'Photo of a sleek battery mounted on a wall in a modern Dutch home, soft lighting.',
        },
      ],
    };
    expect(() => VariantsResponseSchema.parse(valid)).not.toThrow();
  });

  it('rejects too-short headline', () => {
    const invalid = {
      variants: [
        {
          angle: 'besparing',
          tone: 'helder',
          headline: 'Hi',
          primary_text: 'Een thuisbatterij verlaagt je piekverbruik en bespaart op de jaarrekening.',
          description: 'Vrijblijvende offerte op maat',
          cta: 'GET_QUOTE',
          image_prompt: 'Photo of a sleek battery mounted on a wall in a modern Dutch home, soft lighting.',
        },
      ],
    };
    expect(() => VariantsResponseSchema.parse(invalid)).toThrow();
  });
});

describe('buildSystemPrompt', () => {
  it('includes branch name and country list', () => {
    const prompt = buildSystemPrompt({
      id: 'b1',
      branch: 'thuisbatterij',
      branchName: 'Thuisbatterij',
      targetAudience: { probleem: 'hoge energierekening' },
      geographicTargeting: { countries: ['NL', 'BE'] },
      specialAdCategory: 'NONE',
      variantCount: 4,
    });
    expect(prompt).toContain('Thuisbatterij');
    expect(prompt).toContain('NL, BE');
    expect(prompt).toContain('4 unieke varianten');
  });

  it('mentions special-ad-category warning', () => {
    const prompt = buildSystemPrompt({
      id: 'b1',
      branch: 'housing',
      branchName: 'Housing',
      targetAudience: {},
      geographicTargeting: { countries: ['NL'] },
      specialAdCategory: 'HOUSING',
      variantCount: 2,
    });
    expect(prompt).toContain('special_ad_category = HOUSING');
  });
});
