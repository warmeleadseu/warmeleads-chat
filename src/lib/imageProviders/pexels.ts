/**
 * Pexels stockfoto-provider met lokale typografie-overlay via `sharp`.
 *
 * De "hybride route": in plaats van een AI-gegenereerd beeld krijgen we
 * een échte foto van Pexels en bouwen we — alleen wanneer
 * `image_brief.overlay.enabled = true` — een professionele tekst-overlay
 * lokaal met SVG-typografie via sharp. Voordeel:
 *  - Geen "AI-look" — gewoon een echte foto van een professional.
 *  - Geen kosten per beeld (Pexels free tier ~20k/maand, geen attributie
 *    verplicht voor commercieel gebruik).
 *  - Pixel-perfecte typografie (geen wazige LLM-renders).
 *
 * Workflow:
 *  1. Bouw een Engelse zoekterm uit `image_brief.subject` + `scene_setting`
 *     + branche-naam (kleine NL→EN dictionary voor onze branches).
 *  2. Roep `/v1/search` aan, kies de hoogste-resolutie foto die past
 *     bij de gewenste orientation.
 *  3. Download de foto, crop met `sharp` naar het exacte target-formaat
 *     (1024x1024 / 1024x1536 / 1536x1024).
 *  4. Render — alleen indien overlay.enabled — een SVG-overlay met
 *     CAPS-tekst + semi-transparent achtergrondstrip op de juiste
 *     placement. Composite met sharp.
 *  5. Return als PNG buffer (verlustrijk).
 */
import sharp from 'sharp';
import { getPexelsKey } from './credentials';
import type {
  ImageProvider,
  ProviderGenerateInput,
  ProviderGenerateResult,
  SupportedSize,
} from './types';
import type { ImageBrief } from '@/lib/aiCampaignStrategist';

export const PEXELS_MODEL = 'pexels_overlay';
export const PEXELS_BASE = 'https://api.pexels.com/v1';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function estimatePexelsCostCents(_model: string, _size: SupportedSize): number {
  // Pexels is gratis — interface-handtekening behoudt model/size voor uniformiteit.
  return 0;
}

/**
 * Mini NL→EN dictionary voor onze meest-voorkomende branche-termen.
 * Dit verbreedt de Pexels-resultaten enorm; rest blijft origineel
 * Engels of mixed dat Pexels' fuzzy search prima aankan.
 */
const NL_TO_EN: Record<string, string> = {
  thuisbatterij: 'home battery storage',
  zonnepanelen: 'solar panels rooftop',
  airco: 'air conditioning home',
  warmtepomp: 'heat pump installation',
  isolatie: 'home insulation',
  laadpaal: 'ev charging station home',
  laadbudget: 'ev charging station',
  cv_ketel: 'home boiler heating',
  dakkapel: 'dormer window home',
  zonwering: 'sun awning terrace',
  schuifpui: 'sliding glass door home',
  woning: 'modern dutch home',
  installateur: 'home installation professional',
  besparing: 'savings money',
  duurzaam: 'sustainable home',
};

function translatePart(text: string): string {
  return text
    .toLowerCase()
    .split(/[\s,;.()-]+/)
    .map(word => NL_TO_EN[word] || word)
    .filter(Boolean)
    .join(' ');
}

/**
 * Bouwt een korte, Engels-vriendelijke Pexels-query op uit het
 * image_brief. Pexels weegt eerste 3-5 woorden het zwaarst.
 */
export function buildPexelsQuery(input: ProviderGenerateInput): string {
  const brief = input.imageBrief;
  const branchPart = NL_TO_EN[input.branch] || input.branchName || input.branch;
  if (brief) {
    const subjectEn = translatePart(brief.subject || '');
    const sceneEn = translatePart(brief.scene_setting || '');
    return [subjectEn, sceneEn, branchPart].filter(Boolean).join(' ').slice(0, 100).trim();
  }
  return [branchPart, 'home modern'].filter(Boolean).join(' ').trim();
}

interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    portrait: string;
    landscape: string;
  };
  photographer: string;
  url: string;
}

interface PexelsSearchResponse {
  photos: PexelsPhoto[];
  total_results: number;
  next_page?: string;
}

function orientationForSize(size: SupportedSize): 'portrait' | 'landscape' | 'square' {
  if (size === '1024x1536') return 'portrait';
  if (size === '1536x1024') return 'landscape';
  return 'square';
}

export async function searchPexels(
  query: string,
  options: { size: SupportedSize; perPage?: number; fetchImpl?: typeof fetch },
): Promise<PexelsPhoto[]> {
  const key = await getPexelsKey();
  if (!key) throw new Error('pexels_not_configured');
  const fetchImpl = options.fetchImpl || fetch;

  const params = new URLSearchParams({
    query,
    orientation: orientationForSize(options.size),
    size: 'large', // alleen foto's ≥ 24MP zodat we mooi kunnen croppen
    per_page: String(options.perPage ?? 10),
  });

  const res = await fetchImpl(`${PEXELS_BASE}/search?${params.toString()}`, {
    headers: { Authorization: key },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`pexels_search_failed:${res.status}:${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as PexelsSearchResponse;
  return data.photos || [];
}

async function downloadPhoto(url: string, fetchImpl?: typeof fetch): Promise<Buffer> {
  const f = fetchImpl || fetch;
  const res = await f(url);
  if (!res.ok) throw new Error(`pexels_download_failed:${res.status}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

function dimensionsFromSize(size: SupportedSize): { width: number; height: number } {
  const [w, h] = size.split('x').map(n => parseInt(n, 10));
  return { width: w, height: h };
}

/**
 * Sluit XML-special chars af in de SVG-tekst zodat we niet stukgaan
 * op `&`, `<`, `>`, `"` of `'` in de overlay-string.
 */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Bouw een SVG-overlay met heavy sans-serif typografie + semi-transparente
 * strip op de juiste placement. Gebruikt websafe font-stack ("DejaVu Sans"
 * is bundled in Vercel-serverless libsharp/librsvg).
 *
 * Hoogte/breedte van de strip + font-size schalen met de canvas-maat zodat
 * 1024×1024 en 1536×1024 visueel consistent zijn.
 */
export function buildOverlaySvg(
  text: string,
  placement: NonNullable<ImageBrief['overlay']>['placement'],
  width: number,
  height: number,
): string {
  const upper = (text || '').trim().toUpperCase();
  const safeText = escapeXml(upper);
  // Heuristiek: font-size schaalt met canvas-breedte, klein genoeg dat
  // 6 woorden netjes op één regel passen op een 1024-breed canvas.
  const fontSize = Math.round(width / 14);
  const stripHeight = Math.round(fontSize * 2.0);
  const padding = Math.round(width * 0.04);
  const fontFamily = '"Arial Black", "Helvetica Neue", "DejaVu Sans", "Liberation Sans", sans-serif';

  // Default: bottom strip. Andere placements blijven volledig binnen het canvas.
  let stripY = height - stripHeight;
  let stripX = 0;
  let stripW = width;
  let textX = width / 2;
  let textY = stripY + stripHeight / 2 + fontSize / 3;
  let textAnchor = 'middle';

  if (placement === 'top') {
    stripY = 0;
    textY = stripHeight / 2 + fontSize / 3;
  } else if (placement === 'center') {
    stripY = Math.round(height / 2 - stripHeight / 2);
    textY = stripY + stripHeight / 2 + fontSize / 3;
  } else if (placement === 'badge_top_right' || placement === 'badge_top_left') {
    // Badge = compactere strip in een hoek. Stel breedte gelijk aan
    // de tekst-bounding-box + flink padding zodat de pill mooi past.
    const approxTextWidth = Math.min(width * 0.55, fontSize * (safeText.length * 0.55));
    stripW = Math.round(approxTextWidth + padding * 2);
    stripY = padding;
    if (placement === 'badge_top_right') {
      stripX = width - stripW - padding;
    } else {
      stripX = padding;
    }
    textAnchor = 'middle';
    textX = stripX + stripW / 2;
    textY = stripY + stripHeight / 2 + fontSize / 3;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="black" flood-opacity="0.45" />
    </filter>
  </defs>
  <rect x="${stripX}" y="${stripY}" width="${stripW}" height="${stripHeight}" fill="rgba(0,0,0,0.62)" rx="${placement?.startsWith('badge') ? Math.round(stripHeight / 2) : 0}" />
  <text
    x="${textX}"
    y="${textY}"
    font-family='${fontFamily}'
    font-size="${fontSize}"
    font-weight="900"
    fill="#ffffff"
    text-anchor="${textAnchor}"
    letter-spacing="0.5"
    filter="url(#shadow)"
  >${safeText}</text>
</svg>`;
}

/**
 * Schrijf een Pexels-foto plus optionele overlay naar een PNG buffer
 * van het exacte target-formaat. Verlustrijke compression zodat Meta
 * de upload zonder kwaliteitsverlies accepteert.
 */
export async function composeStockImage(
  rawPhoto: Buffer,
  size: SupportedSize,
  overlay?: ImageBrief['overlay'] | null,
): Promise<Buffer> {
  const { width, height } = dimensionsFromSize(size);

  const base = await sharp(rawPhoto)
    .rotate() // auto-orienteer op EXIF
    .resize({ width, height, fit: 'cover', position: 'attention' })
    .png({ compressionLevel: 9 })
    .toBuffer();

  if (!overlay?.enabled || !overlay.text) return base;

  const svg = buildOverlaySvg(overlay.text, overlay.placement ?? 'bottom', width, height);
  const composed = await sharp(base)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png({ compressionLevel: 9 })
    .toBuffer();
  return composed;
}

export const pexelsProvider: ImageProvider = {
  id: 'pexels',
  estimateCostCents: estimatePexelsCostCents,
  async generate(input: ProviderGenerateInput & { model: string }): Promise<ProviderGenerateResult> {
    const query = buildPexelsQuery(input);
    if (!query) throw new Error('pexels_empty_query');
    const photos = await searchPexels(query, { size: input.size, perPage: 12 });
    if (photos.length === 0) throw new Error('pexels_no_results');
    // Kies de eerste foto met passende oriëntatie + voldoende resolutie.
    // Pexels sorteert al op relevantie; eerste hit = beste match.
    const target = input.size === '1024x1536' ? 'portrait' : input.size === '1536x1024' ? 'landscape' : 'original';
    const chosen = photos[0];
    const srcUrl = chosen.src[target as keyof PexelsPhoto['src']] || chosen.src.original;
    const raw = await downloadPhoto(srcUrl);
    const buffer = await composeStockImage(raw, input.size, input.imageBrief?.overlay ?? null);

    return {
      buffer,
      mimeType: 'image/png',
      provider: 'pexels',
      model: PEXELS_MODEL,
      costCents: 0,
      metadata: {
        pexels_id: chosen.id,
        photographer: chosen.photographer,
        source_url: chosen.url,
        query,
        overlay_applied: !!input.imageBrief?.overlay?.enabled,
      },
    };
  },
};

export const __internal = {
  translatePart,
  NL_TO_EN,
  orientationForSize,
  buildOverlaySvg,
  dimensionsFromSize,
  escapeXml,
};
