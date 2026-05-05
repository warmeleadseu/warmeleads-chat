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
  tipBox,
} from './_helpers';

export const reEngageTemplate: EmailTemplate = {
  key: 're_engage',
  label: 'Re-engagement',
  description:
    'Voor prospects of klanten die al langer stil zijn. Korte herintroductie en lage drempel om weer in gesprek te komen.',
  applicableTo: ['prospect', 'customer'],
  scope: 'marketing',
  options: [
    {
      key: 'time_label',
      label: 'Hoe lang geleden was het laatste contact?',
      type: 'select',
      default: 'enkele_maanden',
      options: [
        { value: 'paar_weken', label: 'Een paar weken' },
        { value: 'enkele_maanden', label: 'Enkele maanden' },
        { value: 'half_jaar', label: 'Een half jaar+' },
        { value: 'jaar_plus', label: 'Een jaar of langer' },
      ],
    },
    {
      key: 'angle',
      label: 'Inhoudelijke aanleiding',
      type: 'textarea',
      placeholder: 'Sinds ons laatste contact zijn we flink uitgebreid in de zonnepanelen-branche.',
    },
    {
      key: 'mention_new_branches',
      label: 'Vermelden dat er nieuwe branches/diensten zijn',
      type: 'boolean',
      default: false,
    },
    {
      key: 'plan_gesprek_cta',
      label: '"Plan een gesprek"-knop tonen',
      type: 'boolean',
      default: true,
    },
  ],
  defaultSubject: ctx => {
    const time = asString(ctx.optionValues.time_label) || 'enkele_maanden';
    const labels: Record<string, string> = {
      paar_weken: 'Even bijpraten?',
      enkele_maanden: 'Lang niet meer gehoord — bijpraten?',
      half_jaar: 'Een half jaar verder — staan we nog op de kaart?',
      jaar_plus: 'Te lang stil geweest — hoe gaat het bij jullie?',
    };
    return labels[time] || 'Even bijpraten?';
  },
  render: ctx => {
    const time = asString(ctx.optionValues.time_label) || 'enkele_maanden';
    const angle = asString(ctx.optionValues.angle).trim();
    const mentionNew = asBoolean(ctx.optionValues.mention_new_branches);
    const planGesprek = asBoolean(ctx.optionValues.plan_gesprek_cta);
    const warnings: string[] = [];
    const parts: string[] = [];

    parts.push(`<p style="margin:0 0 18px;font-size:16px;font-weight:600">${greetingLine(ctx)}</p>`);

    const timeText: Record<string, string> = {
      paar_weken: 'een paar weken',
      enkele_maanden: 'enkele maanden',
      half_jaar: 'een half jaar',
      jaar_plus: 'een jaar',
    };

    parts.push(
      paragraph(
        `Het is alweer ${timeText[time] || 'even'} geleden dat we elkaar spraken. Ik dacht: tijd om weer even contact te leggen.`,
      ),
    );

    if (angle) {
      const m = applyMergeTags(angle, ctx);
      if (m.missing.length) warnings.push(`Onbekende merge-tags: ${m.missing.join(', ')}`);
      parts.push(paragraph(escape(m.text)));
    }

    if (mentionNew) {
      parts.push(
        tipBox(
          'In de tussentijd hebben we ons aanbod uitgebreid en draaien er nieuwe campagnes. Wellicht zit er nu wél iets passends voor jullie tussen.',
        ),
      );
    }

    parts.push(
      paragraph(
        'Hoe staat het er bij jullie voor? Korte update is genoeg om te kijken of er weer iets te bespreken valt.',
      ),
    );

    if (planGesprek) {
      parts.push(ctaButton('Plan een korte update', `${ctx.baseUrl}/plan-gesprek`));
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
