import type { EmailTemplate } from './types';
import {
  applyMergeTags,
  asBoolean,
  asString,
  composeShell,
  ctaButton,
  escape,
  greetingLine,
  htmlToText,
  joinNL,
  paragraph,
  tipBox,
} from './_helpers';

export const welcomeCustomerTemplate: EmailTemplate = {
  key: 'welcome_customer',
  label: 'Welkom & next steps',
  description:
    'Persoonlijk welkomstbericht voor een nieuwe klant met portaal-instructies en next steps.',
  applicableTo: ['customer'],
  scope: 'nurture',
  options: [
    {
      key: 'opening_line',
      label: 'Persoonlijke openingszin',
      type: 'textarea',
      placeholder: 'Top dat we vandaag de samenwerking zijn gestart!',
    },
    {
      key: 'mention_branches',
      label: 'Branches benoemen die de klant heeft',
      type: 'boolean',
      default: true,
    },
    {
      key: 'portal_link',
      label: 'Portaal-link tonen',
      type: 'boolean',
      default: true,
    },
    {
      key: 'mention_first_batch',
      label: 'Tip over eerste batch ordenen',
      type: 'boolean',
      default: true,
    },
  ],
  defaultSubject: ctx =>
    ctx.recipient.companyName
      ? `Welkom bij WarmeLeads, ${ctx.recipient.companyName}`
      : 'Welkom bij WarmeLeads',
  render: ctx => {
    const opening = asString(ctx.optionValues.opening_line).trim();
    const mentionBranches = asBoolean(ctx.optionValues.mention_branches);
    const portalLink = asBoolean(ctx.optionValues.portal_link);
    const mentionBatch = asBoolean(ctx.optionValues.mention_first_batch);
    const warnings: string[] = [];
    const parts: string[] = [];

    parts.push(`<p style="margin:0 0 18px;font-size:16px;font-weight:600">${greetingLine(ctx)}</p>`);

    if (opening) {
      const m = applyMergeTags(opening, ctx);
      if (m.missing.length) warnings.push(`Onbekende merge-tags: ${m.missing.join(', ')}`);
      parts.push(paragraph(escape(m.text)));
    } else {
      parts.push(
        paragraph(
          'Welkom bij WarmeLeads! Fijn dat we de samenwerking zijn gestart. Ik ben je vaste contactpersoon en help je graag op weg.',
        ),
      );
    }

    if (mentionBranches && ctx.recipient.branches.length > 0) {
      const branchNames = ctx.recipient.branches.map(b => `<strong>${escape(b)}</strong>`);
      parts.push(
        paragraph(
          `In je account staan momenteel: ${joinNL(branchNames)}. Wil je een branche toevoegen of aanpassen? Stuur even een bericht.`,
        ),
      );
    }

    if (portalLink) {
      parts.push(
        paragraph(
          'Inloggen kan via het klantenportaal — daar zie je live je leads, batches en facturen.',
        ),
      );
      parts.push(ctaButton('Naar je portaal', `${ctx.baseUrl}/portal`));
    }

    if (mentionBatch) {
      parts.push(
        tipBox(
          '<strong>Tip:</strong> begin met een batch van 25 of 50 leads, zo zie je in 2-3 weken al concreet wat de conversie doet voor jouw aanpak. We schalen daarna samen op.',
        ),
      );
    }

    parts.push(
      paragraph('Heb je vragen? Bel of mail me direct — ik reageer doorgaans binnen een paar uur.'),
    );

    parts.push(paragraph('Met vriendelijke groet,'));

    const html = composeShell({
      bodyHtml: parts.join(''),
      signatureHtml: ctx.signatureHtml,
      unsubscribeUrl: ctx.unsubscribeUrl,
    });
    return { subject: '', html, text: htmlToText(html), warnings };
  },
};
