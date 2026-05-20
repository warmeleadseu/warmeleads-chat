/**
 * Visual DNA voor AI Ad Image Studio v3.
 *
 * Per branche definieren we slimme defaults (chips + hints + suggested
 * overlays) die de StudioForm pre-aanvinkt. Doel: een admin kan zonder
 * iets aan te raken een visueel-perfecte campagne opzetten, en kan
 * desgewenst tweaken.
 *
 * Deze data wordt door drie partijen gebruikt:
 *  1. StudioForm (admin-UI): pre-selecteer chips & vrije velden.
 *  2. aiCampaignStrategist: krijgt de actieve DNA als input om
 *     per creative een image_brief te plannen.
 *  3. aiCreativeGenerator: gebruikt de gekozen stijlen + must-includes
 *     bij het genereren van de uiteindelijke image-prompt.
 *
 * Belangrijk: dit is bewust een data-only module zonder side-effects;
 * makkelijk te testen en uitbreidbaar door extra branches toe te voegen.
 */

/**
 * Alle ondersteunde visuele stijlen. De eerste 5 zijn behouden uit de
 * eerdere implementatie; de laatste 5 zijn overlay-vriendelijk (krijgen
 * vaker een tekst-in-beeld element).
 */
export const VISUAL_STYLES = [
  'lifestyle',
  'product_closeup',
  'emotional',
  'social_proof',
  'infographic',
  'bold_promo',
  'price_badge',
  'urgency_banner',
  'testimonial_card',
  'data_visual',
] as const;

export type VisualStyle = (typeof VISUAL_STYLES)[number];

/**
 * Welke stijlen zijn "overlay-vriendelijk"? De strategist mag voor andere
 * stijlen ook overlay kiezen als het past, maar dit signaal helpt:
 * pure lifestyle/emotional moet vaker zonder overlay om eerlijk te lijken.
 */
export const OVERLAY_FRIENDLY_STYLES: VisualStyle[] = [
  'bold_promo',
  'price_badge',
  'urgency_banner',
  'testimonial_card',
  'data_visual',
  'infographic',
];

/** Doelgroep-look chips (wie zit er in beeld qua type/leeftijd). */
export const AUDIENCE_LOOKS = [
  'gezin',
  'stel-50plus',
  'single-jong',
  'senior',
  'diy-er',
  'zakelijk',
  'geen-mensen',
] as const;
export type AudienceLook = (typeof AUDIENCE_LOOKS)[number];

/** Settings (waar speelt de scene zich af). */
export const SETTINGS = [
  'woonkamer',
  'keuken',
  'tuin',
  'dak',
  'meterkast',
  'oprit',
  'studio-product',
  'outdoor-straat',
  'installatie-moment',
  'kantoor',
] as const;
export type Setting = (typeof SETTINGS)[number];

/** Sfeer/mood. */
export const MOODS = [
  'warm-eerlijk',
  'luxe-premium',
  'urgent-actie',
  'nuchter-cijfers',
  'gezellig-familie',
  'rustig-betrouwbaar',
] as const;
export type Mood = (typeof MOODS)[number];

/** Kleurfocus. */
export const COLOR_FOCUSES = [
  'warme-aardetinten',
  'koel-blauw',
  'contrastrijk',
  'merkkleuren-NL-oranje',
  'energie-groen',
  'monochroom-elegant',
] as const;
export type ColorFocus = (typeof COLOR_FOCUSES)[number];

/** Overlay-frequentie: hoe vaak mag de AI tekst-in-beeld gebruiken? */
export const OVERLAY_FREQUENCIES = [
  'ai_decides',
  'never',
  'low',  // ~25%
  'mixed', // ~50%
  'high', // ~75%
  'always',
] as const;
export type OverlayFrequency = (typeof OVERLAY_FREQUENCIES)[number];

/**
 * Het complete "Visueel DNA" voor één campagne (komt uit StudioForm en
 * wordt opgeslagen op `ai_campaign_briefs.visual_dna_json`).
 *
 * Alle velden zijn arrays/optioneel — leeg = "AI mag alles uit defaults".
 */
export interface VisualDNA {
  audience_looks: AudienceLook[];
  settings: Setting[];
  moods: Mood[];
  color_focuses: ColorFocus[];
  styles_enabled: VisualStyle[];
  overlay_frequency: OverlayFrequency;
  /** Verplichte visuele elementen (bv. "zonnepaneel op dak"). */
  must_include: string[];
  /** Mag absoluut niet in beeld (bv. "geen kinderen alleen"). */
  must_avoid: string[];
  /** Merkidentiteit/sfeer voor terugkomende campagnes. */
  brand_identity?: string;
  /** Voorbeeld-overlay-teksten — strategist krijgt deze als inspiratie. */
  example_overlays: string[];
}

/**
 * Branch-specific defaults. We modelleren elke energiebranche zorgvuldig
 * met realistische scene-mogelijkheden en motivatie-gerichte overlays.
 *
 * Toevoeging van nieuwe branches: voeg een entry toe; de getter kiest
 * automatisch de juiste, en valt anders terug op een generieke set.
 */
export interface BranchVisualDefaults {
  audience_looks: AudienceLook[];
  settings: Setting[];
  moods: Mood[];
  color_focuses: ColorFocus[];
  styles_enabled: VisualStyle[];
  must_include: string[];
  must_avoid: string[];
  example_overlays: string[];
  brand_identity_hint?: string;
}

export const BRANCH_VISUAL_DEFAULTS: Record<string, BranchVisualDefaults> = {
  thuisbatterij: {
    audience_looks: ['gezin', 'stel-50plus', 'geen-mensen'],
    settings: ['woonkamer', 'dak', 'meterkast', 'tuin', 'installatie-moment'],
    moods: ['warm-eerlijk', 'rustig-betrouwbaar', 'urgent-actie'],
    color_focuses: ['warme-aardetinten', 'energie-groen', 'contrastrijk'],
    styles_enabled: [
      'lifestyle',
      'product_closeup',
      'social_proof',
      'bold_promo',
      'price_badge',
      'urgency_banner',
      'data_visual',
    ],
    must_include: [],
    must_avoid: ['kinderen alleen', 'medische beelden', 'voor-na splitscreens'],
    example_overlays: [
      'BESPAAR EUR 1200/JAAR',
      'GRATIS ADVIES',
      'SALDERING STOPT 2027',
      'NU AANVRAGEN',
      'EIGEN STROOM 24/7',
    ],
    brand_identity_hint:
      'Nederlands middenklasse-huishouden, eerlijk en betrouwbaar, geen overdreven luxe. Subtiele energie-groen en warme houttinten.',
  },
  airco: {
    audience_looks: ['gezin', 'stel-50plus', 'senior', 'geen-mensen'],
    settings: ['woonkamer', 'keuken', 'tuin', 'studio-product', 'installatie-moment'],
    moods: ['gezellig-familie', 'luxe-premium', 'urgent-actie', 'warm-eerlijk'],
    color_focuses: ['koel-blauw', 'warme-aardetinten', 'contrastrijk'],
    styles_enabled: [
      'lifestyle',
      'product_closeup',
      'emotional',
      'bold_promo',
      'price_badge',
      'urgency_banner',
    ],
    must_include: [],
    must_avoid: ['kinderen alleen', 'medische beelden', 'lawaaiig'],
    example_overlays: [
      'KOEL DEZE ZOMER',
      'ISDE-SUBSIDIE',
      'GRATIS ADVIES',
      'STIL EN ZUINIG',
      'BESTEL VOOR ZOMER',
    ],
    brand_identity_hint:
      'Comfort en stilte. Modern interieur, lichte tinten, koele frisheid. Geen bouwplaats-sfeer.',
  },
  zonnepanelen: {
    audience_looks: ['gezin', 'stel-50plus', 'geen-mensen'],
    settings: ['dak', 'tuin', 'oprit', 'installatie-moment', 'outdoor-straat'],
    moods: ['warm-eerlijk', 'nuchter-cijfers', 'urgent-actie'],
    color_focuses: ['warme-aardetinten', 'energie-groen', 'contrastrijk'],
    styles_enabled: [
      'lifestyle',
      'product_closeup',
      'social_proof',
      'bold_promo',
      'price_badge',
      'data_visual',
    ],
    must_include: [],
    must_avoid: ['kinderen alleen', 'medische beelden'],
    example_overlays: [
      'TERUGVERDIEND IN 6 JAAR',
      'GRATIS DAKCHECK',
      'BTW TERUG',
      'SUBSIDIE LOOPT TERUG',
      'BESPAAR DIRECT',
    ],
    brand_identity_hint:
      'Eerlijke ROI-verhaal. Nederlandse rijtjeshuizen, geen villa\'s. Heldere middag- of namiddagzon.',
  },
  warmtepomp: {
    audience_looks: ['gezin', 'stel-50plus', 'geen-mensen'],
    settings: ['woonkamer', 'tuin', 'meterkast', 'installatie-moment', 'studio-product'],
    moods: ['warm-eerlijk', 'rustig-betrouwbaar', 'luxe-premium', 'urgent-actie'],
    color_focuses: ['warme-aardetinten', 'koel-blauw', 'contrastrijk'],
    styles_enabled: [
      'lifestyle',
      'product_closeup',
      'emotional',
      'bold_promo',
      'price_badge',
      'urgency_banner',
      'data_visual',
    ],
    must_include: [],
    must_avoid: ['kinderen alleen', 'medische beelden'],
    example_overlays: [
      'GASLOOS WONEN',
      'ISDE-SUBSIDIE',
      'GRATIS WONINGCHECK',
      'TOT 70% ZUINIGER',
      'STOOKKOSTEN OMLAAG',
    ],
    brand_identity_hint:
      'Behaaglijke warmte zonder gas. Houten vloeren, warme verlichting, rustig interieur.',
  },
};

/** Generieke fallback voor onbekende branches (B2C huis-gerelateerd). */
const FALLBACK_DEFAULTS: BranchVisualDefaults = {
  audience_looks: ['gezin', 'geen-mensen'],
  settings: ['woonkamer', 'studio-product', 'outdoor-straat'],
  moods: ['warm-eerlijk', 'rustig-betrouwbaar'],
  color_focuses: ['warme-aardetinten', 'contrastrijk'],
  styles_enabled: [
    'lifestyle',
    'product_closeup',
    'emotional',
    'social_proof',
    'bold_promo',
    'price_badge',
  ],
  must_include: [],
  must_avoid: ['kinderen alleen', 'medische beelden'],
  example_overlays: ['GRATIS ADVIES', 'NU AANVRAGEN', 'BESPAAR DIRECT'],
};

/**
 * Haal de defaults op voor een branche. Onbekende branches krijgen de
 * generieke fallback zodat de UI altijd iets toont.
 */
export function getBranchVisualDefaults(branch: string): BranchVisualDefaults {
  return BRANCH_VISUAL_DEFAULTS[branch] || FALLBACK_DEFAULTS;
}

/**
 * Bouw een complete VisualDNA met alle defaults aangevinkt. Wordt door
 * StudioForm gebruikt als initial state — de admin kan dan vinkjes
 * weghalen of toevoegen.
 */
export function buildDefaultVisualDNA(branch: string): VisualDNA {
  const d = getBranchVisualDefaults(branch);
  return {
    audience_looks: [...d.audience_looks],
    settings: [...d.settings],
    moods: [...d.moods],
    color_focuses: [...d.color_focuses],
    styles_enabled: [...d.styles_enabled],
    overlay_frequency: 'ai_decides',
    must_include: [...d.must_include],
    must_avoid: [...d.must_avoid],
    brand_identity: d.brand_identity_hint || '',
    example_overlays: [...d.example_overlays],
  };
}

/**
 * Validatie: zorg dat een DNA-object niet leeg is (anders geen materiaal
 * voor de strategist). Geeft een lijst met problemen terug; als leeg
 * dan is alles oke.
 */
export function validateVisualDNA(dna: Partial<VisualDNA>): string[] {
  const issues: string[] = [];
  if (!dna.styles_enabled || dna.styles_enabled.length === 0) {
    issues.push('Minstens één visuele stijl aanvinken.');
  }
  if (!dna.settings || dna.settings.length === 0) {
    issues.push('Minstens één setting aanvinken zodat AI weet waar de scene speelt.');
  }
  if (!dna.moods || dna.moods.length === 0) {
    issues.push('Minstens één mood aanvinken.');
  }
  if (
    dna.overlay_frequency &&
    !(OVERLAY_FREQUENCIES as readonly string[]).includes(dna.overlay_frequency)
  ) {
    issues.push(`Onbekende overlay_frequency: ${dna.overlay_frequency}`);
  }
  return issues;
}

/**
 * Bereken de overlay-bias [0..1] die we doorgeven aan de strategist:
 *  - never   -> 0.0 (nooit)
 *  - low     -> 0.25
 *  - mixed   -> 0.50
 *  - high    -> 0.75
 *  - always  -> 1.0
 *  - ai_decides -> null (AI bepaalt zelf, geen druk)
 */
export function overlayBiasFromFrequency(freq: OverlayFrequency): number | null {
  switch (freq) {
    case 'never': return 0;
    case 'low': return 0.25;
    case 'mixed': return 0.5;
    case 'high': return 0.75;
    case 'always': return 1;
    case 'ai_decides':
    default:
      return null;
  }
}

export const __internal = { FALLBACK_DEFAULTS };
