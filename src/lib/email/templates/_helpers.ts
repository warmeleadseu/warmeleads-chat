import type { PricingTier } from '@/lib/pricing';
import { sortTiersAscending } from '@/lib/pricing';
import type { BranchCtx, RenderCtx, TemplateOption } from './types';

export function escape(s: string | number | null | undefined): string {
  if (s === null || s === undefined || s === '') return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>(?=\s*\n?)/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr|table)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Vervangt {{merge_tags}} in een vrije-tekst veld door waarden uit de
 * render-context. Onbekende tags worden gestripd en geretourneerd als
 * warning zodat de UI ze kan tonen.
 */
export function applyMergeTags(
  input: string,
  ctx: RenderCtx,
): { text: string; missing: string[] } {
  const missing: string[] = [];
  const map: Record<string, string> = {
    first_name: ctx.recipient.firstName || ctx.recipient.name.split(' ')[0] || '',
    contact_name: ctx.recipient.name,
    company_name: ctx.recipient.companyName,
    am_first_name: ctx.admin.firstName,
    am_name: ctx.admin.name,
    am_email: ctx.admin.email,
    am_phone: ctx.admin.phone || '',
    branches_list: ctx.branchesSelected.map(b => b.name).join(', '),
  };
  const text = input.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (full, key: string) => {
    const k = key.toLowerCase();
    if (k in map) return map[k] || '';
    if (!missing.includes(k)) missing.push(k);
    return '';
  });
  return { text, missing };
}

const EURO = (v: number) => '€' + v.toFixed(2).replace('.', ',');

/**
 * HTML-blok met prijsstaffel voor de geselecteerde branches.
 * Toont per branche de effectieve tiers (incl. customer-overrides) en
 * markeert het tier dat past bij het opgegeven volume.
 */
export function renderPricingBlock(
  branches: BranchCtx[],
  volume?: number | null,
): string {
  if (!branches.length) return '';
  const blocks = branches
    .map(b => {
      const tiers = sortTiersAscending(b.effectiveTiers);
      if (!tiers.length) {
        return `<div style="margin:18px 0;padding:14px 16px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;font-size:14px;color:#7c2d12">
          <strong>${escape(b.name)}</strong>: prijzen op aanvraag.
        </div>`;
      }
      const rows = tiers
        .map(t => {
          const isMatch =
            typeof volume === 'number' &&
            volume >= t.min_leads &&
            !tiers.some(x => x.min_leads > t.min_leads && volume >= x.min_leads);
          const bg = isMatch ? 'background:#ecfdf5;' : '';
          const fontWeight = isMatch ? '700' : '500';
          const color = isMatch ? '#059669' : '#0f172a';
          return `<tr>
            <td style="padding:8px 14px;font-size:13px;color:#475569;border-bottom:1px solid #f1f5f9;${bg}">vanaf ${t.min_leads} leads</td>
            <td style="padding:8px 14px;font-size:13px;color:${color};font-weight:${fontWeight};text-align:right;border-bottom:1px solid #f1f5f9;${bg}">${EURO(t.price_per_lead)} <span style="font-weight:400;color:#94a3b8">/ lead</span></td>
          </tr>`;
        })
        .join('');
      const discount =
        b.nationwideDiscount > 0
          ? `<div style="margin-top:8px;font-size:12px;color:#64748b">Landelijk verspreid: ${EURO(b.nationwideDiscount)} korting per lead.</div>`
          : '';
      return `<div style="margin:18px 0">
        <div style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:8px">${escape(b.name)}</div>
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;border-collapse:separate;border-spacing:0">${rows}</table>
        ${discount}
      </div>`;
    })
    .join('');
  return blocks;
}

/**
 * Plaintext-versie van de pricingblok voor de text/plain body.
 */
export function renderPricingText(
  branches: BranchCtx[],
  volume?: number | null,
): string {
  if (!branches.length) return '';
  return branches
    .map(b => {
      const tiers = sortTiersAscending(b.effectiveTiers);
      if (!tiers.length) return `${b.name}: prijzen op aanvraag`;
      const lines = tiers.map(t => {
        const marker =
          typeof volume === 'number' &&
          volume >= t.min_leads &&
          !tiers.some(x => x.min_leads > t.min_leads && volume >= x.min_leads)
            ? '➜ '
            : '  ';
        return `${marker}vanaf ${t.min_leads} leads: ${EURO(t.price_per_lead)} per lead`;
      });
      return `${b.name}\n${lines.join('\n')}`;
    })
    .join('\n\n');
}

/**
 * Standaard layout-shell voor AM-mails: simpel, persoonlijk, geen WL-header.
 * De ontvanger ziet de mail als 1-op-1 communicatie van de AM zelf.
 */
export function composeShell(opts: {
  bodyHtml: string;
  signatureHtml: string;
  unsubscribeUrl: string | null;
}): string {
  const unsubBlock = opts.unsubscribeUrl
    ? `<tr><td style="padding:24px 0 0;text-align:center;font-size:11px;color:#94a3b8;line-height:1.6">
        Wil je geen e-mails meer van ons ontvangen? <a href="${opts.unsubscribeUrl}" style="color:#94a3b8;text-decoration:underline">Schrijf je hier uit</a>.
      </td></tr>`
    : '';
  return `<!DOCTYPE html>
<html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;color:#0f172a">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f8fafc">
    <tr><td align="center" style="padding:32px 16px">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px">
        <tr><td style="padding:32px 36px;font-size:15px;line-height:1.7;color:#0f172a">
          ${opts.bodyHtml}
          <div style="margin-top:32px;padding-top:24px;border-top:1px solid #e2e8f0">${opts.signatureHtml}</div>
        </td></tr>
      </table>
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%">
        ${unsubBlock}
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function paragraph(text: string): string {
  return `<p style="margin:0 0 14px">${text}</p>`;
}

export function ctaButton(label: string, url: string): string {
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:18px 0">
    <tr><td style="border-radius:10px;background:linear-gradient(135deg,#FF6B35,#FF4757)">
      <a href="${url}" target="_blank" style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.3px">${escape(label)} →</a>
    </td></tr>
  </table>`;
}

export function tipBox(html: string): string {
  return `<div style="margin:18px 0;padding:14px 18px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;font-size:14px;color:#92400e">${html}</div>`;
}

export function quoteBox(html: string): string {
  return `<div style="margin:18px 0;padding:14px 18px;background:#f8fafc;border-left:3px solid #3B2F75;border-radius:6px;font-size:14px;color:#475569;font-style:italic">${html}</div>`;
}

export function pickFirstName(name: string): string {
  return (name || '').trim().split(/\s+/)[0] || '';
}

/**
 * Greeting met natuurlijke fallback. We gebruiken voornaam wanneer mogelijk;
 * anders 'Hallo' zonder naam (klinkt natuurlijker dan 'Hallo bedrijf').
 */
export function greetingLine(ctx: RenderCtx): string {
  const fn = ctx.recipient.firstName.trim();
  if (fn) return `Hallo ${escape(fn)},`;
  return 'Goedendag,';
}

export function joinNL(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} en ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} en ${items[items.length - 1]}`;
}

export function pricingHasAny(branches: BranchCtx[]): boolean {
  return branches.some(b => (b.effectiveTiers || []).length > 0);
}

export function tierAt(volume: number, tiers: PricingTier[]): PricingTier | null {
  const sorted = [...tiers].sort((a, b) => b.min_leads - a.min_leads);
  return sorted.find(t => volume >= t.min_leads) ?? null;
}

export function asBoolean(v: unknown): boolean {
  if (v === true || v === 1 || v === '1' || v === 'true') return true;
  return false;
}

export function asNumber(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
}

export function asString(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

export function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.length > 0);
}

/* -------------------------------------------------------------------------- */
/*  Info-blokken (over WarmeLeads, werkwijze, garanties, portaal, etc.)       */
/* -------------------------------------------------------------------------- */
/*                                                                            */
/*  Deze blokken zijn geschreven op basis van de marketing-copy op            */
/*  warmeleads.eu en zijn 1-op-1 in lijn met wat ontvangers daar lezen. Zo    */
/*  loopt iedere AM-mail consistent met de website. Elk blok komt in een      */
/*  vaste, herbruikbare visuele stijl die past bij `composeShell`.            */
/* -------------------------------------------------------------------------- */

function sectionTitle(label: string): string {
  return `<p style="margin:24px 0 10px;font-size:13px;font-weight:700;color:#3B2F75;text-transform:uppercase;letter-spacing:0.6px">${escape(
    label,
  )}</p>`;
}

function infoCard(html: string): string {
  return `<div style="margin:0 0 14px;padding:16px 18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;line-height:1.6;color:#0f172a">${html}</div>`;
}

function bulletList(items: string[]): string {
  const lis = items
    .map(
      i =>
        `<li style="margin:0 0 6px;padding:0 0 0 4px;line-height:1.55">${i}</li>`,
    )
    .join('');
  return `<ul style="margin:8px 0 14px;padding:0 0 0 22px;color:#0f172a;font-size:14px">${lis}</ul>`;
}

function statTile(value: string, label: string): string {
  return `<td valign="top" align="center" style="padding:10px 6px;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;width:25%">
    <div style="font-size:18px;font-weight:800;color:#3B2F75;line-height:1.1">${escape(value)}</div>
    <div style="margin-top:4px;font-size:11px;color:#64748b;line-height:1.3">${escape(label)}</div>
  </td>`;
}

/** Blok 1: Wie is WarmeLeads (propositie + persoonlijke AM). */
export function infoAboutBlock(): string {
  return [
    sectionTitle('Over WarmeLeads'),
    paragraph(
      'WarmeLeads levert moderne leadinfrastructuur voor installateurs en energiepartners. We genereren <strong>exclusieve, verse leads</strong> uit eigen campagnes: realtime in jouw portaal, automatisch gekwalificeerd en met een persoonlijke accountmanager die met je meedenkt. Geen callcenter, geen doorverkoop.',
    ),
  ].join('');
}

/** Blok 2: Hoe het werkt (4 stappen, 24-72u live). */
export function infoHowItWorksBlock(): string {
  return [
    sectionTitle('Zo werken we samen'),
    bulletList([
      '<strong>Strategiegesprek</strong>: we bespreken doelgroep, regio, volume, kostprijs per lead en stellen samen een plan op.',
      '<strong>Campagne op maat</strong>: gemiddeld <strong>binnen 24 tot 72 uur</strong> live na goedkeuring.',
      '<strong>Automatische quality checks</strong>: telefoon- en e-mailverificatie, adresverrijking en kwaliteitsscore per lead.',
      '<strong>Realtime in jouw portaal</strong>: direct opvolgen, met notities, status en feedback.',
    ]),
    paragraph(
      '<span style="color:#64748b;font-size:13px">Geen abonnement, geen vaste kosten, geen lock-in. Je betaalt per lead.</span>',
    ),
  ].join('');
}

/** Blok 3: Kwaliteitsgaranties (exclusiviteit, verse leads, reclamatie). */
export function infoQualityBlock(): string {
  return [
    sectionTitle('Onze kwaliteitsgaranties'),
    bulletList([
      '<strong>100% exclusief</strong>: leads worden niet doorverkocht of gedeeld. Jouw lead = jouw prospect.',
      '<strong>Vers en realtime</strong>: direct uit onze eigen campagnes, geen recycled lijsten.',
      '<strong>Eerste levering binnen 24 uur</strong> na het live gaan van de campagne.',
      '<strong>Reclamatiebeleid</strong>: meld een lead in het portaal; bij gegronde klacht ontvang je vervanging of compensatie.',
    ]),
  ].join('');
}

/** Blok 4: Branches die we doen + maatwerk-mogelijkheden. */
export function infoBranchesBlock(): string {
  return [
    sectionTitle('Branches die we door en door kennen'),
    paragraph(
      'We zijn gespecialiseerd in 8 verticals: <strong>zonnepanelen</strong>, <strong>warmtepompen</strong>, <strong>thuisbatterijen</strong>, <strong>airco</strong>, <strong>financial lease</strong>, <strong>isolatie</strong>, <strong>laadpalen</strong> en <strong>B2B energie</strong>. Daarnaast genereren we leads in vrijwel elke andere branche op aanvraag.',
    ),
    infoCard(
      '<strong>Nieuwe niche?</strong> Voor branches buiten ons standaardaanbod werken we met een <strong>onderzoekstarief van €1.000</strong>, dat je <strong>100% terug ontvangt in leads</strong> zodra de campagne live gaat. Doorlooptijd: 2 tot 4 weken.',
    ),
  ].join('');
}

/** Blok 5: Hoe ons portaal werkt. */
export function infoPortalBlock(baseUrl: string): string {
  const safeUrl = `${baseUrl.replace(/\/$/, '')}/portal`;
  return [
    sectionTitle('Hoe ons portaal werkt'),
    paragraph(
      `Alle leads komen realtime binnen op <a href="${escape(safeUrl)}" style="color:#3B2F75;font-weight:600;text-decoration:underline">${escape(safeUrl)}</a>. Inloggen kan op desktop én op je telefoon (installeerbaar als app).`,
    ),
    bulletList([
      'Direct bellen, WhatsAppen of mailen vanuit het portaal.',
      'Push- én e-mailnotificaties zodra er een nieuwe lead binnenkomt.',
      'Per lead: notities, statussen, feedback en historie.',
      'Filters, batch-voortgang en exports voor je administratie.',
      'Webhooks en API beschikbaar voor koppeling met je CRM of rooster.',
    ]),
  ].join('');
}

/** Blok 6: Welkomstkorting / pricing-aanpak. */
export function infoWelcomeOfferBlock(): string {
  return [
    sectionTitle('Welkomstaanbieding'),
    infoCard(
      '<strong>20% welkomstkorting</strong> op je eerste batch. Geen abonnement, geen vaste kosten en geen lock-in: je betaalt simpelweg per lead. Lopen we tegen problemen aan, dan stoppen we per direct.',
    ),
  ].join('');
}

/** Blok 7: Sociaal bewijs / cijfers. */
export function infoSocialProofBlock(): string {
  return [
    sectionTitle('In cijfers'),
    `<table cellpadding="0" cellspacing="6" role="presentation" style="margin:0 0 14px;border-collapse:separate;width:100%">
      <tr>
        ${statTile('750+', 'batches geleverd')}
        ${statTile('25+', 'actieve niches')}
        ${statTile('4.8★', 'klantwaardering')}
        ${statTile('92%', 'retentie na 6 mnd')}
      </tr>
    </table>`,
    `<p style="margin:0 0 14px;font-size:12px;color:#94a3b8">Actief in heel Nederland en België. Eerste levering doorgaans binnen 24 uur.</p>`,
  ].join('');
}

/** Blok 8: Reclamatie- / herleveringsbeleid (kort). */
export function infoReclamationBlock(): string {
  return [
    sectionTitle('Reclamatie & herlevering'),
    paragraph(
      'Niet alle leads zijn perfect, dat snappen we. Meld een twijfelgeval direct in het portaal met je feedback. Elke melding wordt individueel beoordeeld; bij gegronde reclamatie ontvang je <strong>vervanging of compensatie</strong>. Volledige voorwaarden staan in onze Algemene Voorwaarden.',
    ),
  ].join('');
}

/** Centraal: rendert alle aangevinkte info-blokken in een vaste volgorde. */
export function renderInfoBlocks(
  ctx: RenderCtx,
  flags: {
    about?: boolean;
    howItWorks?: boolean;
    quality?: boolean;
    branchesOverview?: boolean;
    portal?: boolean;
    welcomeOffer?: boolean;
    socialProof?: boolean;
    reclamation?: boolean;
  },
): string {
  const out: string[] = [];
  if (flags.about) out.push(infoAboutBlock());
  if (flags.branchesOverview) out.push(infoBranchesBlock());
  if (flags.howItWorks) out.push(infoHowItWorksBlock());
  if (flags.quality) out.push(infoQualityBlock());
  if (flags.portal) out.push(infoPortalBlock(ctx.baseUrl));
  if (flags.reclamation) out.push(infoReclamationBlock());
  if (flags.welcomeOffer) out.push(infoWelcomeOfferBlock());
  if (flags.socialProof) out.push(infoSocialProofBlock());
  return out.join('');
}

/** De 8 standaard info-toggle-opties die templates kunnen hergebruiken. */
export const INFO_BLOCK_OPTIONS: TemplateOption[] = [
  {
    key: 'include_about',
    label: 'Korte intro "Over WarmeLeads"',
    type: 'boolean',
    default: false,
    description: 'Eén alinea met onze propositie (exclusief, verse leads, persoonlijke AM).',
  },
  {
    key: 'include_branches_overview',
    label: 'Overzicht van onze branches + maatwerk',
    type: 'boolean',
    default: false,
    description: 'De 8 verticals + uitleg over maatwerk-niches (€1.000, 100% terug in leads).',
  },
  {
    key: 'include_how_it_works',
    label: 'Werkwijze in 4 stappen',
    type: 'boolean',
    default: false,
    description: 'Strategiegesprek → campagne in 24-72u → quality checks → realtime portaal.',
  },
  {
    key: 'include_quality',
    label: 'Kwaliteitsgaranties (exclusief, vers, <24u)',
    type: 'boolean',
    default: false,
  },
  {
    key: 'include_portal_features',
    label: 'Hoe ons portaal werkt',
    type: 'boolean',
    default: false,
    description: 'Realtime leads, mobiele app, notificaties, filters, webhooks.',
  },
  {
    key: 'include_reclamation',
    label: 'Reclamatie- en herleveringsbeleid',
    type: 'boolean',
    default: false,
  },
  {
    key: 'include_welcome_offer',
    label: '20% welkomstkorting noemen',
    type: 'boolean',
    default: false,
    description: 'Voor nieuwe prospects: 20% op de eerste batch, geen lock-in.',
  },
  {
    key: 'include_social_proof',
    label: 'Cijfers / sociaal bewijs',
    type: 'boolean',
    default: false,
    description: '750+ batches, 25+ niches, 4.8★, 92% retentie na 6 mnd.',
  },
];

/** Helper: leest de 8 vlaggen in 1x uit de optionValues. */
export function readInfoFlags(values: Record<string, unknown>) {
  return {
    about: asBoolean(values.include_about),
    branchesOverview: asBoolean(values.include_branches_overview),
    howItWorks: asBoolean(values.include_how_it_works),
    quality: asBoolean(values.include_quality),
    portal: asBoolean(values.include_portal_features),
    reclamation: asBoolean(values.include_reclamation),
    welcomeOffer: asBoolean(values.include_welcome_offer),
    socialProof: asBoolean(values.include_social_proof),
  };
}
