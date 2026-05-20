/**
 * Smart provider routing.
 *
 * Mapping-tabel van Visueel DNA (style + overlay.enabled) naar de
 * meest geschikte image-provider+model. Drie niveaus van precedence:
 *
 *   1. User override (StudioForm dropdown, per-variant regenerate)
 *   2. Strategist hint   (`image_brief.preferred_provider`)
 *   3. Auto-routing      (deze module's standaard-regels)
 *
 * Daarnaast: als een provider niet beschikbaar is (geen credentials)
 * vallen we automatisch terug op de eerstvolgende werkbare optie,
 * waarbij OpenAI gpt-image-1 altijd de laatste vangnet is.
 */
import { REPLICATE_MODELS } from './replicate';
import { OPENAI_MODEL } from './openai';
import { PEXELS_MODEL } from './pexels';
import type {
  ProviderId,
  SelectorInput,
  SelectorDecision,
  ProviderCapabilities,
} from './types';
import type { VisualStyle } from '@/lib/aiVisualDNA';

/** Stijlen die overlay-typografie nodig hebben → Ideogram is killer-app. */
const OVERLAY_NATIVE_STYLES: VisualStyle[] = ['bold_promo', 'urgency_banner', 'price_badge'];

/** Stijlen die illustratie/vector vereisen → Recraft. */
const ILLUSTRATION_STYLES: VisualStyle[] = ['infographic', 'data_visual'];

/** Stijlen die fotorealistische "echte mensen/scenes" oproepen → Flux/Imagen of Pexels. */
const PHOTOREALISTIC_STYLES: VisualStyle[] = [
  'lifestyle',
  'product_closeup',
  'emotional',
  'social_proof',
  'testimonial_card',
];

/**
 * Wat is een werkende fallback in volgorde van voorkeur?
 * Zorgt dat we nooit een 500 retourneren omdat een provider toevallig
 * niet is geconfigureerd. Auto-routing kiest altijd uit deze tabel.
 */
function fallbackChain(capabilities: ProviderCapabilities): ProviderId[] {
  const chain: ProviderId[] = [];
  if (capabilities.replicate) chain.push('flux');
  if (capabilities.openai) chain.push('gpt');
  if (capabilities.pexels) chain.push('pexels_overlay');
  return chain;
}

/** Resolve een `ProviderId` naar concrete provider+model+reason. */
function resolve(id: ProviderId, reason: string): Omit<SelectorDecision, 'providerId'> & { providerId: ProviderId } {
  switch (id) {
    case 'flux':
      return { providerId: id, provider: 'replicate', model: REPLICATE_MODELS.flux, reason };
    case 'ideogram':
      return { providerId: id, provider: 'replicate', model: REPLICATE_MODELS.ideogram, reason };
    case 'recraft':
      return { providerId: id, provider: 'replicate', model: REPLICATE_MODELS.recraft, reason };
    case 'imagen':
      return { providerId: id, provider: 'replicate', model: REPLICATE_MODELS.imagen, reason };
    case 'pexels_overlay':
      return { providerId: id, provider: 'pexels', model: PEXELS_MODEL, reason };
    case 'gpt':
      return { providerId: id, provider: 'openai', model: OPENAI_MODEL, reason };
    case 'auto':
      // Auto wordt elders eerst gemapt op een concrete id; mocht hij toch
      // doorlekken, val terug op flux of gpt.
      return { providerId: 'flux', provider: 'replicate', model: REPLICATE_MODELS.flux, reason };
  }
}

/** Mag de gevraagde provider-ID daadwerkelijk worden uitgevoerd? */
function isAvailable(id: ProviderId, capabilities: ProviderCapabilities): boolean {
  if (id === 'auto') return true;
  if (id === 'gpt') return capabilities.openai;
  if (id === 'pexels_overlay') return capabilities.pexels;
  return capabilities.replicate; // flux / ideogram / recraft / imagen
}

/**
 * Kies de beste provider op basis van DNA + overlay.
 * Geeft een `providerId` terug, niet direct een concrete provider — zo
 * kan de caller deze nog overschrijven én logging makkelijk groeperen.
 */
function autoRouteToId(input: Pick<SelectorInput, 'style' | 'overlayEnabled'>): { id: ProviderId; reason: string } {
  if (input.overlayEnabled || OVERLAY_NATIVE_STYLES.includes(input.style)) {
    return { id: 'ideogram', reason: 'overlay/typography → Ideogram v3' };
  }
  if (ILLUSTRATION_STYLES.includes(input.style)) {
    return { id: 'recraft', reason: 'illustration/infographic → Recraft V3' };
  }
  if (PHOTOREALISTIC_STYLES.includes(input.style)) {
    return { id: 'flux', reason: 'photorealistic lifestyle → Flux 1.1 Pro Ultra' };
  }
  return { id: 'flux', reason: 'default fotorealisme → Flux 1.1 Pro Ultra' };
}

/**
 * Main entry — `selectProvider` neemt user override, strategist hint en
 * auto-routing in volgorde en geeft de uiteindelijke beslissing terug,
 * met capability-fallback naar gpt-image-1 als laatste vangnet.
 */
export function selectProvider(input: SelectorInput): SelectorDecision {
  const chain = fallbackChain(input.capabilities);

  // 1) User override (hoogste precedence)
  if (input.override && input.override !== 'auto') {
    if (isAvailable(input.override, input.capabilities)) {
      return resolve(input.override, `user override → ${input.override}`);
    }
    // Niet beschikbaar → val terug op auto-routing met reason gemarkeerd.
    const fallback = autoRouteToId(input);
    const targetId = isAvailable(fallback.id, input.capabilities) ? fallback.id : (chain[0] || 'gpt');
    return resolve(targetId, `override "${input.override}" niet beschikbaar → ${fallback.reason}`);
  }

  // 2) Strategist hint
  if (input.strategistHint && input.strategistHint !== 'auto') {
    if (isAvailable(input.strategistHint, input.capabilities)) {
      return resolve(input.strategistHint, `strategist hint → ${input.strategistHint}`);
    }
  }

  // 3) Auto-routing op DNA
  const auto = autoRouteToId(input);
  if (isAvailable(auto.id, input.capabilities)) {
    return resolve(auto.id, `auto · ${auto.reason}`);
  }

  // 4) Final fallback
  const fb = chain[0] || 'gpt';
  return resolve(fb, `geen voorkeur beschikbaar → ${fb}`);
}

export const __internal = {
  autoRouteToId,
  isAvailable,
  resolve,
  fallbackChain,
  OVERLAY_NATIVE_STYLES,
  ILLUSTRATION_STYLES,
  PHOTOREALISTIC_STYLES,
};
