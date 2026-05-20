import { describe, it, expect } from 'vitest';
import {
  VISUAL_STYLES,
  OVERLAY_FRIENDLY_STYLES,
  AUDIENCE_LOOKS,
  SETTINGS,
  MOODS,
  COLOR_FOCUSES,
  OVERLAY_FREQUENCIES,
  BRANCH_VISUAL_DEFAULTS,
  buildDefaultVisualDNA,
  getBranchVisualDefaults,
  validateVisualDNA,
  overlayBiasFromFrequency,
} from '../aiVisualDNA';

describe('aiVisualDNA: enums', () => {
  it('contains all 10 visual styles', () => {
    expect(VISUAL_STYLES).toHaveLength(10);
    expect(VISUAL_STYLES).toEqual(
      expect.arrayContaining([
        'lifestyle', 'product_closeup', 'emotional', 'social_proof', 'infographic',
        'bold_promo', 'price_badge', 'urgency_banner', 'testimonial_card', 'data_visual',
      ]),
    );
  });

  it('overlay-friendly styles are a subset of VISUAL_STYLES', () => {
    for (const s of OVERLAY_FRIENDLY_STYLES) {
      expect(VISUAL_STYLES).toContain(s);
    }
  });

  it('every group has at least 2 options for meaningful choice', () => {
    expect(AUDIENCE_LOOKS.length).toBeGreaterThanOrEqual(2);
    expect(SETTINGS.length).toBeGreaterThanOrEqual(2);
    expect(MOODS.length).toBeGreaterThanOrEqual(2);
    expect(COLOR_FOCUSES.length).toBeGreaterThanOrEqual(2);
    expect(OVERLAY_FREQUENCIES.length).toBeGreaterThanOrEqual(2);
  });
});

describe('aiVisualDNA: branch defaults', () => {
  it('thuisbatterij has reasonable defaults', () => {
    const d = BRANCH_VISUAL_DEFAULTS.thuisbatterij;
    expect(d.audience_looks.length).toBeGreaterThan(0);
    expect(d.settings.length).toBeGreaterThan(0);
    expect(d.moods.length).toBeGreaterThan(0);
    expect(d.color_focuses.length).toBeGreaterThan(0);
    expect(d.styles_enabled.length).toBeGreaterThan(0);
    expect(d.example_overlays.length).toBeGreaterThan(0);
  });

  it('all branch defaults use only known styles', () => {
    for (const [branch, def] of Object.entries(BRANCH_VISUAL_DEFAULTS)) {
      for (const s of def.styles_enabled) {
        expect(VISUAL_STYLES).toContain(s);
      }
      expect(def.settings.length).toBeGreaterThan(0);
      expect(def.moods.length).toBeGreaterThan(0);
      expect(branch.length).toBeGreaterThan(0);
    }
  });

  it('getBranchVisualDefaults falls back to a generic set for unknown branch', () => {
    const fallback = getBranchVisualDefaults('non-existent-branch-x');
    expect(fallback.settings.length).toBeGreaterThan(0);
    expect(fallback.moods.length).toBeGreaterThan(0);
    expect(fallback.styles_enabled.length).toBeGreaterThan(0);
  });

  it('buildDefaultVisualDNA returns ai_decides as default overlay-frequency', () => {
    const dna = buildDefaultVisualDNA('thuisbatterij');
    expect(dna.overlay_frequency).toBe('ai_decides');
    expect(dna.must_include).toEqual(expect.any(Array));
    expect(dna.example_overlays.length).toBeGreaterThan(0);
  });
});

describe('aiVisualDNA: validation', () => {
  it('accepts a complete dna', () => {
    const dna = buildDefaultVisualDNA('thuisbatterij');
    expect(validateVisualDNA(dna)).toHaveLength(0);
  });

  it('flags empty styles', () => {
    const dna = { ...buildDefaultVisualDNA('thuisbatterij'), styles_enabled: [] };
    const issues = validateVisualDNA(dna);
    expect(issues.some(s => s.includes('stijl'))).toBe(true);
  });

  it('flags unknown overlay frequency', () => {
    const dna: Parameters<typeof validateVisualDNA>[0] = {
      ...buildDefaultVisualDNA('thuisbatterij'),
      overlay_frequency: 'eats-cheese' as unknown as 'never',
    };
    const issues = validateVisualDNA(dna);
    expect(issues.some(s => s.toLowerCase().includes('overlay_frequency'))).toBe(true);
  });
});

describe('aiVisualDNA: overlayBiasFromFrequency', () => {
  it('returns null for ai_decides', () => {
    expect(overlayBiasFromFrequency('ai_decides')).toBeNull();
  });
  it('returns 0/1 at the extremes', () => {
    expect(overlayBiasFromFrequency('never')).toBe(0);
    expect(overlayBiasFromFrequency('always')).toBe(1);
  });
  it('returns midpoints for low/mixed/high', () => {
    expect(overlayBiasFromFrequency('low')).toBe(0.25);
    expect(overlayBiasFromFrequency('mixed')).toBe(0.5);
    expect(overlayBiasFromFrequency('high')).toBe(0.75);
  });
});
