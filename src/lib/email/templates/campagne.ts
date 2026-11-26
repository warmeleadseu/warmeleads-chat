import type { EmailTemplate } from './types';
import { applyMergeTags, asString, composeShell, ctaButton, htmlToText } from './_helpers';

/**
 * Campagnemail (geplande mailingen, migratie 204): vrije opmaak met tabellen,
 * kopjes en knoppen. Anders dan "Vrij bericht" blijven inline stijlen en
 * tabellen staan, zodat een actiemail er net zo uitziet als een nieuwsbrief.
 * Scripts, event-handlers en externe stijlbronnen gaan er altijd uit.
 */

const TOEGESTAAN = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4',
  'span', 'div', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'small', 'hr',
]);

/** Alleen veilige stijlen: geen url(), expression() of import. */
function veiligeStijl(stijl: string): string {
  return /url\s*\(|expression|javascript:|@import|behavior/i.test(stijl) ? '' : stijl.replace(/"/g, "'");
}

export function maakCampagneVeilig(html: string): string {
  if (!html) return '';
  let out = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  out = out.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (heel, tag: string, attrs: string) => {
    const t = tag.toLowerCase();
    if (!TOEGESTAAN.has(t)) return '';
    if (heel.startsWith('</')) return `</${t}>`;
    const stijl = /style\s*=\s*"([^"]*)"/i.exec(attrs)?.[1] ?? /style\s*=\s*'([^']*)'/i.exec(attrs)?.[1] ?? '';
    const vs = stijl ? veiligeStijl(stijl) : '';
    const s = vs ? ` style="${vs}"` : '';
    if (t === 'a') {
      const href = /href\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1] ?? '';
      const veilig = /^(https?:|mailto:|tel:)/i.test(href) ? href.replace(/"/g, '%22') : '#';
      return `<a href="${veilig}" target="_blank" rel="noopener noreferrer"${s || ' style="color:#3B2F75;font-weight:600"'}>`;
    }
    if (t === 'table') return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation"${s}>`;
    return `<${t}${s}>`;
  });
  return out;
}

export const campagneTemplate: EmailTemplate = {
  key: 'campagne',
  label: 'Campagne (met tabellen)',
  description: 'Actiemail met tabellen, kopjes en knoppen, voor geplande mailingen. Merge-tags zoals {{first_name}} en {{am_phone}} worden ingevuld.',
  applicableTo: ['customer'],
  scope: 'marketing',
  options: [
    { key: 'subject_override', label: 'Onderwerp', type: 'text', description: 'Verplicht. Merge-tags worden ondersteund.' },
    { key: 'preheader', label: 'Voorbeeldtekst', type: 'text', description: 'De regel die mailprogramma\'s naast het onderwerp tonen.' },
    { key: 'body', label: 'Bericht (HTML)', type: 'richtext', description: 'Tabellen en inline stijlen blijven staan.' },
    { key: 'cta_label', label: 'Knoptekst (leeg = geen knop)', type: 'text' },
    { key: 'cta_url', label: 'Knop-URL', type: 'text', showWhen: 'cta_label' },
  ],
  defaultSubject: ctx => {
    const sub = asString(ctx.optionValues.subject_override).trim();
    return sub ? applyMergeTags(sub, ctx).text : 'WarmeLeads';
  },
  render: ctx => {
    const warnings: string[] = [];
    const body = asString(ctx.optionValues.body);
    const preheader = asString(ctx.optionValues.preheader).trim();
    const ctaLabel = asString(ctx.optionValues.cta_label).trim();
    const ctaUrl = asString(ctx.optionValues.cta_url).trim();
    if (!asString(ctx.optionValues.subject_override).trim()) warnings.push('Geen onderwerp ingevuld.');
    if (!body) warnings.push('Geen bericht ingevuld.');
    const m = applyMergeTags(body, ctx);
    if (m.missing.length) warnings.push(`Onbekende merge-tags: ${m.missing.join(', ')}`);
    const delen: string[] = [];
    if (preheader) {
      const p = applyMergeTags(preheader, ctx).text.replace(/[<>]/g, '');
      delen.push(`<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${p}</div>`);
    }
    delen.push(maakCampagneVeilig(m.text));
    if (ctaLabel) delen.push(ctaButton(ctaLabel, ctaUrl || `${ctx.baseUrl}/portal/bestellen`));
    const html = composeShell({ bodyHtml: delen.join(''), signatureHtml: ctx.signatureHtml, unsubscribeUrl: ctx.unsubscribeUrl });
    return { subject: '', html, text: htmlToText(html), warnings };
  },
};
