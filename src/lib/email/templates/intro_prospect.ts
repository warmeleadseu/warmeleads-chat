import type { EmailTemplate } from './types';
import {
  applyMergeTags,
  asBoolean,
  asNumber,
  asString,
  asStringArray,
  composeShell,
  ctaButton,
  escape,
  greetingLine,
  htmlToText,
  joinNL,
  paragraph,
  pickFirstName,
  renderPricingBlock,
} from './_helpers';

export const introProspectTemplate: EmailTemplate = {
  key: 'intro_prospect',
  label: 'Eerste kennismaking',
  description:
    'Korte introductie naar een nieuwe prospect met optionele branche-uitlichting, prijzen en plan-gesprek-knop.',
  applicableTo: ['prospect'],
  scope: 'marketing',
  options: [
    {
      key: 'opening_line',
      label: 'Persoonlijke openingszin',
      type: 'textarea',
      placeholder: 'Mooi om je laatst op de installatiebeurs te spreken.',
      description: 'Optioneel. Wordt direct na de aanhef getoond.',
    },
    {
      key: 'branches',
      label: 'Branches om uit te lichten',
      type: 'multiselect',
      source: 'branches',
      description: 'Welke branches noem je in deze mail?',
    },
    {
      key: 'show_pricing',
      label: 'Prijzen per geselecteerde branche tonen',
      type: 'boolean',
      default: false,
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
      key: 'plan_gesprek_cta',
      label: '"Plan een gesprek"-knop tonen',
      type: 'boolean',
      default: true,
    },
    {
      key: 'mention_eu_2025_market',
      label: 'EU-markttrend-zin meenemen',
      type: 'boolean',
      default: false,
      description: 'Voegt een korte zin toe over de groei van de installatiemarkt in 2026.',
    },
  ],
  defaultSubject: ctx => {
    const branches = (ctx.branchesSelected || []).map(b => b.name);
    if (branches.length === 1) {
      return `Warme leads voor ${branches[0]}`;
    }
    if (branches.length > 1) {
      return `Warme leads voor ${joinNL(branches)}`;
    }
    return `Kennismaken — ${ctx.recipient.companyName}`;
  },
  render: ctx => {
    const opening = asString(ctx.optionValues.opening_line).trim();
    const showPricing = asBoolean(ctx.optionValues.show_pricing);
    const planGesprek = asBoolean(ctx.optionValues.plan_gesprek_cta);
    const mentionMarket = asBoolean(ctx.optionValues.mention_eu_2025_market);
    const volume = asNumber(ctx.optionValues.pricing_volume, 25);
    const branchSelected = ctx.branchesSelected;
    const warnings: string[] = [];

    const parts: string[] = [];
    parts.push(`<p style="margin:0 0 18px;font-size:16px;font-weight:600">${greetingLine(ctx)}</p>`);

    if (opening) {
      const m = applyMergeTags(opening, ctx);
      if (m.missing.length > 0) {
        warnings.push(`Onbekende merge-tags in openingszin: ${m.missing.join(', ')}`);
      }
      parts.push(paragraph(escape(m.text)));
    }

    parts.push(
      paragraph(
        `Mijn naam is ${escape(ctx.admin.firstName)} en ik ben accountmanager bij <strong>WarmeLeads</strong>. Wij leveren warme leads aan installateurs en helpen jullie om consistent nieuwe opdrachten binnen te halen — zonder zelf te hoeven prospecteren.`,
      ),
    );

    if (branchSelected.length > 0) {
      const branchNames = branchSelected.map(b => `<strong>${escape(b.name)}</strong>`);
      parts.push(
        paragraph(
          `Voor ${ctx.recipient.companyName ? escape(ctx.recipient.companyName) + ' ' : ''}zou ik vooral kijken naar ${joinNL(branchNames)}: hier hebben we doorlopend volume en goede conversies.`,
        ),
      );
    }

    if (showPricing && branchSelected.length > 0) {
      parts.push(
        `<p style="margin:18px 0 6px;font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Indicatieve prijzen</p>`,
      );
      parts.push(renderPricingBlock(branchSelected, volume));
      parts.push(
        `<p style="margin:0 0 14px;font-size:12px;color:#94a3b8">Prijzen excl. btw. Volume-staffel ingesteld op ${volume} leads voor de highlight.</p>`,
      );
    } else if (showPricing && branchSelected.length === 0) {
      warnings.push('Prijzen tonen aangevinkt maar geen branches geselecteerd — prijsblok wordt niet getoond.');
    }

    if (mentionMarket) {
      parts.push(
        paragraph(
          'De installatiemarkt blijft groeien — vooral in warmtepompen en zonnepanelen zien we 2026 weer een sterke vraag. Dat betekent meer goede leads beschikbaar dan ooit.',
        ),
      );
    }

    parts.push(
      paragraph(
        'Heb je 15 minuten om kort te bellen? Dan kan ik laten zien wat de mogelijkheden zijn voor jullie regio en branche.',
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

    return {
      subject: '',
      html,
      text: htmlToText(html),
      warnings,
    };
  },
};

export { pickFirstName as _pickFirstName };
