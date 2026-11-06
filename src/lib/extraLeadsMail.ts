import { cta, layout, EMAIL_BASE_URL } from './email';

/**
 * Mails over Extra leads (losse leads in het portaal): de introductiemail en
 * het overzicht van elke maandag, per regio. Alleen inhoud; versturen staat in
 * extraLeadsMailVerzenden.ts.
 *
 * Afspraak (6 nov 2026): we noemen nooit wanneer een lead in prijs zakt, zodat
 * klanten niet gaan wachten op een lagere prijs. Wel "vanaf"-prijzen en de
 * prijs van nu per lead.
 */

export type MailLead = {
  id: string;
  branch: string;
  plaats: string | null;
  provincie: string | null;
  land: string | null;
  prijs_excl: number;
  antwoorden: { label: string; waarde: string }[];
};

export type MailInhoud = { onderwerp: string; html: string; aantal: number };

export const INTRO_TYPE = 'extra_leads_intro';
export const MAANDAG_TYPE = 'extra_leads_maandag';
export const TEST_TYPE = 'extra_leads_test';
/** Afmelden via deze mails geldt voor marketingmail (scope uit de template-key). */
export const TEMPLATE_KEY = 'extra_leads';
export const SCHAKELAAR_KEY = 'extra_leads_maandagmail';
export const TEST_ADRES = 'info@warmeleads.eu';

/** Hoeveel leads de maandagmail toont; de rest staat in het portaal. */
export const MAX_LEADS_IN_MAIL = 40;
export const MAX_PER_REGIO = 8;

const PORTAAL = `${EMAIL_BASE_URL}/portal`;
const EXTRA_LEADS = `${EMAIL_BASE_URL}/portal/extra-leads`;

export function esc(s: string | number | null | undefined): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function euro(v: number): string {
  return '€' + (Number.isInteger(v) ? String(v) : v.toFixed(2).replace('.', ','));
}

/** Eerste woord van de contactpersoon, of niets. */
export function voornaamVan(contact: string | null | undefined): string {
  const w = (contact ?? '').trim().split(/\s+/)[0] ?? '';
  return /^[\p{L}][\p{L}'-]*$/u.test(w) ? w : '';
}

/** Limburg bestaat in Nederland en in België: die houden we uit elkaar. */
export function regioVan(l: Pick<MailLead, 'provincie' | 'land'>): string {
  const p = l.provincie?.trim();
  if (!p) return l.land === 'BE' ? 'België' : 'Overig';
  return p === 'Limburg' && l.land === 'BE' ? 'Limburg (België)' : p;
}

/** Maandag van de week van `nu`, in Nederlandse tijd (yyyy-mm-dd). */
export function maandagVan(nu: Date = new Date()): string {
  const nl = new Date(nu.toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }));
  const m = new Date(nl.getFullYear(), nl.getMonth(), nl.getDate() - ((nl.getDay() + 6) % 7));
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-${String(m.getDate()).padStart(2, '0')}`;
}

function aanhef(voornaam: string): string {
  return `<p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f172a">Hallo${voornaam ? ` ${esc(voornaam)}` : ''},</p>`;
}

function preheader(tekst: string): string {
  return `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(tekst)}</div>`;
}

function afmelden(url: string): string {
  return `<p style="margin:28px 0 0;font-size:12px;color:#94a3b8;line-height:1.5">Je ontvangt deze mail omdat je een account hebt in het WarmeLeads-portaal. Geen interesse in deze berichten? <a href="${esc(url)}" style="color:#94a3b8">Afmelden</a>.</p>`;
}

function leadRij(l: MailLead, brancheNaam: (slug: string) => string): string {
  const a = l.antwoorden[0];
  return `
    <tr><td style="padding:12px 20px;border-top:1px solid #f1f5f9">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
        <td style="font-size:14px;color:#0f172a"><strong>${esc(l.plaats || 'Onbekende plaats')}</strong><br><span style="font-size:12px;color:#64748b">${esc(brancheNaam(l.branch))}${a ? ` · ${esc(a.label)}: ${esc(a.waarde)}` : ''}</span></td>
        <td align="right" style="font-size:15px;font-weight:800;color:#3B2F75;white-space:nowrap">${euro(l.prijs_excl)}</td>
      </tr></table>
    </td></tr>`;
}

function brancheChips(leads: MailLead[], brancheNaam: (slug: string) => string): string {
  const per = new Map<string, number>();
  for (const l of leads) per.set(l.branch, (per.get(l.branch) ?? 0) + 1);
  return [...per.entries()].sort((a, b) => b[1] - a[1])
    .map(([b, n]) => `<span style="display:inline-block;margin:0 6px 6px 0;padding:3px 11px;border-radius:20px;background:#f8fafc;border:1px solid #e2e8f0;color:#334155;font-size:13px"><strong>${n}</strong> ${esc(brancheNaam(b))}</span>`)
    .join('');
}

const STAPPEN: [string, string][] = [
  ['Log in', `Ga naar <a href="${PORTAAL}" style="color:#3B2F75;font-weight:600;text-decoration:none">warmeleads.eu/portal</a> en log in met je account.`],
  ['Ga naar Extra leads', 'Je vindt het tabblad in het menu van je portaal.'],
  ['Kies je leads', 'Filter op branche en provincie en vink de leads aan die het best bij je passen.'],
  ['Reken af', 'Veilig betalen via Mollie, maximaal 25 leads per keer.'],
  ['Bel direct', 'Naam en telefoonnummer staan meteen in je portaal. Hoe sneller je belt, hoe groter je kans.'],
];

function stappen(): string {
  return `
  <p style="margin:28px 0 12px;font-size:16px;font-weight:700;color:#0f172a">Zo werkt het</p>
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    ${STAPPEN.map(([kop, tekst], i) => `
    <tr><td style="padding:0 0 12px">
      <table cellpadding="0" cellspacing="0" role="presentation"><tr>
        <td valign="top" style="width:38px">
          <div style="width:26px;height:26px;border-radius:13px;background-color:#FF6B35;background:linear-gradient(135deg,#FF6B35,#FF4757);color:#ffffff;font-size:13px;font-weight:800;line-height:26px;text-align:center">${i + 1}</div>
        </td>
        <td valign="top" style="font-size:14px;color:#475569;line-height:1.55;padding-top:3px"><strong style="color:#0f172a">${kop}.</strong> ${tekst}</td>
      </tr></table>
    </td></tr>`).join('')}
  </table>`;
}

function eersteKoopt(): string {
  return `<p style="margin:20px 0 0;padding:14px 16px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;font-size:14px;color:#7c2d12;line-height:1.55"><strong>Wie het eerst koopt, is de enige.</strong> Elke lead wordt maar één keer verkocht. Is hij weg, dan is hij weg.</p>`;
}

function voordeel(icoon: string, kop: string, tekst: string): string {
  return `
    <tr><td style="padding:0 0 14px">
      <table cellpadding="0" cellspacing="0" role="presentation"><tr>
        <td valign="top" style="width:36px;padding-top:1px">
          <div style="width:28px;height:28px;border-radius:8px;background:#f5f3ff;color:#3B2F75;font-size:15px;line-height:28px;text-align:center">${icoon}</div>
        </td>
        <td valign="top" style="font-size:14px;color:#475569;line-height:1.55"><strong style="color:#0f172a">${kop}</strong><br>${tekst}</td>
      </tr></table>
    </td></tr>`;
}

/** Drie voorbeelden uit verschillende branches (het aanbod komt nieuwste eerst binnen). */
export function kiesVoorbeelden(leads: MailLead[], aantal = 3): MailLead[] {
  const uit: MailLead[] = [];
  for (const l of leads) {
    if (uit.length >= aantal) break;
    if (l.plaats && !uit.some(v => v.branch === l.branch)) uit.push(l);
  }
  return uit;
}

/** De eenmalige introductiemail; null als er niets te koop staat. */
export function bouwIntroMail(opts: {
  leads: MailLead[];
  brancheNaam: (slug: string) => string;
  voornaam: string;
  afmeldUrl: string;
}): MailInhoud | null {
  const { leads, brancheNaam } = opts;
  if (leads.length === 0) return null;
  const laagste = Math.min(...leads.map(l => l.prijs_excl));
  const voorbeelden = kiesVoorbeelden(leads);

  const content = `
  ${preheader(`Leads die nog nooit aan iemand zijn geleverd. Jij kiest, jij bent de enige. Vanaf ${euro(laagste)} per lead.`)}
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 28px">
    <tr><td style="border-radius:14px;background-color:#3B2F75;background:linear-gradient(135deg,#3B2F75 0%,#5b3f9e 55%,#E74C8C 100%);padding:28px 28px 26px">
      <span style="display:inline-block;background:rgba(255,255,255,0.16);color:#ffffff;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:0.8px">NIEUW IN JE PORTAAL</span>
      <p style="margin:16px 0 8px;font-size:26px;font-weight:800;color:#ffffff;line-height:1.2">Leads die niemand anders heeft.</p>
      <p style="margin:0;font-size:15px;color:#ede9fe;line-height:1.55">Kies ze zelf, koop ze los, en wees de enige die belt. Vanaf <strong style="color:#ffffff">${euro(laagste)}</strong> per lead.</p>
    </td></tr>
  </table>

  ${aanhef(opts.voornaam)}
  <p style="margin:0 0 16px">Elke week komen er leads binnen die nét buiten het werkgebied van onze klanten vallen. Echte aanvragen, van mensen die net een formulier invulden, maar zonder klant in hun regio. Ze zijn nog <strong style="color:#0f172a">nooit aan iemand geleverd</strong>.</p>
  <p style="margin:0 0 24px">Vanaf nu kun je die leads zelf kopen, in het nieuwe tabblad <strong style="color:#0f172a">Extra leads</strong> in je portaal. Los, zonder batch en zonder minimum.</p>

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 8px">
    ${voordeel('★', 'Alleen voor jou', 'Koop je een lead, dan krijgt niemand anders hem. Geen concurrent die ook belt.')}
    ${voordeel('◎', 'Eerst zien, dan kiezen', 'Je ziet vooraf de plaats, de branche en wat de aanvrager invulde.')}
    ${voordeel('⚡', 'Direct bellen', 'Na betaling staan naam en telefoonnummer meteen in je portaal.')}
    ${voordeel('€', `Vanaf ${euro(laagste)} per lead`, 'Geen abonnement, geen verplichting. Je koopt alleen wat je wilt.')}
  </table>

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:16px 0 0;border:1px solid #e2e8f0;border-radius:12px">
    <tr><td style="padding:18px 20px 6px">
      <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.8px;color:#E74C8C">NU TE KOOP</p>
      <p style="margin:4px 0 12px;font-size:22px;font-weight:800;color:#0f172a">${leads.length} extra lead${leads.length === 1 ? '' : 's'}</p>
      <p style="margin:0 0 14px;font-size:14px;line-height:1.9">${brancheChips(leads, brancheNaam)}</p>
    </td></tr>
    ${voorbeelden.map(l => leadRij({ ...l, plaats: [l.plaats, l.provincie].filter(Boolean).join(', ') }, brancheNaam)).join('')}
    <tr><td style="padding:10px 20px 14px;border-top:1px solid #f1f5f9;font-size:12px;color:#94a3b8">Prijzen excl. btw. Het aanbod verandert elke dag.</td></tr>
  </table>

  ${stappen()}
  ${cta('Bekijk de extra leads &rarr;', EXTRA_LEADS)}
  ${eersteKoopt()}

  <p style="margin:24px 0 0">Vanaf volgende week sturen we je <strong style="color:#0f172a">elke maandag</strong> een overzicht van de extra leads die te koop staan, per regio. Zo zie je in één oogopslag wat er bij jou in de buurt ligt.</p>
  <p style="margin:16px 0 0">Succes met bellen!<br><strong style="color:#0f172a">Team WarmeLeads</strong></p>
  ${afmelden(opts.afmeldUrl)}`;

  return {
    onderwerp: `Nieuw: leads die niemand anders heeft, vanaf ${euro(laagste)}`,
    html: layout('Nieuw: koop zelf extra leads in je portaal', content),
    aantal: leads.length,
  };
}

export type Regio = { regio: string; eigen: boolean; leads: MailLead[] };

/**
 * Het aanbod voor één klant, per regio: alleen zijn branches; eerst de regio's
 * waar hij zelf leads krijgt (meeste eerst), dan de rest op aantal.
 */
export function regiosVoorKlant(leads: MailLead[], eigenBranches: Set<string>, eigenRegios: string[]): Regio[] {
  const per = new Map<string, MailLead[]>();
  for (const l of leads) {
    if (!eigenBranches.has(l.branch)) continue;
    const r = regioVan(l);
    per.set(r, [...(per.get(r) ?? []), l]);
  }
  const rang = (r: string) => { const i = eigenRegios.indexOf(r); return i < 0 ? Infinity : i; };
  return [...per.entries()]
    .map(([regio, ls]) => ({ regio, eigen: rang(regio) !== Infinity, leads: ls }))
    .sort((a, b) => rang(a.regio) - rang(b.regio) || b.leads.length - a.leads.length || a.regio.localeCompare(b.regio));
}

/** De maandagmail voor één klant; null als er in zijn branches niets te koop staat. */
export function bouwMaandagMail(opts: {
  leads: MailLead[];
  brancheNaam: (slug: string) => string;
  voornaam: string;
  afmeldUrl: string;
  eigenBranches: Set<string>;
  eigenRegios: string[];
}): MailInhoud | null {
  const regios = regiosVoorKlant(opts.leads, opts.eigenBranches, opts.eigenRegios);
  const alle = regios.flatMap(r => r.leads);
  if (alle.length === 0) return null;
  const laagste = Math.min(...alle.map(l => l.prijs_excl));
  const inBuurt = regios.filter(r => r.eigen).reduce((s, r) => s + r.leads.length, 0);

  let ruimte = MAX_LEADS_IN_MAIL;
  const blokken: string[] = [];
  for (const r of regios) {
    if (ruimte <= 0) break;
    const toon = r.leads.slice(0, Math.min(MAX_PER_REGIO, ruimte));
    ruimte -= toon.length;
    const meer = r.leads.length - toon.length;
    blokken.push(`
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:16px 0 0;border:1px solid ${r.eigen ? '#d8b4fe' : '#e2e8f0'};border-radius:12px">
    <tr><td style="padding:14px 20px 10px">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
        <td style="font-size:16px;font-weight:800;color:#0f172a">${esc(r.regio)}${r.eigen ? ' <span style="display:inline-block;margin-left:6px;padding:2px 9px;border-radius:20px;background:#f5f3ff;color:#6d28d9;font-size:11px;font-weight:700;vertical-align:middle">BIJ JOU IN DE BUURT</span>' : ''}</td>
        <td align="right" style="font-size:13px;color:#64748b;white-space:nowrap">${r.leads.length} lead${r.leads.length === 1 ? '' : 's'}</td>
      </tr></table>
    </td></tr>
    ${toon.map(l => leadRij(l, opts.brancheNaam)).join('')}
    ${meer > 0 ? `<tr><td style="padding:10px 20px 12px;border-top:1px solid #f1f5f9;font-size:13px"><a href="${EXTRA_LEADS}" style="color:#3B2F75;font-weight:600;text-decoration:none">+ ${meer} meer in ${esc(r.regio)} in je portaal</a></td></tr>` : ''}
  </table>`);
  }
  const verborgen = alle.length - (MAX_LEADS_IN_MAIL - ruimte);
  const verborgenRegios = regios.length - blokken.length;

  const content = `
  ${preheader(`${alle.length} extra leads te koop${inBuurt ? `, waarvan ${inBuurt} bij jou in de buurt` : ''}. Vanaf ${euro(laagste)} per lead.`)}
  ${aanhef(opts.voornaam)}
  <p style="margin:0 0 8px">Deze week staan er <strong style="color:#0f172a">${alle.length} extra lead${alle.length === 1 ? '' : 's'}</strong> voor je klaar in je portaal${inBuurt ? `, waarvan <strong style="color:#0f172a">${inBuurt} bij jou in de buurt</strong>` : ''}. Allemaal nog nooit aan iemand geleverd, vanaf ${euro(laagste)} per lead.</p>
  <p style="margin:0 0 4px;font-size:14px;line-height:1.9">${brancheChips(alle, opts.brancheNaam)}</p>
  ${blokken.join('')}
  ${verborgen > 0 && verborgenRegios > 0 ? `<p style="margin:14px 0 0;font-size:13px;color:#64748b">En nog ${verborgen} lead${verborgen === 1 ? '' : 's'} in ${verborgenRegios} andere regio${verborgenRegios === 1 ? '' : "'s"}: bekijk ze in je portaal.</p>` : ''}
  <p style="margin:12px 0 0;font-size:12px;color:#94a3b8">Prijzen excl. btw. Het aanbod verandert elke dag; wat hier staat kan intussen verkocht zijn.</p>
  ${cta('Bekijk alle extra leads &rarr;', EXTRA_LEADS)}
  ${eersteKoopt()}
  <p style="margin:16px 0 0">Succes met bellen!<br><strong style="color:#0f172a">Team WarmeLeads</strong></p>
  ${afmelden(opts.afmeldUrl)}`;

  return {
    onderwerp: inBuurt
      ? `${inBuurt} extra lead${inBuurt === 1 ? '' : 's'} bij jou in de buurt, vanaf ${euro(laagste)}`
      : `${alle.length} extra lead${alle.length === 1 ? '' : 's'} te koop deze week, vanaf ${euro(laagste)}`,
    html: layout('Extra leads van deze week', content),
    aantal: alle.length,
  };
}
