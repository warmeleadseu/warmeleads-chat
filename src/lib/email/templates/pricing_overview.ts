import type { EmailTemplate } from './types';
import {
  applyMergeTags,
  asBoolean,
  asNumber,
  asString,
  composeShell,
  ctaButton,
  escape,
  greetingLine,
  htmlToText,
  INFO_BLOCK_OPTIONS,
  joinNL,
  paragraph,
  readInfoFlags,
  renderInfoBlocks,
  renderPricingBlock,
} from './_helpers';

export const pricingOverviewTemplate: EmailTemplate = {
  key: 'pricing_overview',
  label: 'Prijzen per branche',
  description:
    'Stuur een overzicht van de prijsstaffels per branche. Gebruikt bij prospects én klanten die om actuele tarieven vragen.',
  applicableTo: ['prospect', 'customer'],
  scope: 'pricing',
  options: [
    {
      key: 'branches',
      label: 'Welke branches in het overzicht',
      type: 'multiselect',
      source: 'branches',
      description: 'Verplicht: kies één of meer branches.',
    },
    {
      key: 'pricing_volume',
      label: 'Volume voor prijsstaffel-highlight',
      type: 'number',
      default: 25,
      min: 10,
      max: 500,
    },
    {
      key: 'intro_line',
      label: 'Aangepaste introzin',
      type: 'textarea',
      placeholder: 'Zoals besproken stuur ik je hierbij de prijzen door.',
    },
    {
      key: 'plan_gesprek_cta',
      label: '"Plan een gesprek"-knop tonen',
      type: 'boolean',
      default: true,
    },
    ...INFO_BLOCK_OPTIONS,
  ],
  defaultSubject: ctx => {
    const branches = (ctx.branchesSelected || []).map(b => b.name);
    if (branches.length === 1) return `Onze tarieven voor ${branches[0]}`;
    if (branches.length > 1) return `Onze tarieven voor ${joinNL(branches)}`;
    return 'Onze actuele tarieven';
  },
  render: ctx => {
    const intro = asString(ctx.optionValues.intro_line).trim();
    const planGesprek = asBoolean(ctx.optionValues.plan_gesprek_cta);
    const volume = asNumber(ctx.optionValues.pricing_volume, 25);
    const warnings: string[] = [];
    const parts: string[] = [];

    parts.push(`<p style="margin:0 0 18px;font-size:16px;font-weight:600">${greetingLine(ctx)}</p>`);

    if (intro) {
      const m = applyMergeTags(intro, ctx);
      if (m.missing.length) warnings.push(`Onbekende merge-tags in introzin: ${m.missing.join(', ')}`);
      parts.push(paragraph(escape(m.text)));
    } else {
      parts.push(paragraph('Bij deze ontvang je het overzicht met onze actuele prijzen.'));
    }

    if (ctx.branchesSelected.length === 0) {
      warnings.push('Geen branches geselecteerd — prijsblok ontbreekt.');
      parts.push(
        paragraph(
          '<em>Selecteer minstens één branche bij de opties om hier de prijsstaffels te tonen.</em>',
        ),
      );
    } else {
      parts.push(renderPricingBlock(ctx.branchesSelected, volume));
      parts.push(
        `<p style="margin:0 0 14px;font-size:12px;color:#94a3b8">Prijzen zijn excl. btw. Bij landelijke verspreiding gelden eventuele kortingen die hierboven al verwerkt staan.</p>`,
      );
    }

    const infoFlags = readInfoFlags(ctx.optionValues);
    parts.push(renderInfoBlocks(ctx, infoFlags));

    parts.push(
      paragraph(
        'Heb je vragen of wil je dat we even doorpraten over wat het beste past bij jullie volume? Bel of mail me gerust.',
      ),
    );

    if (planGesprek) {
      parts.push(ctaButton('Plan een gesprek', `${ctx.baseUrl}/plan-gesprek`));
    }

    parts.push(paragraph('Met vriendelijke groet,'));

    const html = composeShell({
      bodyHtml: parts.join(''),
      signatureHtml: ctx.signatureHtml,
      unsubscribeUrl: ctx.unsubscribeUrl,
    });
    return { subject: '', html, text: htmlToText(html), warnings };
  },
};
