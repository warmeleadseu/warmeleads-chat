/**
 * Unit tests voor de Pexels stockfoto-provider.
 *
 * Belangrijke gedragingen:
 *  - NL→EN dictionary werkt voor onze kern-branches (thuisbatterij,
 *    zonnepanelen, airco, ...).
 *  - `buildPexelsQuery` combineert subject + scene + branch.
 *  - `buildOverlaySvg` produceert geldige SVG met juiste placement.
 *  - `composeStockImage` produceert PNG-output met exacte target-dimensies
 *    en kan ook zónder overlay werken (alleen crop).
 */
import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import {
  buildPexelsQuery,
  composeStockImage,
  __internal,
} from '@/lib/imageProviders/pexels';
import type { ProviderGenerateInput } from '@/lib/imageProviders/types';

describe('Pexels · NL→EN translatie', () => {
  it('mapt onze kern-branche-termen naar Engels', () => {
    expect(__internal.translatePart('thuisbatterij in de woonkamer')).toContain('home battery storage');
    expect(__internal.translatePart('zonnepanelen')).toContain('solar panels');
    expect(__internal.translatePart('warmtepomp installatie')).toContain('heat pump');
  });

  it('laat onbekende woorden ongewijzigd', () => {
    expect(__internal.translatePart('keuken modern')).toBe('keuken modern');
  });
});

describe('Pexels · query bouw', () => {
  it('combineert subject + scene + branch tot een korte Engelse query', () => {
    const input: ProviderGenerateInput = {
      prompt: 'irrelevant',
      size: '1024x1536',
      branch: 'thuisbatterij',
      briefId: 'b1',
      variantId: 'v1',
      imageBrief: {
        concept: 'x', visual_hook: 'x',
        subject: 'thuisbatterij op muur',
        scene_setting: 'moderne nederlandse woonkamer',
        composition: 'x', lighting: 'x', mood: 'x', color_focus: 'x',
        style: 'lifestyle',
        overlay: { enabled: false, text: null, placement: null, style_hint: null, rationale: 'n/a' },
        copy_alignment: 'x',
      },
    };
    const q = buildPexelsQuery(input);
    expect(q).toContain('home battery storage');
    expect(q.length).toBeLessThanOrEqual(100);
  });

  it('zonder imageBrief gebruikt branche-naam als fallback', () => {
    const q = buildPexelsQuery({
      prompt: 'x', size: '1024x1024', branch: 'airco',
      briefId: 'b1', variantId: 'v1', imageBrief: null,
    });
    expect(q).toContain('air conditioning');
  });
});

describe('Pexels · orientation', () => {
  it('portrait/landscape/square mapping', () => {
    expect(__internal.orientationForSize('1024x1536')).toBe('portrait');
    expect(__internal.orientationForSize('1536x1024')).toBe('landscape');
    expect(__internal.orientationForSize('1024x1024')).toBe('square');
  });
});

describe('Pexels · SVG overlay-bouw', () => {
  it('bottom-placement plaatst strip onderaan', () => {
    const svg = __internal.buildOverlaySvg('BESPAAR 1200 EURO', 'bottom', 1024, 1536);
    expect(svg).toContain('<svg');
    expect(svg).toContain('BESPAAR 1200 EURO');
    // Strip moet onderaan starten: y ≥ 75% van canvas hoogte
    const yMatch = svg.match(/<rect[^>]*y="(\d+)"/);
    expect(yMatch).toBeTruthy();
    expect(parseInt(yMatch![1], 10)).toBeGreaterThan(1100);
  });

  it('top-placement plaatst strip bovenaan (y=0)', () => {
    const svg = __internal.buildOverlaySvg('GRATIS CHECK', 'top', 1024, 1536);
    expect(svg).toMatch(/<rect[^>]*y="0"/);
  });

  it('badge_top_right plaatst strip in rechterbovenhoek', () => {
    const svg = __internal.buildOverlaySvg('-20%', 'badge_top_right', 1024, 1024);
    // Eerste x-attribute op de <rect> (vóór width/height/etc) is de stripX.
    const xMatch = svg.match(/<rect\s+x="(\d+)"/);
    expect(xMatch).toBeTruthy();
    expect(parseInt(xMatch![1], 10)).toBeGreaterThan(400);
  });

  it('escapet XML-special characters in overlay-tekst', () => {
    const svg = __internal.buildOverlaySvg('BESPAAR & BLIJF', 'bottom', 1024, 1536);
    expect(svg).toContain('BESPAAR &amp; BLIJF');
    expect(svg).not.toContain('BESPAAR & BLIJF');
  });
});

describe('Pexels · composeStockImage', () => {
  // Maak een 2000x3000 dummy JPEG zodat sharp kan resizen.
  async function makeDummyPhoto(): Promise<Buffer> {
    return sharp({
      create: {
        width: 2000,
        height: 3000,
        channels: 3,
        background: { r: 100, g: 150, b: 200 },
      },
    }).jpeg().toBuffer();
  }

  it('cropt naar 1024x1536 zonder overlay', async () => {
    const raw = await makeDummyPhoto();
    const out = await composeStockImage(raw, '1024x1536', null);
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(1024);
    expect(meta.height).toBe(1536);
    expect(meta.format).toBe('png');
  });

  it('cropt naar 1024x1024 (vierkant)', async () => {
    const raw = await makeDummyPhoto();
    const out = await composeStockImage(raw, '1024x1024', null);
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(1024);
    expect(meta.height).toBe(1024);
  });

  it('voegt overlay toe wanneer overlay.enabled=true', async () => {
    const raw = await makeDummyPhoto();
    const out = await composeStockImage(raw, '1024x1536', {
      enabled: true,
      text: 'TEST OVERLAY',
      placement: 'bottom',
      style_hint: null,
      rationale: 'test',
    });
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(1024);
    expect(meta.height).toBe(1536);
    // De pixelbuffer moet anders zijn dan zonder overlay
    const noOverlay = await composeStockImage(raw, '1024x1536', null);
    expect(out.length).not.toBe(noOverlay.length);
  });

  it('slaat overlay over bij overlay.enabled=false', async () => {
    const raw = await makeDummyPhoto();
    const a = await composeStockImage(raw, '1024x1024', null);
    const b = await composeStockImage(raw, '1024x1024', {
      enabled: false, text: 'IGNORE ME', placement: 'bottom', style_hint: null, rationale: 'n/a',
    });
    expect(a.length).toBe(b.length);
  });
});
