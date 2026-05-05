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
  quoteBox,
  readInfoFlags,
  renderInfoBlocks,
  renderPricingBlock,
  tipBox,
} from './_helpers';

export const proposalTemplate: EmailTemplate = {
  key: 'proposal',
  label: 'Voorstel met prijzen',
  description:
    'Concreet voorstel naar een prospect met geadviseerde branche(s), batchgrootte en bijhorend tarief.',
  applicableTo: ['prospect'],
  scope: 'pricing',
  options: [
    {
      key: 'branches',
      label: 'Branches in het voorstel',
      type: 'multiselect',
      source: 'branches',
      description: 'Verplicht: één of meer branches.',
    },
    {
      key: 'pricing_volume',
      label: 'Voorgestelde batchgrootte (#leads)',
      type: 'number',
      default: 50,
      min: 10,
      max: 500,
    },
    {
      key: 'intro_recap',
      label: 'Opening (waar haakte het op aan)',
      type: 'textarea',
      placeholder: 'Naar aanleiding van ons gesprek vorige week stuur ik je hierbij het voorstel.',
    },
    {
      key: 'highlight_landelijk',
      label: 'Landelijke verspreiding aanbevelen',
      type: 'boolean',
      default: false,
      description: 'Voegt een tip toe over de landelijke korting.',
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
    const volume = asNumber(ctx.optionValues.pricing_volume, 50);
    const branches = (ctx.branchesSelected || []).map(b => b.name);
    if (branches.length === 1) return `Voorstel ${volume} leads — ${branches[0]}`;
    if (branches.length > 1) return `Voorstel ${volume} leads — ${joinNL(branches)}`;
    return `Voorstel ${volume} leads — ${ctx.recipient.companyName}`;
  },
  render: ctx => {
    const intro = asString(ctx.optionValues.intro_recap).trim();
    const planGesprek = asBoolean(ctx.optionValues.plan_gesprek_cta);
    const volume = asNumber(ctx.optionValues.pricing_volume, 50);
    const landelijk = asBoolean(ctx.optionValues.highlight_landelijk);
    const warnings: string[] = [];
    const parts: string[] = [];

    parts.push(`<p style="margin:0 0 18px;font-size:16px;font-weight:600">${greetingLine(ctx)}</p>`);

    if (intro) {
      const m = applyMergeTags(intro, ctx);
      if (m.missing.length) warnings.push(`Onbekende merge-tags in opening: ${m.missing.join(', ')}`);
      parts.push(paragraph(escape(m.text)));
    } else {
      parts.push(
        paragraph(
          'Naar aanleiding van ons contact stuur ik je hierbij een concreet voorstel.',
        ),
      );
    }

    if (ctx.branchesSelected.length === 0) {
      warnings.push('Geen branches geselecteerd — voorstel mist branche-overzicht.');
    } else {
      const branchNames = ctx.branchesSelected.map(b => `<strong>${escape(b.name)}</strong>`);
      parts.push(
        quoteBox(
          `Mijn voorstel: een batch van <strong>${volume} leads</strong> in ${joinNL(branchNames)}. We leveren de leads gespreid en je kunt na elke geleverde lead direct opvolgen.`,
        ),
      );
      parts.push(
        `<p style="margin:18px 0 6px;font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Tarief bij ${volume} leads</p>`,
      );
      parts.push(renderPricingBlock(ctx.branchesSelected, volume));
    }

    if (landelijk) {
      parts.push(
        tipBox(
          '<strong>Tip:</strong> bij landelijke verspreiding ontvang je een extra korting per lead. Geef het door als je je niet wilt beperken tot één regio.',
        ),
      );
    }

    const infoFlags = readInfoFlags(ctx.optionValues);
    parts.push(renderInfoBlocks(ctx, infoFlags));

    parts.push(
      paragraph(
        'Akkoord op het voorstel? Dan zet ik het in en kan de levering binnen 1-2 werkdagen starten. Wil je nog even sparren?',
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
