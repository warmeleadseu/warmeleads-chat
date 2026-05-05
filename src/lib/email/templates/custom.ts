import type { EmailTemplate } from './types';
import {
  applyMergeTags,
  asBoolean,
  asNumber,
  asString,
  composeShell,
  ctaButton,
  htmlToText,
  INFO_BLOCK_OPTIONS,
  paragraph,
  readInfoFlags,
  renderInfoBlocks,
  renderPricingBlock,
} from './_helpers';

/**
 * Sanitize-helper voor de richtext-input. We staan een beperkte set tags toe
 * en strippen alle attributen behalve href/title op <a> en alt/src op <img>.
 * Hierdoor kan de AM redelijk vrij opmaken zonder dat we XSS-risico lopen
 * wanneer de preview in de admin gerenderd wordt.
 */
const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'a',
  'ul',
  'ol',
  'li',
  'blockquote',
  'h1',
  'h2',
  'h3',
  'h4',
  'span',
  'div',
]);

function sanitizeRichText(html: string): string {
  if (!html) return '';
  let out = html;
  out = out.replace(/<script[\s\S]*?<\/script>/gi, '');
  out = out.replace(/<style[\s\S]*?<\/style>/gi, '');
  out = out.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (full, tag: string, attrs: string) => {
    const t = tag.toLowerCase();
    if (!ALLOWED_TAGS.has(t)) return '';
    if (full.startsWith('</')) return `</${t}>`;
    if (t === 'a') {
      const hrefMatch = /href\s*=\s*["']([^"']+)["']/i.exec(attrs);
      const href = hrefMatch?.[1] || '';
      const safe = /^(https?:|mailto:|tel:|#)/i.test(href) ? href : '#';
      return `<a href="${safe}" target="_blank" rel="noopener noreferrer" style="color:#3B2F75;text-decoration:underline;font-weight:600">`;
    }
    return `<${t}>`;
  });
  out = out.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '');
  return out;
}

export const customTemplate: EmailTemplate = {
  key: 'custom',
  label: 'Vrij bericht',
  description:
    'Schrijf je eigen mail met opmaak. Merge-tags zoals {{first_name}}, {{company_name}}, {{am_first_name}} en {{branches_list}} worden automatisch ingevuld.',
  applicableTo: ['prospect', 'customer'],
  scope: 'marketing',
  options: [
    {
      key: 'subject_override',
      label: 'Onderwerp',
      type: 'text',
      placeholder: 'Bijvoorbeeld: Even kort, {{first_name}}',
      description: 'Verplicht. Merge-tags worden ondersteund.',
    },
    {
      key: 'body',
      label: 'Bericht',
      type: 'richtext',
      placeholder:
        'Hallo {{first_name}},\n\nIk dacht aan je vanwege ...\n\nMet vriendelijke groet,\n{{am_first_name}}',
      description: 'Vrije tekst, opmaak en merge-tags zijn toegestaan.',
    },
    {
      key: 'branches',
      label: 'Optioneel: branches om prijsstaffel toe te voegen',
      type: 'multiselect',
      source: 'branches',
    },
    {
      key: 'show_pricing',
      label: 'Prijzen onder het bericht tonen',
      type: 'boolean',
      default: false,
      showWhen: 'branches',
    },
    {
      key: 'pricing_volume',
      label: 'Volume voor prijsstaffel-highlight',
      type: 'number',
      default: 25,
      min: 10,
      max: 500,
      showWhen: 'show_pricing',
    },
    {
      key: 'cta_label',
      label: 'CTA-knoptekst (leeg = geen knop)',
      type: 'text',
      placeholder: 'Bijvoorbeeld: Plan een gesprek',
    },
    {
      key: 'cta_url',
      label: 'CTA-knop URL',
      type: 'text',
      placeholder: 'https://www.warmeleads.eu/plan-gesprek',
      showWhen: 'cta_label',
    },
    ...INFO_BLOCK_OPTIONS,
  ],
  defaultSubject: ctx => {
    const sub = asString(ctx.optionValues.subject_override).trim();
    if (sub) {
      const m = applyMergeTags(sub, ctx);
      return m.text;
    }
    return ctx.recipient.companyName ? `Voor ${ctx.recipient.companyName}` : 'Hallo';
  },
  render: ctx => {
    const warnings: string[] = [];
    const subjectRaw = asString(ctx.optionValues.subject_override).trim();
    const bodyRaw = asString(ctx.optionValues.body);
    const showPricing = asBoolean(ctx.optionValues.show_pricing);
    const ctaLabel = asString(ctx.optionValues.cta_label).trim();
    const ctaUrl = asString(ctx.optionValues.cta_url).trim();
    const volume = asNumber(ctx.optionValues.pricing_volume, 25);

    if (!subjectRaw) warnings.push('Geen onderwerp ingevuld.');
    if (!bodyRaw) warnings.push('Geen bericht ingevuld.');

    const parts: string[] = [];

    let bodyHtml = '';
    if (bodyRaw) {
      // Detecteer of dit al HTML is (bevat tags) of platte tekst.
      const isHtml = /<[a-z][\s\S]*>/i.test(bodyRaw);
      const m = applyMergeTags(bodyRaw, ctx);
      if (m.missing.length) warnings.push(`Onbekende merge-tags: ${m.missing.join(', ')}`);
      if (isHtml) {
        bodyHtml = sanitizeRichText(m.text);
      } else {
        // Plain-text → paragraphs op dubbele newline, <br/> op enkele.
        bodyHtml = m.text
          .split(/\n{2,}/)
          .map(block => paragraph(block.replace(/\n/g, '<br/>')))
          .join('');
      }
      parts.push(bodyHtml);
    } else {
      parts.push(paragraph('<em>(geen inhoud)</em>'));
    }

    if (showPricing && ctx.branchesSelected.length > 0) {
      parts.push(
        `<p style="margin:18px 0 6px;font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Onze prijzen</p>`,
      );
      parts.push(renderPricingBlock(ctx.branchesSelected, volume));
    } else if (showPricing) {
      warnings.push('Prijzen tonen aangevinkt maar geen branches geselecteerd.');
    }

    const infoFlags = readInfoFlags(ctx.optionValues);
    parts.push(renderInfoBlocks(ctx, infoFlags));

    if (ctaLabel) {
      const url = ctaUrl || `${ctx.baseUrl}/plan-gesprek`;
      parts.push(ctaButton(ctaLabel, url));
    }

    const html = composeShell({
      bodyHtml: parts.join(''),
      signatureHtml: ctx.signatureHtml,
      unsubscribeUrl: ctx.unsubscribeUrl,
    });
    return { subject: '', html, text: htmlToText(html), warnings };
  },
};
