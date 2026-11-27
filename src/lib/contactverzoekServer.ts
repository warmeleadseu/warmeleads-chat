import type { SupabaseClient } from '@supabase/supabase-js';
import { EMAIL_BASE_URL } from './email';
import { sendAsAdmin } from './email/sendAsAdmin';
import { loadAdminFull, renderForRecipients, resolveRecipients, type AdminRow } from './email/composeContext';
import { composeShell, escape, htmlToText } from './email/templates/_helpers';
import type { EmailTemplate } from './email/templates/types';
import { handtekeningKlopt, serverHandtekening } from './herbestelToken';
import { laadVoicemails } from './prospectVoicemail';
import { CONTACTMAIL_SOORT, WARMELEADS_TEL_LINK, WARMELEADS_TELEFOON } from './contactverzoek';

/**
 * Serverkant van het contactverzoek na 3× voicemail: de persoonlijke link,
 * de mail zelf (vanaf het adres van de accountmanager) en het eenmalig
 * versturen. Zie src/lib/contactverzoek.ts voor de regels.
 */

export function contactToken(prospectId: string): string {
  return serverHandtekening(`contact:${prospectId}`);
}

export function contactTokenKlopt(prospectId: string, token: unknown): boolean {
  return handtekeningKlopt(token, contactToken(prospectId));
}

export function contactUrl(prospectId: string): string {
  return `${EMAIL_BASE_URL}/contact/${prospectId}?t=${contactToken(prospectId)}`;
}

const dagTijd = (iso: string) =>
  new Date(iso).toLocaleString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });

const P = 'margin:0 0 14px;font-size:15px;line-height:1.65;color:#334155';
const optie = (nr: string, titel: string, tekst: string, knop: string) => `
<tr><td style="padding:0 0 10px">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #e2e8f0;border-radius:12px">
    <tr><td style="padding:16px 18px">
      <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#0f172a"><span style="display:inline-block;width:22px;height:22px;margin-right:8px;border-radius:11px;background:#FFF1EB;color:#FF6B35;font-size:12px;line-height:22px;text-align:center">${nr}</span>${titel}</p>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.55;color:#475569">${tekst}</p>
      ${knop}
    </td></tr>
  </table>
</td></tr>`;
const knop = (label: string, url: string, primair: boolean) =>
  `<a href="${url}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 22px;border-radius:10px;${primair ? 'background:#FF6B35;color:#ffffff' : 'background:#ffffff;color:#3B2F75;border:1px solid #c7c2e0'};font-size:14px;font-weight:700;text-decoration:none">${label}</a>`;

/** De mail zelf (los van het compose-menu, want hij heeft een persoonlijke link nodig). */
export const contactverzoekTemplate: EmailTemplate = {
  key: CONTACTMAIL_SOORT,
  label: 'Contactverzoek na 3× voicemail',
  description: 'Automatisch na de derde voicemail: we probeerden te bellen, kies hoe we contact hebben.',
  applicableTo: ['prospect'],
  scope: 'nurture',
  options: [],
  defaultSubject: ctx => `We probeerden u te bereiken${ctx.recipient.companyName ? `, ${ctx.recipient.companyName}` : ''}`,
  render: ctx => {
    const link = String(ctx.optionValues.contact_url ?? '');
    const momenten = (ctx.optionValues.momenten as string[] | undefined) ?? [];
    const voornaam = ctx.recipient.firstName || '';
    const am = ctx.admin.firstName || ctx.admin.name;
    const lijst = momenten.length
      ? `<p style="margin:0 0 14px;font-size:13px;line-height:1.6;color:#64748b">${momenten.map(m => `📞 ${escape(m)}`).join('<br>')}</p>`
      : '';
    const body = `
      <p style="${P}">Beste ${escape(voornaam) || 'heer, mevrouw'},</p>
      <p style="${P}">U liet ons eerder weten interesse te hebben in klantaanvragen via WarmeLeads. We hebben u de afgelopen tijd ${momenten.length || 3} keer geprobeerd te bellen, maar kregen steeds uw voicemail.</p>
      ${lijst}
      <p style="${P}">Geen probleem: we begrijpen dat u als ondernemer niet altijd kunt opnemen. Daarom laten we het graag aan u: kies hieronder wat voor u het handigst is. Het kost u minder dan een minuut.</p>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:6px 0 14px">
        ${optie('1', 'Bel mij terug op een moment dat mij uitkomt', 'Kies of we u zo snel mogelijk, vanmiddag of op de volgende werkdag bellen. U krijgt dan precies dan een telefoontje van ' + escape(am) + '.', knop('Kies een terugbelmoment', link, true))}
        ${optie('2', 'Plan zelf een gesprek in de agenda', 'Liever een vaste afspraak? Kies zelf een dag en tijd voor een kort kennismakingsgesprek van 15 minuten.', knop('Plan een gesprek', `${EMAIL_BASE_URL}/plan-gesprek`, false))}
        ${optie('3', 'Bel ons direct', `Wij zijn op werkdagen bereikbaar van 9:00 tot 17:00 op <a href="${WARMELEADS_TEL_LINK}" style="color:#3B2F75;font-weight:700;text-decoration:none">${WARMELEADS_TELEFOON}</a>. U kunt ook gewoon op deze mail antwoorden.`, knop(`Bel ${WARMELEADS_TELEFOON}`, WARMELEADS_TEL_LINK, false))}
      </table>
      <p style="margin:0 0 6px;font-size:13px;line-height:1.6;color:#64748b">Heeft u geen interesse meer? <a href="${link}&amp;keuze=geen_interesse" style="color:#64748b;text-decoration:underline">Laat het ons met één klik weten</a>, dan bellen we u niet meer.</p>`;
    const html = composeShell({ bodyHtml: body, signatureHtml: ctx.signatureHtml, unsubscribeUrl: ctx.unsubscribeUrl });
    return { subject: '', html, text: htmlToText(html), warnings: [] };
  },
};

/** Afzender: de accountmanager van de prospect, anders wie de knop indrukte, anders info@. */
async function kiesAfzender(supabase: SupabaseClient, amId: string | null, klikkerId: string): Promise<AdminRow | null> {
  const ok = (a: AdminRow | null) => !!a && a.email.toLowerCase().endsWith('@warmeleads.eu');
  for (const id of [amId, klikkerId]) {
    if (!id) continue;
    const { data } = await supabase.from('admin_users').select('id, is_active').eq('id', id).maybeSingle();
    if (data && data.is_active === false) continue;
    const a = await loadAdminFull(supabase, id);
    if (ok(a)) return a;
  }
  const { data: info } = await supabase.from('admin_users').select('id').eq('email', 'info@warmeleads.eu').eq('is_active', true).maybeSingle();
  return info ? loadAdminFull(supabase, info.id as string) : null;
}

export type ContactmailUitslag = { verstuurd: boolean; reden?: string; naar?: string };

/**
 * Stuurt het contactverzoek, één keer per prospect. Wordt aangeroepen als de
 * voicemailteller op 3 komt; een tweede keer (bv. na weghalen en opnieuw
 * aanklikken) gebeurt niets.
 */
export async function stuurContactverzoek(supabase: SupabaseClient, prospectId: string, klikkerId: string): Promise<ContactmailUitslag> {
  const { data: p } = await supabase
    .from('prospects')
    .select('id, email, account_manager_id, status, converted_to_customer_id')
    .eq('id', prospectId)
    .maybeSingle();
  if (!p) return { verstuurd: false, reden: 'Prospect niet gevonden' };
  if (!p.email || !String(p.email).includes('@')) return { verstuurd: false, reden: 'Geen e-mailadres bekend' };
  if (p.converted_to_customer_id || ['gewonnen', 'verloren', 'niet_relevant'].includes(String(p.status))) {
    return { verstuurd: false, reden: 'Prospect is al afgesloten' };
  }

  const { data: eerder } = await supabase
    .from('prospect_activities')
    .select('id')
    .eq('prospect_id', prospectId)
    .eq('type', 'email')
    .contains('metadata', { soort: CONTACTMAIL_SOORT })
    .limit(1);
  if (eerder?.length) return { verstuurd: false, reden: 'Contactverzoek is al eerder gemaild' };

  const afzender = await kiesAfzender(supabase, (p.account_manager_id as string | null) ?? null, klikkerId);
  if (!afzender) return { verstuurd: false, reden: 'Geen afzender met een @warmeleads.eu-adres' };

  const { resolved } = await resolveRecipients(supabase, { id: afzender.id, role: 'superadmin' }, [{ type: 'prospect', id: prospectId }]);
  if (!resolved.length) return { verstuurd: false, reden: 'Geen geldige ontvanger' };
  const vm = (await laadVoicemails(supabase, [prospectId])).get(prospectId);
  const momenten = (vm?.momenten ?? []).slice().reverse().map(m => dagTijd(m.op));
  const [g] = await renderForRecipients(supabase, afzender, resolved, {
    template: contactverzoekTemplate,
    optionValues: { contact_url: contactUrl(prospectId), momenten },
  });
  if (!g) return { verstuurd: false, reden: 'Mail opmaken mislukt' };

  const r = await sendAsAdmin({
    admin: { id: afzender.id, name: afzender.name, email: afzender.email },
    to: g.recipient.recipient.email,
    toName: g.recipient.recipient.name,
    subject: g.subject,
    html: g.html,
    text: g.text,
    scope: contactverzoekTemplate.scope,
    prospectId,
    templateKey: contactverzoekTemplate.key,
    templateOptions: { automatisch: true },
    unsubscribeToken: g.recipient.unsubscribeToken,
  });
  if (r.blockedByOptOut) return { verstuurd: false, reden: 'Prospect heeft zich afgemeld voor mail' };
  if (!r.ok) return { verstuurd: false, reden: r.error || 'Versturen mislukt' };

  await supabase.from('prospect_activities').insert({
    prospect_id: prospectId,
    admin_user_id: afzender.id,
    type: 'email',
    title: 'Automatische mail: contactverzoek na 3× voicemail',
    body: `Verstuurd naar ${g.recipient.recipient.email} vanaf ${afzender.email}.`,
    metadata: { soort: CONTACTMAIL_SOORT, afzender: afzender.email },
  });
  return { verstuurd: true, naar: g.recipient.recipient.email };
}
