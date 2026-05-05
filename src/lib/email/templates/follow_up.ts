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
  paragraph,
} from './_helpers';

export const followUpTemplate: EmailTemplate = {
  key: 'follow_up',
  label: 'Stille opvolging',
  description:
    'Korte, vriendelijke opvolging als het even stil is geweest. Werkt voor zowel prospects als bestaande klanten.',
  applicableTo: ['prospect', 'customer'],
  scope: 'nurture',
  options: [
    {
      key: 'context',
      label: 'Waar haak je op aan?',
      type: 'textarea',
      placeholder:
        'Ik wilde even checken hoe het staat met het voorstel dat ik vorige week stuurde.',
      description: 'Gebruik dit als kort kapstokje voor de mail. {{first_name}} en {{am_first_name}} zijn ondersteund.',
    },
    {
      key: 'plan_gesprek_cta',
      label: '"Plan een gesprek"-knop tonen',
      type: 'boolean',
      default: true,
    },
    {
      key: 'soft_close',
      label: 'Zachte afsluiting',
      type: 'boolean',
      default: true,
      description: 'Sluit af met "geen reactie = geen probleem" — werkt vaak beter dan harde druk.',
    },
  ],
  defaultSubject: ctx =>
    ctx.recipient.companyName
      ? `Even kort: ${ctx.recipient.companyName}`
      : `Even kort, ${ctx.recipient.firstName || 'hallo'}`,
  render: ctx => {
    const context = asString(ctx.optionValues.context).trim();
    const planGesprek = asBoolean(ctx.optionValues.plan_gesprek_cta);
    const softClose = asBoolean(ctx.optionValues.soft_close);
    const warnings: string[] = [];
    const parts: string[] = [];

    parts.push(`<p style="margin:0 0 18px;font-size:16px;font-weight:600">${greetingLine(ctx)}</p>`);

    if (context) {
      const m = applyMergeTags(context, ctx);
      if (m.missing.length) warnings.push(`Onbekende merge-tags: ${m.missing.join(', ')}`);
      parts.push(paragraph(escape(m.text)));
    } else {
      parts.push(
        paragraph(
          'Ik wilde even kort checken — drukte aan jullie kant of is er nog iets waarvoor ik input mis?',
        ),
      );
    }

    parts.push(
      paragraph(
        'Een snelle reactie helpt me om verder te plannen. Een no-go of "kom over een maand even terug" is ook prima — dan weet ik waar ik aan toe ben.',
      ),
    );

    if (planGesprek) {
      parts.push(ctaButton('Plan een gesprek', `${ctx.baseUrl}/plan-gesprek`));
    }

    if (softClose) {
      parts.push(
        paragraph(
          'Geen reactie? Geen probleem — dan plan ik over een paar weken zelf nog even een belmoment.',
        ),
      );
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
