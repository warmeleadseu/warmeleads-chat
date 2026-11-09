import { layout } from './email';

/**
 * Toestemming ingetrokken: een aanvrager die zijn toestemming intrekt (meestal
 * per mail), wordt nooit meer gedeeld. De database weigert elke nieuwe
 * toewijzing van zo'n lead (migratie 196); hier staan de regels voor wie het
 * mag zetten en de mail aan klanten die de lead al hadden (art. 7.7 AV).
 */

export type AdminRol = 'superadmin' | 'admin' | 'accountmanager' | string;

/** Intrekken: admin en superadmin. */
export function magIntrekken(rol: AdminRol): boolean {
  return rol === 'superadmin' || rol === 'admin';
}

/** Herstellen (de aanvrager geeft opnieuw toestemming): alleen superadmin. */
export function magHerstellen(rol: AdminRol): boolean {
  return rol === 'superadmin';
}

export type Ontvanger = { customer_id: string; naam: string; email: string | null; intern: boolean };

/**
 * Klanten die de lead hebben gekregen en een mail moeten krijgen: één keer per
 * klant, met een e-mailadres, zonder interne klanten (WarmeLeads zelf).
 */
export function mailOntvangers(kandidaten: Ontvanger[]): Ontvanger[] {
  const gezien = new Set<string>();
  const uit: Ontvanger[] = [];
  for (const k of kandidaten) {
    if (k.intern || !k.email || !k.email.includes('@')) continue;
    if (gezien.has(k.customer_id)) continue;
    gezien.add(k.customer_id);
    uit.push(k);
  }
  return uit;
}

const esc = (s: string | null | undefined) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export type MailLead = {
  naam_klant: string | null;
  telefoonnummer: string | null;
  email: string | null;
  plaatsnaam: string | null;
  created_at: string;
};

/** Mail aan een klant: deze aanvrager niet meer benaderen en de gegevens verwijderen. */
export function bouwIntrekkingMail(klantNaam: string, lead: MailLead): { onderwerp: string; html: string } {
  const datum = new Date(lead.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' });
  const regel = (label: string, waarde: string | null) =>
    waarde ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b;font-size:14px">${label}</td><td style="padding:4px 0;color:#0f172a;font-size:14px;font-weight:600">${esc(waarde)}</td></tr>` : '';
  const inhoud = `
    <p style="margin:0 0 14px;font-size:15px;color:#0f172a">Beste ${esc(klantNaam)},</p>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#334155">
      Een aanvrager die je via WarmeLeads hebt ontvangen, heeft zijn toestemming ingetrokken.
      Deze persoon wil niet meer benaderd worden over zijn aanvraag.
    </p>
    <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 16px;border-collapse:collapse">
      ${regel('Naam', lead.naam_klant)}
      ${regel('Telefoon', lead.telefoonnummer)}
      ${regel('E-mail', lead.email)}
      ${regel('Plaats', lead.plaatsnaam)}
      ${regel('Aanvraag van', datum)}
    </table>
    <p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#0f172a">Wat we van je vragen</p>
    <ul style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.6;color:#334155">
      <li>Neem geen contact meer op met deze persoon, ook niet via WhatsApp of e-mail.</li>
      <li>Verwijder de gegevens binnen 5 werkdagen uit al je systemen, zoals je CRM, agenda en spreadsheets.</li>
    </ul>
    <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#64748b">
      Dit volgt uit de AVG en artikel 7.7 van onze algemene voorwaarden. Had je al een afspraak of offerte lopen met deze persoon? Laat het ons even weten, dan denken we mee.
    </p>
    <p style="margin:0;font-size:15px;color:#334155">Met vriendelijke groet,<br>Team WarmeLeads</p>`;
  return {
    onderwerp: `Aanvrager ${lead.naam_klant ? lead.naam_klant.trim() + ' ' : ''}niet meer benaderen: toestemming ingetrokken`,
    html: layout('Toestemming ingetrokken', inhoud),
  };
}
