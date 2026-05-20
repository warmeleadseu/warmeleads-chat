/**
 * Unit tests voor de Replicate provider.
 *
 * We mocken `fetch` zodat we de exacte request-shape kunnen verifiëren
 * zonder echt naar Replicate te praten. Belangrijke gedragingen:
 *  - Per model wordt de juiste input-payload gebouwd (Flux raw=true,
 *    Ideogram magic_prompt_option=Off, Recraft size=WxH, Imagen
 *    safety_filter_level=block_only_high).
 *  - Aspect ratio mapping is correct, inclusief Imagen 4 die geen 2:3
 *    accepteert maar 3:4 (voor portrait 1024x1536).
 */
import { describe, it, expect } from 'vitest';
import { __internal, REPLICATE_MODELS } from '@/lib/imageProviders/replicate';
import type { ProviderGenerateInput } from '@/lib/imageProviders/types';

const baseInput: ProviderGenerateInput = {
  prompt: 'Lifestyle scene of Dutch family in living room',
  imageBrief: null,
  size: '1024x1536',
  branch: 'thuisbatterij',
  briefId: 'brief-1',
  variantId: 'variant-1',
};

describe('Replicate · aspect ratio mapping', () => {
  it('1024x1024 → 1:1 voor alle modellen', () => {
    for (const model of Object.values(REPLICATE_MODELS)) {
      expect(__internal.sizeToAspectRatio(model, '1024x1024')).toBe('1:1');
    }
  });

  it('1024x1536 → 2:3 voor Flux/Ideogram/Recraft, 3:4 voor Imagen', () => {
    expect(__internal.sizeToAspectRatio(REPLICATE_MODELS.flux, '1024x1536')).toBe('2:3');
    expect(__internal.sizeToAspectRatio(REPLICATE_MODELS.ideogram, '1024x1536')).toBe('2:3');
    expect(__internal.sizeToAspectRatio(REPLICATE_MODELS.imagen, '1024x1536')).toBe('3:4');
  });

  it('1536x1024 → 3:2 voor Flux/Ideogram, 4:3 voor Imagen', () => {
    expect(__internal.sizeToAspectRatio(REPLICATE_MODELS.flux, '1536x1024')).toBe('3:2');
    expect(__internal.sizeToAspectRatio(REPLICATE_MODELS.imagen, '1536x1024')).toBe('4:3');
  });
});

describe('Replicate · input-payload per model', () => {
  it('Flux 1.1 Pro Ultra → raw=true, output_format=png, aspect_ratio', () => {
    const payload = __internal.buildReplicateInput(REPLICATE_MODELS.flux, baseInput);
    expect(payload.prompt).toContain('Lifestyle');
    expect(payload.aspect_ratio).toBe('2:3');
    expect(payload.raw).toBe(true);
    expect(payload.output_format).toBe('png');
    expect(payload.safety_tolerance).toBe(2);
  });

  it('Ideogram v3 → magic_prompt_option=Off, style_type=REALISTIC default', () => {
    const payload = __internal.buildReplicateInput(REPLICATE_MODELS.ideogram, baseInput);
    expect(payload.magic_prompt_option).toBe('Off');
    expect(payload.style_type).toBe('REALISTIC');
    expect(payload.aspect_ratio).toBe('2:3');
  });

  it('Ideogram v3 → style_type=DESIGN voor infographic/data_visual/bold_promo', () => {
    const payload = __internal.buildReplicateInput(REPLICATE_MODELS.ideogram, {
      ...baseInput,
      imageBrief: {
        concept: 'x', visual_hook: 'x', subject: 'x', scene_setting: 'x',
        composition: 'x', lighting: 'x', mood: 'x', color_focus: 'x',
        style: 'infographic',
        overlay: { enabled: false, text: null, placement: null, style_hint: null, rationale: 'n/a' },
        copy_alignment: 'x',
      },
    });
    expect(payload.style_type).toBe('DESIGN');
  });

  it('Recraft V3 → size in WxH string + style=realistic_image default', () => {
    const payload = __internal.buildReplicateInput(REPLICATE_MODELS.recraft, baseInput);
    expect(payload.size).toBe('1024x1536');
    expect(payload.style).toBe('realistic_image');
  });

  it('Recraft V3 → style=vector_illustration voor infographic', () => {
    const payload = __internal.buildReplicateInput(REPLICATE_MODELS.recraft, {
      ...baseInput,
      imageBrief: {
        concept: 'x', visual_hook: 'x', subject: 'x', scene_setting: 'x',
        composition: 'x', lighting: 'x', mood: 'x', color_focus: 'x',
        style: 'infographic',
        overlay: { enabled: false, text: null, placement: null, style_hint: null, rationale: 'n/a' },
        copy_alignment: 'x',
      },
    });
    expect(payload.style).toBe('vector_illustration');
  });

  it('Imagen 4 Ultra → safety_filter_level=block_only_high, output_format=png', () => {
    const payload = __internal.buildReplicateInput(REPLICATE_MODELS.imagen, baseInput);
    expect(payload.safety_filter_level).toBe('block_only_high');
    expect(payload.output_format).toBe('png');
    expect(payload.aspect_ratio).toBe('3:4'); // Imagen 4 mapt portrait op 3:4
  });

  it('Onbekend model gooit', () => {
    expect(() => __internal.buildReplicateInput('unknown/model', baseInput)).toThrow(/unsupported_model/);
  });
});

describe('Replicate · kosten-mapping', () => {
  it('Ideogram is goedkoopst, Recraft duurst', () => {
    const flux = __internal.COST_CENTS_BY_MODEL[REPLICATE_MODELS.flux];
    const ideo = __internal.COST_CENTS_BY_MODEL[REPLICATE_MODELS.ideogram];
    const recraft = __internal.COST_CENTS_BY_MODEL[REPLICATE_MODELS.recraft];
    expect(ideo).toBeLessThan(flux);
    expect(recraft).toBeGreaterThan(flux);
  });
});
