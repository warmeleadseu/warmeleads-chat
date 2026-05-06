import type { EmailTemplate } from './types';
import {
  applyMergeTags,
  asString,
  composeShell,
  ctaButton,
  escape,
  greetingLine,
  htmlToText,
  INFO_BLOCK_OPTIONS,
  paragraph,
  readInfoFlags,
  renderInfoBlocks,
} from './_helpers';

export const meetingRequestTemplate: EmailTemplate = {
  key: 'meeting_request',
  label: 'Plan een gesprek',
  description:
    'Concreet voorstel voor een belafspraak met directe link naar de plan-pagina.',
  applicableTo: ['prospect', 'customer'],
  scope: 'nurture',
  options: [
    {
      key: 'reason',
      label: 'Waar wil je over praten?',
      type: 'textarea',
      placeholder:
        'Ik zie kansen voor jullie in warmtepompen. Graag bel ik even over hoe we dat het beste insteken.',
    },
    {
      key: 'duration',
      label: 'Voorgestelde duur',
      type: 'select',
      default: '15min',
      options: [
        { value: '15min', label: '15 minuten (kort en scherp)' },
        { value: '30min', label: '30 minuten (voor uitleg en Q&A)' },
        { value: '45min', label: '45 minuten (uitgebreid kennismakingsgesprek)' },
      ],
    },
    {
      key: 'mention_video',
      label: 'Optie tot videocall noemen',
      type: 'boolean',
      default: true,
    },
    ...INFO_BLOCK_OPTIONS,
  ],
  defaultSubject: ctx => {
    const dur = asString(ctx.optionValues.duration) || '15min';
    const labels: Record<string, string> = {
      '15min': '15 min bellen',
      '30min': '30 min bellen',
      '45min': '45 min bellen',
    };
    return `Voorstel: ${labels[dur] || '15 min bellen'}`;
  },
  render: ctx => {
    const reason = asString(ctx.optionValues.reason).trim();
    const duration = asString(ctx.optionValues.duration) || '15min';
    const mentionVideo = ctx.optionValues.mention_video !== false;
    const warnings: string[] = [];
    const parts: string[] = [];

    const durationLabels: Record<string, string> = {
      '15min': '15 minuten',
      '30min': 'half uur',
      '45min': '45 minuten',
    };
    const durLabel = durationLabels[duration] || '15 minuten';

    parts.push(`<p style="margin:0 0 18px;font-size:16px;font-weight:600">${greetingLine(ctx)}</p>`);

    if (reason) {
      const m = applyMergeTags(reason, ctx);
      if (m.missing.length) warnings.push(`Onbekende merge-tags: ${m.missing.join(', ')}`);
      parts.push(paragraph(escape(m.text)));
    } else {
      parts.push(
        paragraph(
          'Ik zou graag even kort met je sparren over de mogelijkheden. Het is sneller besproken dan getypt.',
        ),
      );
    }

    parts.push(
      paragraph(
        `Heb je <strong>${durLabel}</strong> ergens deze week? Plan zelf even een tijd dat jou uitkomt:`,
      ),
    );

    parts.push(ctaButton('Plan direct een moment', `${ctx.baseUrl}/plan-gesprek`));

    if (mentionVideo) {
      parts.push(
        paragraph(
          'Liever videocall via Teams of Google Meet? Geef het door, dan stuur ik een uitnodiging.',
        ),
      );
    }

    const infoFlags = readInfoFlags(ctx.optionValues);
    parts.push(renderInfoBlocks(ctx, infoFlags));

    parts.push(paragraph('Met vriendelijke groet,'));

    const html = composeShell({
      bodyHtml: parts.join(''),
      signatureHtml: ctx.signatureHtml,
      unsubscribeUrl: ctx.unsubscribeUrl,
    });
    return { subject: '', html, text: htmlToText(html), warnings };
  },
};
