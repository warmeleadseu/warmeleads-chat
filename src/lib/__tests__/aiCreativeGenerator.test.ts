import { describe, it, expect } from 'vitest';
import { __internal, buildImagePromptFromBrief, IMAGE_STYLE_DIRECTION } from '../aiCreativeGenerator';
import { VISUAL_STYLES } from '../aiVisualDNA';
import type { ImageBrief } from '../aiCampaignStrategist';

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

describe('IMAGE_STYLE_DIRECTION', () => {
  it('has a direction for every visual style', () => {
    for (const style of VISUAL_STYLES) {
      expect(IMAGE_STYLE_DIRECTION[style]).toBeDefined();
      expect(IMAGE_STYLE_DIRECTION[style].length).toBeGreaterThan(20);
    }
  });
});

function makeBrief(partial: Partial<ImageBrief> = {}): ImageBrief {
  return {
    concept: 'Echtpaar 50+ kijkt tevreden naar tablet met energie-app',
    visual_hook: 'rustige glimlach, warme avondzon door raam',
    subject: 'echtpaar 50+',
    scene_setting: 'moderne Nederlandse woonkamer in vroege avond',
    composition: 'eye-level medium shot, rule-of-thirds',
    lighting: 'golden hour, warm window light',
    mood: 'warm-eerlijk',
    color_focus: 'warme aardetinten',
    style: 'lifestyle',
    overlay: { enabled: false, text: null, placement: null, style_hint: null, rationale: 'pure lifestyle, geen tekst nodig' },
    copy_alignment: 'beeld versterkt het ROI-verhaal van de copy',
    ...partial,
  };
}

describe('buildImagePromptFromBrief', () => {
  it('includes all key blocks (Goal/Subject/Scene/Composition/Lighting/Style)', () => {
    const brief = makeBrief();
    const prompt = buildImagePromptFromBrief(brief.subject, brief.style, 'Thuisbatterij', brief);
    expect(prompt).toContain('GOAL:');
    expect(prompt).toContain('SUBJECT:');
    expect(prompt).toContain('SCENE:');
    expect(prompt).toContain('COMPOSITION:');
    expect(prompt).toContain('LIGHTING:');
    expect(prompt).toContain('STYLE:');
    expect(prompt).toContain('NEGATIVES:');
  });

  it('emits NO TEXT IN IMAGE when overlay.enabled=false', () => {
    const brief = makeBrief({ overlay: { enabled: false, text: null, placement: null, style_hint: null, rationale: 'geen tekst' } });
    const prompt = buildImagePromptFromBrief(brief.subject, brief.style, 'Thuisbatterij', brief);
    expect(prompt).toContain('NO TEXT IN IMAGE');
    expect(prompt).not.toContain('TEXT OVERLAY:');
  });

  it('emits TEXT OVERLAY block when overlay.enabled=true', () => {
    const brief = makeBrief({
      style: 'bold_promo',
      overlay: {
        enabled: true,
        text: 'BESPAAR EUR 1200/JAAR',
        placement: 'badge_top_right',
        style_hint: 'bold sans-serif, contrast',
        rationale: 'cijfer in beeld stopt scroll',
      },
    });
    const prompt = buildImagePromptFromBrief(brief.subject, brief.style, 'Thuisbatterij', brief);
    expect(prompt).toContain('TEXT OVERLAY:');
    expect(prompt).toContain('BESPAAR EUR 1200/JAAR');
    expect(prompt).toContain('top-right');
  });

  it('forces overlay text to UPPER CASE in the prompt', () => {
    const brief = makeBrief({
      overlay: {
        enabled: true,
        text: 'gratis advies',
        placement: 'top',
        style_hint: null,
        rationale: 'cta in beeld',
      },
    });
    const prompt = buildImagePromptFromBrief(brief.subject, brief.style, 'Thuisbatterij', brief);
    expect(prompt).toContain('GRATIS ADVIES');
  });

  it('falls back to legacy template when no image_brief provided', () => {
    const prompt = buildImagePromptFromBrief('a sleek battery on a wall', 'lifestyle', 'Thuisbatterij');
    expect(prompt).toContain('SUBJECT:');
    expect(prompt).toContain('NO TEXT IN IMAGE');
  });

  it('aligns copy hint when headline is supplied', () => {
    const brief = makeBrief();
    const prompt = buildImagePromptFromBrief(brief.subject, brief.style, 'Thuisbatterij', brief, { headline: 'Bespaar nu' });
    expect(prompt.toLowerCase()).toContain('copy alignment');
    expect(prompt).toContain('Bespaar nu');
  });
});
