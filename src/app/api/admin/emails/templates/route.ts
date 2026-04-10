import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.warmeleads.eu';
const LOGO = `${BASE_URL}/warmeleads-logo-2026.png`;
const YEAR = new Date().getFullYear();

function tplLayout(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f8fafc">
    <tr><td align="center" style="padding:40px 16px">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%">
        <tr><td style="height:4px;background:linear-gradient(135deg,#3B2F75 0%,#E74C8C 35%,#FF6B35 70%,#FF4757 100%);border-radius:12px 12px 0 0;font-size:0;line-height:0">&nbsp;</td></tr>
        <tr><td style="background-color:#ffffff;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr><td style="padding:32px 40px 24px;border-bottom:1px solid #f1f5f9">
              <img src="${LOGO}" alt="WarmeLeads" width="130" style="max-width:130px;height:auto;display:block" />
            </td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr><td style="padding:32px 40px">
              <h1 style="margin:0 0 24px;font-size:20px;font-weight:700;color:#0f172a;line-height:1.3">${title}</h1>
              <div style="font-size:15px;color:#475569;line-height:1.7">${content}</div>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="background-color:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px 40px">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr><td style="border-top:1px solid #e2e8f0;padding-top:20px">
              <p style="margin:0 0 6px;font-size:13px;color:#94a3b8;line-height:1.5">Vragen? Neem contact op via <a href="mailto:info@warmeleads.eu" style="color:#3B2F75;text-decoration:none;font-weight:600">info@warmeleads.eu</a> of bel <a href="tel:0850477067" style="color:#3B2F75;text-decoration:none;font-weight:600">085 047 7067</a>.</p>
              <p style="margin:0;font-size:12px;color:#cbd5e1;line-height:1.5">&copy; ${YEAR} WarmeLeads &middot; <a href="${BASE_URL}" style="color:#cbd5e1;text-decoration:none">warmeleads.eu</a></p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function badge(text: string): string {
  return `<span style="display:inline-block;background:#fff7ed;border:1px solid #fed7aa;color:#c2410c;padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700">${text}</span>`;
}

function statusBadge(text: string, color: 'green' | 'blue' | 'orange' | 'purple' | 'red'): string {
  const c: Record<string, { bg: string; border: string; text: string }> = {
    green: { bg: '#ecfdf5', border: '#d1fae5', text: '#059669' },
    blue: { bg: '#eff6ff', border: '#bfdbfe', text: '#2563eb' },
    orange: { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c' },
    purple: { bg: '#faf5ff', border: '#e9d5ff', text: '#7c3aed' },
    red: { bg: '#fef2f2', border: '#fecaca', text: '#dc2626' },
  };
  const s = c[color];
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px"><tr><td style="background:${s.bg};border:1px solid ${s.border};border-radius:20px;padding:6px 14px"><span style="color:${s.text};font-size:12px;font-weight:700;letter-spacing:0.5px">${text}</span></td></tr></table>`;
}

function row(label: string, value: string): string {
  return `<tr><td style="padding:12px 20px;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9;width:140px">${label}</td><td style="padding:12px 20px;font-size:14px;color:#0f172a;border-bottom:1px solid #f1f5f9">${value || '-'}</td></tr>`;
}

function dataTable(rows: string, headerLabel?: string): string {
  const header = headerLabel
    ? `<tr><td colspan="2" style="background-color:#f8fafc;padding:14px 20px;border-bottom:1px solid #e2e8f0"><span style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px">${headerLabel}</span></td></tr>`
    : '';
  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:20px 0;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">${header}<tr><td style="padding:0"><table width="100%" cellpadding="0" cellspacing="0" role="presentation">${rows}</table></td></tr></table>`;
}

function ctaBtn(text: string, url: string): string {
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:28px 0 8px"><tr><td style="border-radius:10px;background:linear-gradient(135deg,#FF6B35,#FF4757)"><a href="${url}" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.3px">${text}</a></td></tr></table>`;
}

interface Template {
  type: string;
  label: string;
  description: string;
  category: 'klant' | 'admin' | 'website';
  subject: string;
  html: string;
}

function buildTemplates(): Template[] {
  const templates: Template[] = [];

  // 1. Lead notificatie
  templates.push({
    type: 'lead_notification',
    label: 'Lead notificatie',
    description: 'Wordt gestuurd naar de klant wanneer een nieuwe lead wordt toegewezen.',
    category: 'klant',
    subject: 'Nieuwe lead: Jan de Vries',
    html: tplLayout('Nieuwe Lead Ontvangen', `
      <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f172a">Hallo Pieter van Dijk,</p>
      <p style="margin:0 0 8px">Er is een nieuwe lead voor je binnengekomen: ${badge('Zonnepanelen')}.</p>
      ${dataTable(
        row('Naam', '<strong style="color:#0f172a">Jan de Vries</strong>') +
        row('E-mail', '<a href="mailto:jan@voorbeeld.nl" style="color:#3B2F75;text-decoration:none;font-weight:600">jan@voorbeeld.nl</a>') +
        row('Telefoon', '<a href="tel:0612345678" style="color:#3B2F75;text-decoration:none;font-weight:600">06-12345678</a>') +
        row('Postcode', '1234 AB') +
        row('Huisnummer', '42') +
        row('Plaats', 'Amsterdam') +
        row('Provincie', 'Noord-Holland') +
        row('Datum', '15-03-2026'),
        'Leadgegevens',
      )}
      <div style="margin:16px 0;padding:14px 18px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;font-size:14px;color:#92400e"><strong style="color:#b45309">Notities:</strong> Graag teruggebeld in de avonduren</div>
      ${ctaBtn('Bekijk in portaal &rarr;', `${BASE_URL}/portal`)}`),
  });

  // 2. Dagelijks lead overzicht
  templates.push({
    type: 'daily_digest',
    label: 'Dagelijks lead overzicht',
    description: 'Dagelijkse samenvatting van nieuwe leads voor de klant.',
    category: 'klant',
    subject: 'Dagelijkse leads – maandag 16 maart',
    html: tplLayout('Dagelijks Lead Overzicht', `
      <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f172a">Hallo Pieter van Dijk,</p>
      <p style="margin:0 0 8px">Hier zijn je leads van vandaag: ${badge('3 leads')}</p>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:20px 0;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
        <tr style="background-color:#f8fafc">
          <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0">Naam</th>
          <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0">Plaats</th>
          <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0">Telefoon</th>
          <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0">Branche</th>
        </tr>
        <tr><td style="padding:10px 16px;font-size:14px;color:#0f172a;border-bottom:1px solid #f1f5f9">Jan de Vries</td><td style="padding:10px 16px;font-size:14px;color:#475569;border-bottom:1px solid #f1f5f9">Amsterdam</td><td style="padding:10px 16px;font-size:14px;color:#475569;border-bottom:1px solid #f1f5f9">06-12345678</td><td style="padding:10px 16px;font-size:14px;border-bottom:1px solid #f1f5f9">${badge('Zonnepanelen')}</td></tr>
        <tr><td style="padding:10px 16px;font-size:14px;color:#0f172a;border-bottom:1px solid #f1f5f9">Maria Jansen</td><td style="padding:10px 16px;font-size:14px;color:#475569;border-bottom:1px solid #f1f5f9">Rotterdam</td><td style="padding:10px 16px;font-size:14px;color:#475569;border-bottom:1px solid #f1f5f9">06-87654321</td><td style="padding:10px 16px;font-size:14px;border-bottom:1px solid #f1f5f9">${badge('Zonnepanelen')}</td></tr>
        <tr><td style="padding:10px 16px;font-size:14px;color:#0f172a;border-bottom:1px solid #f1f5f9">Karel Bakker</td><td style="padding:10px 16px;font-size:14px;color:#475569;border-bottom:1px solid #f1f5f9">Utrecht</td><td style="padding:10px 16px;font-size:14px;color:#475569;border-bottom:1px solid #f1f5f9">06-55544433</td><td style="padding:10px 16px;font-size:14px;border-bottom:1px solid #f1f5f9">${badge('Warmtepompen')}</td></tr>
      </table>
      ${ctaBtn('Bekijk details in portaal &rarr;', `${BASE_URL}/portal`)}`),
  });

  // 3. Batch 80%
  templates.push({
    type: 'batch_80pct',
    label: 'Batch 80% voltooid',
    description: 'Wordt gestuurd als een batch voor 80% geleverd is.',
    category: 'klant',
    subject: 'Uw batch Zonnepanelen is voor 80% voltooid',
    html: tplLayout('Uw batch Zonnepanelen is voor 80% voltooid', `
      ${statusBadge('80% VOLTOOID', 'orange')}
      <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f172a">Hallo Pieter van Dijk,</p>
      <p style="margin:0 0 8px">Uw batch <strong style="color:#0f172a">Zonnepanelen</strong> is al voor <strong style="color:#3B2F75">80%</strong> voltooid (200 van 250 leads geleverd).</p>
      <p style="margin:0">Bestel nu een vervolg batch zodat u geen leads mist zodra deze batch vol is.</p>
      ${ctaBtn('Nieuwe batch bestellen &rarr;', `${BASE_URL}/portal/bestellen`)}`),
  });

  // 4. Batch voltooid (klant)
  templates.push({
    type: 'batch_completed',
    label: 'Batch voltooid',
    description: 'Wordt gestuurd als alle leads van een batch geleverd zijn.',
    category: 'klant',
    subject: 'Uw batch Zonnepanelen is voltooid!',
    html: tplLayout('Uw batch Zonnepanelen is voltooid!', `
      ${statusBadge('&#10003; VOLTOOID', 'green')}
      <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f172a">Hallo Pieter van Dijk,</p>
      <p style="margin:0 0 8px">Uw batch <strong style="color:#0f172a">Zonnepanelen</strong> is volledig voltooid! Alle <strong style="color:#3B2F75">250</strong> leads zijn geleverd.</p>
      <p style="margin:0">Wilt u blijven groeien? Bestel direct een nieuwe batch en ontvang weer verse leads.</p>
      ${ctaBtn('Nieuwe batch bestellen &rarr;', `${BASE_URL}/portal/bestellen`)}`),
  });

  // 5. Batch reminder
  templates.push({
    type: 'batch_reminder',
    label: 'Batch herinnering',
    description: 'Wordt enkele dagen na batch-voltooiing gestuurd als herinnering.',
    category: 'klant',
    subject: 'U mist momenteel leads in Zonnepanelen',
    html: tplLayout('U mist momenteel leads in Zonnepanelen', `
      ${statusBadge('GEEN ACTIEVE BATCH', 'red')}
      <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f172a">Hallo Pieter van Dijk,</p>
      <p style="margin:0 0 8px">Het is nu een paar dagen geleden dat uw batch <strong style="color:#0f172a">Zonnepanelen</strong> is voltooid. Momenteel ontvangt u geen nieuwe leads in dit segment.</p>
      <p style="margin:0">Bestel een nieuwe batch om weer leads te ontvangen.</p>
      ${ctaBtn('Nieuwe batch bestellen &rarr;', `${BASE_URL}/portal/bestellen`)}`),
  });

  // 6. Bestelling bevestigd
  templates.push({
    type: 'order_confirmation',
    label: 'Bestelling bevestigd',
    description: 'Bevestigingsmail na succesvolle bestelling van een nieuwe batch.',
    category: 'klant',
    subject: 'Bevestiging: nieuwe batch Zonnepanelen (250 leads)',
    html: tplLayout('Bestelling Bevestigd', `
      ${statusBadge('&#10003; BEVESTIGD', 'green')}
      <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f172a">Hallo Pieter van Dijk,</p>
      <p style="margin:0 0 8px">Bedankt voor je bestelling! Je nieuwe batch is aangemaakt en leads worden automatisch toegewezen.</p>
      ${dataTable(
        row('Branche', '<strong style="color:#0f172a">Zonnepanelen</strong>') +
        row('Batch grootte', '<strong style="color:#0f172a">250</strong> leads') +
        row('Prijs per lead (excl. BTW)', '&euro;12,50') +
        row('Subtotaal excl. BTW', '&euro;3.125,00') +
        row('BTW 21%', '&euro;656,25') +
        `<tr><td style="padding:16px 20px;font-size:15px;color:#3B2F75;font-weight:700;border-bottom:none">Totaal incl. BTW</td><td style="padding:16px 20px;font-size:18px;color:#3B2F75;font-weight:800;text-align:right;border-bottom:none">&euro;3.781,25</td></tr>`,
        'Bestelgegevens',
      )}
      ${ctaBtn('Bekijk in portaal &rarr;', `${BASE_URL}/portal`)}`),
  });

  // 7. Factuur (open)
  templates.push({
    type: 'invoice_open',
    label: 'Factuur (open)',
    description: 'Wordt gestuurd als een nieuwe factuur openstaat.',
    category: 'klant',
    subject: 'Nieuwe factuur WL-2026-0042 - WarmeLeads',
    html: tplLayout('Factuur WL-2026-0042', `
      ${statusBadge('OPENSTAAND', 'orange')}
      <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f172a">Hallo Pieter van Dijk,</p>
      <p style="margin:0 0 28px">Er staat een nieuwe factuur voor je klaar.</p>
      ${dataTable(
        row('Factuurnummer', '<strong style="color:#0f172a">WL-2026-0042</strong>') +
        row('Omschrijving', '250 Zonnepanelen leads') +
        row('Status', '<span style="color:#c2410c;font-weight:600">Openstaand</span>') +
        `<tr><td style="padding:16px 20px;font-size:15px;color:#3B2F75;font-weight:700;border-bottom:none">Te betalen</td><td style="padding:16px 20px;font-size:18px;color:#3B2F75;font-weight:800;text-align:right;border-bottom:none">&euro;3.781,25</td></tr>`,
        'Factuurgegevens',
      )}
      <p style="margin:0 0 4px;font-size:14px;color:#64748b;line-height:1.7">Je kunt direct betalen via je portaal. Na betaling wordt je batch direct geactiveerd en ontvang je leads.</p>
      ${ctaBtn('Bekijk factuur &amp; betaal &rarr;', `${BASE_URL}/portal/account`)}`),
  });

  // 8. Factuur (betaald)
  templates.push({
    type: 'invoice_paid',
    label: 'Factuur (betaald)',
    description: 'Wordt gestuurd als een factuur succesvol betaald is.',
    category: 'klant',
    subject: 'Factuur WL-2026-0042 - WarmeLeads',
    html: tplLayout('Factuur WL-2026-0042', `
      ${statusBadge('&#10003; BETAALD', 'green')}
      <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f172a">Hallo Pieter van Dijk,</p>
      <p style="margin:0 0 28px">Bedankt voor je betaling! Hierbij je factuur <strong style="color:#0f172a">WL-2026-0042</strong>.</p>
      ${dataTable(
        row('Factuurnummer', '<strong style="color:#0f172a">WL-2026-0042</strong>') +
        row('Omschrijving', '250 Zonnepanelen leads') +
        row('Status', '<span style="color:#059669;font-weight:600">Betaald</span>') +
        `<tr><td style="padding:16px 20px;font-size:15px;color:#3B2F75;font-weight:700;border-bottom:none">Totaal incl. BTW</td><td style="padding:16px 20px;font-size:18px;color:#3B2F75;font-weight:800;text-align:right;border-bottom:none">&euro;3.781,25</td></tr>`,
        'Factuurgegevens',
      )}
      <p style="margin:0 0 4px;font-size:14px;color:#64748b;line-height:1.7">Je kunt je factuur downloaden als PDF via je persoonlijke portaal:</p>
      ${ctaBtn('Factuur downloaden &rarr;', `${BASE_URL}/portal/account`)}`),
  });

  // 9. Portaal herinnering
  templates.push({
    type: 'portal_reminder',
    label: 'Portaal herinnering',
    description: 'Wordt gestuurd om de klant te herinneren aan het portaal.',
    category: 'klant',
    subject: 'Je WarmeLeads portaal staat klaar!',
    html: tplLayout('Je portaal staat klaar!', `
      ${statusBadge('JOUW LEADPORTAAL', 'purple')}
      <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#0f172a">Hallo Pieter,</p>
      <p style="margin:0 0 28px">Je persoonlijke leadportaal staat klaar! Hier vind je al je leads overzichtelijk op een plek, kun je nieuwe batches bestellen en je account beheren.</p>
      ${dataTable(
        row('E-mail', '<strong style="color:#0f172a">pieter@zonnepro.nl</strong>') +
        row('Wachtwoord', '<span style="font-family:monospace;font-weight:600;color:#0f172a">W3lk0m2026!</span>'),
        'Je inloggegevens',
      )}
      ${ctaBtn('Ga naar je portaal &rarr;', `${BASE_URL}/portal`)}
      <div style="border-top:1px solid #f1f5f9;padding-top:20px;margin-top:12px">
        <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6"><strong style="color:#64748b">Tip:</strong> Installeer het portaal als app op je telefoon voor snelle toegang en pushnotificaties.</p>
      </div>`),
  });

  // 10. Weekrapport (admin)
  templates.push({
    type: 'weekly_report',
    label: 'Weekrapport',
    description: 'Wekelijkse samenvatting met statistieken voor de admin.',
    category: 'admin',
    subject: 'WarmeLeads weekrapport – week 12',
    html: tplLayout('Weekrapport – Week 12', `
      <p style="margin:0 0 8px">Hier is je wekelijkse samenvatting:</p>
      ${dataTable(
        row('Totaal leads', '<strong style="color:#0f172a">1.847</strong>') +
        row('Nieuwe leads deze week', '<strong style="color:#059669">142</strong>') +
        row('Toegewezen deze week', '<strong style="color:#0f172a">128</strong>') +
        row('Actieve klanten', '34') +
        row('Actieve batches', '21') +
        row('Voltooide batches', '3'),
        'Statistieken',
      )}
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:20px 0;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
        <tr><td colspan="2" style="background-color:#f8fafc;padding:14px 20px;border-bottom:1px solid #e2e8f0"><span style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px">Top branches</span></td></tr>
        <tr><td style="padding:10px 20px;font-size:14px;color:#0f172a;border-bottom:1px solid #f1f5f9">Zonnepanelen</td><td style="padding:10px 20px;font-size:14px;color:#3B2F75;font-weight:700;text-align:right;border-bottom:1px solid #f1f5f9">58</td></tr>
        <tr><td style="padding:10px 20px;font-size:14px;color:#0f172a;border-bottom:1px solid #f1f5f9">Warmtepompen</td><td style="padding:10px 20px;font-size:14px;color:#3B2F75;font-weight:700;text-align:right;border-bottom:1px solid #f1f5f9">41</td></tr>
        <tr><td style="padding:10px 20px;font-size:14px;color:#0f172a;border-bottom:1px solid #f1f5f9">Thuisbatterijen</td><td style="padding:10px 20px;font-size:14px;color:#3B2F75;font-weight:700;text-align:right;border-bottom:1px solid #f1f5f9">29</td></tr>
      </table>
      ${ctaBtn('Naar dashboard &rarr;', `${BASE_URL}/admin`)}`),
  });

  // 11. Feedback overzicht (admin)
  templates.push({
    type: 'feedback_digest',
    label: 'Feedback overzicht',
    description: 'Dagelijks overzicht van klantfeedback voor de admin.',
    category: 'admin',
    subject: 'Feedback overzicht – maandag 16 maart (5 nieuwe)',
    html: tplLayout('Dagelijks Feedback Overzicht', `
      <p style="margin:0 0 8px">Er zijn ${badge('5')} nieuwe feedbacks binnengekomen:</p>
      <div style="margin:16px 0">
        <span style="display:inline-block;background:#ecfdf5;border:1px solid #d1fae5;color:#059669;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;margin:2px 4px 2px 0">Goed contact gehad: 2</span>
        <span style="display:inline-block;background:#faf5ff;border:1px solid #e9d5ff;color:#7c3aed;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;margin:2px 4px 2px 0">Verkocht!: 1</span>
        <span style="display:inline-block;background:#fffbeb;border:1px solid #fde68a;color:#d97706;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;margin:2px 4px 2px 0">Onbereikbaar: 2</span>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:20px 0;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
        <tr style="background-color:#f8fafc">
          <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0">Lead</th>
          <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0">Klant</th>
          <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e2e8f0">Feedback</th>
        </tr>
        <tr><td style="padding:10px 14px;font-size:14px;color:#0f172a;border-bottom:1px solid #f1f5f9">Jan de Vries</td><td style="padding:10px 14px;font-size:14px;color:#475569;border-bottom:1px solid #f1f5f9">ZonnePro BV</td><td style="padding:10px 14px;border-bottom:1px solid #f1f5f9"><span style="display:inline-block;background:#faf5ff;border:1px solid #e9d5ff;color:#7c3aed;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700">Verkocht!</span></td></tr>
        <tr><td style="padding:10px 14px;font-size:14px;color:#0f172a;border-bottom:1px solid #f1f5f9">Maria Jansen</td><td style="padding:10px 14px;font-size:14px;color:#475569;border-bottom:1px solid #f1f5f9">ZonnePro BV</td><td style="padding:10px 14px;border-bottom:1px solid #f1f5f9"><span style="display:inline-block;background:#ecfdf5;border:1px solid #d1fae5;color:#059669;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700">Goed contact gehad</span></td></tr>
      </table>
      ${ctaBtn('Naar dashboard &rarr;', `${BASE_URL}/admin`)}`),
  });

  // 12. Batch voltooid (admin)
  templates.push({
    type: 'batch_completed_admin',
    label: 'Batch voltooid (admin)',
    description: 'Admin notificatie wanneer een batch voltooid is.',
    category: 'admin',
    subject: 'Batch voltooid: ZonnePro BV – Zonnepanelen',
    html: tplLayout('Batch Voltooid', `
      ${statusBadge('&#10003; VOLTOOID', 'green')}
      <p style="margin:0 0 8px">Een batch is zojuist voltooid:</p>
      ${dataTable(
        row('Klant', '<strong style="color:#0f172a">ZonnePro BV</strong>') +
        row('Branche', 'Zonnepanelen') +
        row('Batch ID', 'a1b2c3d4') +
        row('Grootte', '<strong style="color:#0f172a">250 / 250</strong> leads') +
        row('Voltooid op', '16-03-2026'),
        'Batchgegevens',
      )}
      <p style="margin:16px 0 0;font-size:14px;color:#64748b">Ga naar het admin-paneel om een eventuele vervolg-batch aan te maken.</p>
      ${ctaBtn('Naar verdeling &rarr;', `${BASE_URL}/admin/verdeling`)}`),
  });

  // 13. Nieuwe batch (admin)
  templates.push({
    type: 'new_batch_admin',
    label: 'Nieuwe batch (admin)',
    description: 'Admin notificatie wanneer een nieuwe batch besteld is.',
    category: 'admin',
    subject: 'Nieuwe batch: ZonnePro BV - 250 Zonnepanelen leads',
    html: tplLayout('Nieuwe Batch Aangemaakt', `
      <p style="margin:0 0 20px">Er is een nieuwe batch aangemaakt:</p>
      ${dataTable(
        row('Klant', '<strong style="color:#0f172a">ZonnePro BV</strong>') +
        row('Branche', 'Zonnepanelen') +
        row('Batch grootte', '<strong style="color:#0f172a">250</strong> leads') +
        row('Prijs per lead', '&euro;12,50') +
        row('Subtotaal excl. BTW', '&euro;3.125,00') +
        row('BTW 21%', '&euro;656,25') +
        `<tr><td style="padding:16px 20px;font-size:15px;color:#3B2F75;font-weight:700;border-bottom:1px solid #f1f5f9">Totaal incl. BTW</td><td style="padding:16px 20px;font-size:18px;color:#3B2F75;font-weight:800;text-align:right;border-bottom:1px solid #f1f5f9">&euro;3.781,25</td></tr>` +
        row('Bron', 'Portal bestelling') +
        `<tr><td style="padding:12px 20px;font-size:14px;color:#64748b">Betaalstatus</td><td style="padding:12px 20px;font-size:14px;font-weight:700;color:#059669">Betaald</td></tr>`,
        'Batchgegevens',
      )}
      ${ctaBtn('Bekijk in admin &rarr;', `${BASE_URL}/admin/batches`)}`),
  });

  // 14. Afspraak bevestiging (website)
  templates.push({
    type: 'booking_confirmation',
    label: 'Afspraak bevestiging',
    description: 'Bevestigingsmail voor de klant na het inplannen van een strategiegesprek.',
    category: 'website',
    subject: 'Bevestiging strategiegesprek - maandag 16 maart 2026 om 10:00',
    html: tplLayout('Afspraak bevestigd', `
      ${statusBadge('&#10003; BEVESTIGD', 'green')}
      <p style="margin:0 0 8px;font-size:15px;color:#475569;line-height:1.7">Je strategiegesprek met WarmeLeads is gepland.</p>
      ${dataTable(
        row('Datum', '<strong style="color:#0f172a">maandag 16 maart 2026</strong>') +
        row('Tijd', '<strong style="color:#0f172a">10:00 uur</strong>'),
        'Afspraakgegevens',
      )}
      <p style="margin:0 0 8px;font-size:14px;color:#64748b;line-height:1.7">We nemen op het afgesproken moment contact met je op. Heb je in de tussentijd vragen? Neem gerust contact op via <a href="mailto:info@warmeleads.eu" style="color:#3B2F75;text-decoration:none;font-weight:600">info@warmeleads.eu</a> of bel <a href="tel:0850477067" style="color:#3B2F75;text-decoration:none;font-weight:600">085 047 7067</a>.</p>
      <p style="margin:24px 0 0;font-size:13px;color:#94a3b8">Met vriendelijke groet,<br>Het WarmeLeads team</p>`),
  });

  // 15. Afspraak admin notificatie
  templates.push({
    type: 'booking_admin',
    label: 'Afspraak (admin)',
    description: 'Admin notificatie wanneer iemand een gesprek inplant via de website.',
    category: 'website',
    subject: 'Nieuw strategiegesprek: Pieter van Dijk - maandag 16 maart 2026 om 10:00',
    html: tplLayout('Nieuw strategiegesprek ingepland', `
      ${statusBadge('NIEUW GESPREK', 'blue')}
      ${dataTable(
        row('Datum', '<strong style="color:#0f172a">maandag 16 maart 2026</strong>') +
        row('Tijd', '<strong style="color:#0f172a">10:00 uur</strong>') +
        row('Naam', '<strong style="color:#0f172a">Pieter van Dijk</strong>') +
        row('Bedrijf', 'ZonnePro BV') +
        row('E-mail', '<a href="mailto:pieter@zonnepro.nl" style="color:#3B2F75;text-decoration:none;font-weight:600">pieter@zonnepro.nl</a>') +
        row('Telefoon', '<a href="tel:0612345678" style="color:#3B2F75;text-decoration:none;font-weight:600">06-12345678</a>') +
        row('Branche', 'Zonnepanelen') +
        row('Toelichting', 'Graag bespreken hoeveel leads per maand haalbaar zijn'),
        'Contactgegevens',
      )}`),
  });

  // 16. Afspraak geannuleerd
  templates.push({
    type: 'booking_cancelled',
    label: 'Afspraak geannuleerd',
    description: 'Wordt gestuurd als een afspraak geannuleerd is.',
    category: 'website',
    subject: 'Afspraak geannuleerd - maandag 16 maart 2026',
    html: tplLayout('Afspraak geannuleerd', `
      ${statusBadge('GEANNULEERD', 'red')}
      <p style="margin:0 0 16px">Helaas is je strategiegesprek op <strong style="color:#0f172a">maandag 16 maart 2026</strong> om <strong style="color:#0f172a">10:00 uur</strong> geannuleerd.</p>
      <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.7">Wil je een nieuw moment inplannen? Dat kan eenvoudig via onze agenda:</p>
      ${ctaBtn('Nieuw gesprek inplannen &rarr;', `${BASE_URL}/plan-gesprek`)}
      <p style="margin:24px 0 0;font-size:13px;color:#94a3b8">Met vriendelijke groet,<br>Het WarmeLeads team</p>`),
  });

  // 17. Mollie foutmelding (admin)
  templates.push({
    type: 'mollie_error',
    label: 'Mollie foutmelding',
    description: 'Admin alert bij een fout in het Mollie betalingsproces.',
    category: 'admin',
    subject: '[URGENT] Batch aanmaken mislukt voor order abc-123',
    html: tplLayout('Batch aanmaken mislukt', `
      ${statusBadge('&#9888; WAARSCHUWING', 'red')}
      <p style="margin:0 0 16px">De Mollie betaling is gelukt maar de batch kon niet worden aangemaakt in de database.</p>
      ${dataTable(
        row('Order ID', '<span style="font-family:monospace;font-weight:600">abc-123-def</span>') +
        row('Klant ID', '<span style="font-family:monospace;font-weight:600">cust-456-ghi</span>') +
        row('Branche', 'Zonnepanelen') +
        row('Batch size', '<strong style="color:#0f172a">250</strong>') +
        `<tr><td style="padding:12px 20px;font-size:14px;color:#64748b">Error</td><td style="padding:12px 20px;font-size:14px;color:#dc2626;font-weight:600">Database timeout</td></tr>`,
        'Foutdetails',
      )}
      <p style="margin:0;font-size:14px;color:#64748b">Maak de batch handmatig aan via de admin.</p>
      ${ctaBtn('Naar admin &rarr;', `${BASE_URL}/admin`)}`),
  });

  return templates;
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  if (admin.role !== 'superadmin') {
    return NextResponse.json({ error: 'Alleen superadmin heeft toegang' }, { status: 403 });
  }

  const templates = buildTemplates();
  return NextResponse.json({ templates });
}
