/**
 * Unit tests voor de smart-routing selector.
 *
 * Belangrijke gedragingen:
 *  - User-override > strategist-hint > auto-routing.
 *  - Overlay-vriendelijke styles + overlay.enabled gaan naar Ideogram.
 *  - Illustration-styles gaan naar Recraft.
 *  - Photorealistic-styles vallen op Flux.
 *  - Niet-beschikbare providers vallen netjes terug op gpt-image-1.
 */
import { describe, it, expect } from 'vitest';
import { selectProvider, __internal } from '@/lib/imageProviders/selector';
import { REPLICATE_MODELS } from '@/lib/imageProviders/replicate';
import { PEXELS_MODEL } from '@/lib/imageProviders/pexels';
import { OPENAI_MODEL } from '@/lib/imageProviders/openai';
import type { ProviderCapabilities } from '@/lib/imageProviders/types';

const ALL_CAPS: ProviderCapabilities = { openai: true, replicate: true, pexels: true };
const ONLY_OPENAI: ProviderCapabilities = { openai: true, replicate: false, pexels: false };
const ONLY_REPLICATE: ProviderCapabilities = { openai: false, replicate: true, pexels: false };

describe('selectProvider · auto-routing', () => {
  it('overlay.enabled = true → Ideogram', () => {
    const d = selectProvider({
      style: 'lifestyle',
      overlayEnabled: true,
      capabilities: ALL_CAPS,
    });
    expect(d.providerId).toBe('ideogram');
    expect(d.provider).toBe('replicate');
    expect(d.model).toBe(REPLICATE_MODELS.ideogram);
  });

  it('overlay-native style (bold_promo) zonder overlay → Ideogram', () => {
    const d = selectProvider({
      style: 'bold_promo',
      overlayEnabled: false,
      capabilities: ALL_CAPS,
    });
    expect(d.providerId).toBe('ideogram');
  });

  it('infographic → Recraft', () => {
    const d = selectProvider({
      style: 'infographic',
      overlayEnabled: false,
      capabilities: ALL_CAPS,
    });
    expect(d.providerId).toBe('recraft');
    expect(d.model).toBe(REPLICATE_MODELS.recraft);
  });

  it('data_visual → Recraft', () => {
    const d = selectProvider({
      style: 'data_visual',
      overlayEnabled: false,
      capabilities: ALL_CAPS,
    });
    expect(d.providerId).toBe('recraft');
  });

  it('lifestyle/emotional/product_closeup zonder overlay → Flux', () => {
    for (const style of ['lifestyle', 'emotional', 'product_closeup', 'social_proof', 'testimonial_card'] as const) {
      const d = selectProvider({ style, overlayEnabled: false, capabilities: ALL_CAPS });
      expect(d.providerId).toBe('flux');
      expect(d.model).toBe(REPLICATE_MODELS.flux);
    }
  });
});

describe('selectProvider · precedence', () => {
  it('user override > auto-routing', () => {
    const d = selectProvider({
      override: 'imagen',
      style: 'infographic', // zou normaal Recraft kiezen
      overlayEnabled: false,
      capabilities: ALL_CAPS,
    });
    expect(d.providerId).toBe('imagen');
    expect(d.model).toBe(REPLICATE_MODELS.imagen);
    expect(d.reason).toMatch(/user override/i);
  });

  it('strategist hint > auto-routing', () => {
    const d = selectProvider({
      strategistHint: 'pexels_overlay',
      style: 'lifestyle',
      overlayEnabled: false,
      capabilities: ALL_CAPS,
    });
    expect(d.providerId).toBe('pexels_overlay');
    expect(d.model).toBe(PEXELS_MODEL);
    expect(d.reason).toMatch(/strategist hint/i);
  });

  it('user override > strategist hint', () => {
    const d = selectProvider({
      override: 'flux',
      strategistHint: 'recraft',
      style: 'infographic',
      overlayEnabled: false,
      capabilities: ALL_CAPS,
    });
    expect(d.providerId).toBe('flux');
  });

  it('override="auto" laat strategist hint door', () => {
    const d = selectProvider({
      override: 'auto',
      strategistHint: 'imagen',
      style: 'lifestyle',
      overlayEnabled: false,
      capabilities: ALL_CAPS,
    });
    expect(d.providerId).toBe('imagen');
  });
});

describe('selectProvider · fallback bij ontbrekende credentials', () => {
  it('Replicate niet beschikbaar → gpt-image-1', () => {
    const d = selectProvider({
      style: 'lifestyle',
      overlayEnabled: false,
      capabilities: ONLY_OPENAI,
    });
    expect(d.providerId).toBe('gpt');
    expect(d.model).toBe(OPENAI_MODEL);
  });

  it('OpenAI niet beschikbaar maar Replicate wel → Flux voor lifestyle', () => {
    const d = selectProvider({
      style: 'lifestyle',
      overlayEnabled: false,
      capabilities: ONLY_REPLICATE,
    });
    expect(d.providerId).toBe('flux');
  });

  it('user override naar pexels maar niet beschikbaar → fallback met reason', () => {
    const d = selectProvider({
      override: 'pexels_overlay',
      style: 'lifestyle',
      overlayEnabled: false,
      capabilities: ONLY_REPLICATE,
    });
    expect(d.providerId).not.toBe('pexels_overlay');
    expect(d.reason).toMatch(/niet beschikbaar/i);
  });
});

describe('selectProvider · interne helpers', () => {
  it('autoRouteToId is deterministisch en pure', () => {
    const a = __internal.autoRouteToId({ style: 'lifestyle', overlayEnabled: false });
    const b = __internal.autoRouteToId({ style: 'lifestyle', overlayEnabled: false });
    expect(a.id).toBe(b.id);
  });

  it('fallbackChain volgt voorkeur replicate → openai → pexels', () => {
    const chain = __internal.fallbackChain(ALL_CAPS);
    expect(chain[0]).toBe('flux');
    expect(chain).toContain('gpt');
  });
});
