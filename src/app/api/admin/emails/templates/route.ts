import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://warmeleads.eu';

function layout(title: string, content: string): string {
  const logoUrl = `${BASE_URL}/logo-wit.png`;
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#1A1A2E;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#1A1A2E;padding:40px 20px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
  <tr><td style="padding:24px 32px;text-align:center">
    <img src="${logoUrl}" alt="WarmeLeads" width="140" style="max-width:140px;height:auto" />
  </td></tr>
  <tr><td style="background:#16213E;border-radius:12px;padding:32px;border:1px solid rgba(255,107,53,.15)">
    <h1 style="margin:0 0 20px;font-size:20px;color:#fff;font-weight:600">${title}</h1>
    <div style="color:#CBD5E1;font-size:15px;line-height:1.6">${content}</div>
  </td></tr>
  <tr><td style="padding:24px 32px;text-align:center;color:#64748B;font-size:12px">
    &copy; ${new Date().getFullYear()} WarmeLeads &middot; warmeleads.eu
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function badge(text: string): string {
  return `<span style="display:inline-block;background:rgba(255,107,53,.15);color:#FF6B35;padding:3px 10px;border-radius:6px;font-size:13px;font-weight:600">${text}</span>`;
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 12px;color:#94A3B8;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">${label}</td>
    <td style="padding:8px 12px;color:#E2E8F0;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">${value || '-'}</td>
  </tr>`;
}

function dataTable(rows: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-radius:8px;overflow:hidden;background:rgba(255,255,255,.03)">${rows}</table>`;
}

function invoiceLayout(title: string, content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#1A1A2E;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#1A1A2E;padding:40px 20px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
  <tr><td style="padding:24px 32px;text-align:center">
    <img src="${BASE_URL}/logo-wit.png" alt="WarmeLeads" height="32" style="height:32px;width:auto" />
  </td></tr>
  <tr><td style="background:#16213E;border-radius:12px;padding:32px;border:1px solid rgba(255,107,53,.15)">
    <h1 style="margin:0 0 20px;font-size:20px;color:#fff;font-weight:600">${title}</h1>
    <div style="color:#CBD5E1;font-size:15px;line-height:1.6">${content}</div>
  </td></tr>
  <tr><td style="padding:24px 32px;text-align:center;color:#64748B;font-size:12px">
    &copy; ${new Date().getFullYear()} WarmeLeads &middot; warmeleads.eu
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
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
    html: layout('Nieuwe Lead Ontvangen', `
      <p>Hallo Pieter van Dijk,</p>
      <p>Er is een nieuwe lead voor je binnengekomen in de branche ${badge('Zonnepanelen')}:</p>
      ${dataTable(
        row('Naam', 'Jan de Vries') +
        row('E-mail', 'jan@voorbeeld.nl') +
        row('Telefoon', '06-12345678') +
        row('Postcode', '1234 AB') +
        row('Huisnummer', '42') +
        row('Plaats', 'Amsterdam') +
        row('Provincie', 'Noord-Holland') +
        row('Datum', '15-03-2026')
      )}
      <p style="margin-top:12px;padding:12px;background:rgba(255,107,53,.08);border-radius:8px;color:#E2E8F0;font-size:14px"><strong style="color:#FF6B35">Notities:</strong> Graag teruggebeld in de avonduren</p>
      <p style="margin-top:20px">
        <a href="${BASE_URL}/portal" style="display:inline-block;background:linear-gradient(135deg,#FF6B35,#FF4757);color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Bekijk in portaal &rarr;</a>
      </p>`),
  });

  // 2. Dagelijks lead overzicht
  templates.push({
    type: 'daily_digest',
    label: 'Dagelijks lead overzicht',
    description: 'Dagelijkse samenvatting van nieuwe leads voor de klant.',
    category: 'klant',
    subject: 'Dagelijkse leads – maandag 16 maart',
    html: layout('Dagelijks Lead Overzicht', `
      <p>Hallo Pieter van Dijk,</p>
      <p>Hier zijn je leads van vandaag: ${badge('3 leads')}</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-radius:8px;overflow:hidden;background:rgba(255,255,255,.03)">
        <tr style="background:rgba(255,107,53,.1)">
          <th style="padding:8px 12px;text-align:left;color:#FF6B35;font-size:13px;font-weight:600">Naam</th>
          <th style="padding:8px 12px;text-align:left;color:#FF6B35;font-size:13px;font-weight:600">Plaats</th>
          <th style="padding:8px 12px;text-align:left;color:#FF6B35;font-size:13px;font-weight:600">Telefoon</th>
          <th style="padding:8px 12px;text-align:left;color:#FF6B35;font-size:13px;font-weight:600">Branche</th>
        </tr>
        <tr><td style="padding:8px 12px;color:#E2E8F0;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">Jan de Vries</td><td style="padding:8px 12px;color:#CBD5E1;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">Amsterdam</td><td style="padding:8px 12px;color:#CBD5E1;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">06-12345678</td><td style="padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.05)">${badge('Zonnepanelen')}</td></tr>
        <tr><td style="padding:8px 12px;color:#E2E8F0;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">Maria Jansen</td><td style="padding:8px 12px;color:#CBD5E1;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">Rotterdam</td><td style="padding:8px 12px;color:#CBD5E1;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">06-87654321</td><td style="padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.05)">${badge('Zonnepanelen')}</td></tr>
        <tr><td style="padding:8px 12px;color:#E2E8F0;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">Karel Bakker</td><td style="padding:8px 12px;color:#CBD5E1;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">Utrecht</td><td style="padding:8px 12px;color:#CBD5E1;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">06-55544433</td><td style="padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.05)">${badge('Warmtepompen')}</td></tr>
      </table>
      <p style="margin-top:20px"><a href="${BASE_URL}/portal" style="display:inline-block;background:linear-gradient(135deg,#FF6B35,#FF4757);color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Bekijk details in portaal &rarr;</a></p>`),
  });

  // 3. Batch 80%
  templates.push({
    type: 'batch_80pct',
    label: 'Batch 80% voltooid',
    description: 'Wordt gestuurd als een batch voor 80% geleverd is.',
    category: 'klant',
    subject: 'Uw batch Zonnepanelen is voor 80% voltooid',
    html: layout('Uw batch Zonnepanelen is voor 80% voltooid', `
      <p>Hallo Pieter van Dijk,</p>
      <p>Uw batch <strong>Zonnepanelen</strong> is al voor <strong>80%</strong> voltooid (200 van 250 leads geleverd).</p>
      <p>Bestel nu een vervolg batch zodat u geen leads mist zodra deze batch vol is.</p>
      <p style="margin-top:24px"><a href="${BASE_URL}/portal/bestellen" style="display:inline-block;background:linear-gradient(135deg,#FF6B35,#FF4757);color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">Nieuwe batch bestellen &rarr;</a></p>`),
  });

  // 4. Batch voltooid (klant)
  templates.push({
    type: 'batch_completed',
    label: 'Batch voltooid',
    description: 'Wordt gestuurd als alle leads van een batch geleverd zijn.',
    category: 'klant',
    subject: 'Uw batch Zonnepanelen is voltooid!',
    html: layout('Uw batch Zonnepanelen is voltooid!', `
      <p>Hallo Pieter van Dijk,</p>
      <p>Uw batch <strong>Zonnepanelen</strong> is volledig voltooid! Alle 250 leads zijn geleverd.</p>
      <p>Wilt u blijven groeien? Bestel direct een nieuwe batch en ontvang weer verse leads.</p>
      <p style="margin-top:24px"><a href="${BASE_URL}/portal/bestellen" style="display:inline-block;background:linear-gradient(135deg,#FF6B35,#FF4757);color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">Nieuwe batch bestellen &rarr;</a></p>`),
  });

  // 5. Batch reminder
  templates.push({
    type: 'batch_reminder',
    label: 'Batch herinnering',
    description: 'Wordt enkele dagen na batch-voltooiing gestuurd als herinnering.',
    category: 'klant',
    subject: 'U mist momenteel leads in Zonnepanelen',
    html: layout('U mist momenteel leads in Zonnepanelen', `
      <p>Hallo Pieter van Dijk,</p>
      <p>Het is nu een paar dagen geleden dat uw batch <strong>Zonnepanelen</strong> is voltooid. Momenteel ontvangt u geen nieuwe leads in dit segment.</p>
      <p>Bestel een nieuwe batch om weer leads te ontvangen.</p>
      <p style="margin-top:24px"><a href="${BASE_URL}/portal/bestellen" style="display:inline-block;background:linear-gradient(135deg,#FF6B35,#FF4757);color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">Nieuwe batch bestellen &rarr;</a></p>`),
  });

  // 6. Bestelling bevestigd
  templates.push({
    type: 'order_confirmation',
    label: 'Bestelling bevestigd',
    description: 'Bevestigingsmail na succesvolle bestelling van een nieuwe batch.',
    category: 'klant',
    subject: 'Bevestiging: nieuwe batch Zonnepanelen (250 leads)',
    html: layout('Bestelling Bevestigd', `
      <p>Hallo Pieter van Dijk,</p>
      <p>Bedankt voor uw bestelling! Uw nieuwe batch is aangemaakt en leads worden automatisch toegewezen.</p>
      ${dataTable(
        row('Branche', 'Zonnepanelen') +
        row('Batch grootte', '250 leads') +
        row('Prijs per lead (excl. BTW)', '&euro;12,50') +
        row('Subtotaal excl. BTW', '&euro;3.125,00') +
        row('BTW 21%', '&euro;656,25') +
        `<tr><td style="padding:10px 12px;color:#FF6B35;font-size:15px;font-weight:700;border-top:2px solid rgba(255,107,53,.2)">Totaal incl. BTW</td><td style="padding:10px 12px;color:#FF6B35;font-size:15px;font-weight:700;text-align:right;border-top:2px solid rgba(255,107,53,.2)">&euro;3.781,25</td></tr>`
      )}
      <p style="margin-top:20px"><a href="${BASE_URL}/portal" style="display:inline-block;background:linear-gradient(135deg,#FF6B35,#FF4757);color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Bekijk in portaal &rarr;</a></p>`),
  });

  // 7. Factuur (open)
  templates.push({
    type: 'invoice_open',
    label: 'Factuur (open)',
    description: 'Wordt gestuurd als een nieuwe factuur openstaat.',
    category: 'klant',
    subject: 'Nieuwe factuur WL-2026-0042 - WarmeLeads',
    html: invoiceLayout('Factuur WL-2026-0042', `
      <p>Hallo Pieter van Dijk,</p>
      <p>Er staat een nieuwe factuur voor je klaar:</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-radius:8px;overflow:hidden;background:rgba(255,255,255,.03)">
        <tr><td style="padding:8px 12px;color:#94A3B8;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">Factuurnummer</td><td style="padding:8px 12px;color:#E2E8F0;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">WL-2026-0042</td></tr>
        <tr><td style="padding:8px 12px;color:#94A3B8;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">Omschrijving</td><td style="padding:8px 12px;color:#E2E8F0;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">250 Zonnepanelen leads</td></tr>
        <tr><td style="padding:10px 12px;color:#FF6B35;font-size:15px;font-weight:700;border-top:2px solid rgba(255,107,53,.2)">Te betalen</td><td style="padding:10px 12px;color:#FF6B35;font-size:15px;font-weight:700;text-align:right;border-top:2px solid rgba(255,107,53,.2)">&euro;3.781,25</td></tr>
      </table>
      <p>Je kunt direct betalen via je portaal. Na betaling wordt je batch direct geactiveerd en ontvang je leads.</p>
      <p style="margin-top:12px"><a href="${BASE_URL}/portal/account" style="display:inline-block;background:linear-gradient(135deg,#FF6B35,#FF4757);color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Bekijk factuur &amp; betaal &rarr;</a></p>`),
  });

  // 8. Factuur (betaald)
  templates.push({
    type: 'invoice_paid',
    label: 'Factuur (betaald)',
    description: 'Wordt gestuurd als een factuur succesvol betaald is.',
    category: 'klant',
    subject: 'Factuur WL-2026-0042 - WarmeLeads',
    html: `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Factuur WL-2026-0042</title></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f8fafc">
    <tr><td align="center" style="padding:40px 16px">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%">
        <tr><td style="height:4px;background:linear-gradient(135deg,#3B2F75 0%,#E74C8C 35%,#FF6B35 70%,#FF4757 100%);border-radius:12px 12px 0 0;font-size:0;line-height:0">&nbsp;</td></tr>
        <tr><td style="background-color:#ffffff;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr><td style="padding:32px 40px 24px;border-bottom:1px solid #f1f5f9">
              <img src="${BASE_URL}/warmeleads-logo-2026.png" alt="WarmeLeads" width="130" style="max-width:130px;height:auto;display:block" />
            </td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr><td style="padding:32px 40px">
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px">
                <tr><td style="background-color:#ecfdf5;border:1px solid #d1fae5;border-radius:20px;padding:6px 14px">
                  <span style="color:#059669;font-size:12px;font-weight:700;letter-spacing:0.5px">&#10003; BETAALD</span>
                </td></tr>
              </table>
              <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#0f172a;line-height:1.4">Hallo Pieter van Dijk,</p>
              <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.7">Bedankt voor je betaling! Hierbij je factuur <strong style="color:#0f172a">WL-2026-0042</strong>.</p>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:28px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
                <tr><td style="background-color:#f8fafc;padding:14px 20px;border-bottom:1px solid #e2e8f0">
                  <span style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px">Factuurgegevens</span>
                </td></tr>
                <tr><td style="padding:0">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr><td style="padding:14px 20px;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9;width:140px">Factuurnummer</td><td style="padding:14px 20px;font-size:14px;color:#0f172a;font-weight:600;border-bottom:1px solid #f1f5f9">WL-2026-0042</td></tr>
                    <tr><td style="padding:14px 20px;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9">Omschrijving</td><td style="padding:14px 20px;font-size:14px;color:#0f172a;border-bottom:1px solid #f1f5f9">250 Zonnepanelen leads</td></tr>
                    <tr><td style="padding:14px 20px;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9">Status</td><td style="padding:14px 20px;font-size:14px;border-bottom:1px solid #f1f5f9"><span style="color:#059669;font-weight:600">Betaald</span></td></tr>
                    <tr><td style="padding:16px 20px;font-size:15px;color:#3B2F75;font-weight:700">Totaal incl. BTW</td><td style="padding:16px 20px;font-size:18px;color:#3B2F75;font-weight:800;text-align:right">&euro;3.781,25</td></tr>
                  </table>
                </td></tr>
              </table>
              <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.7">Je kunt je factuur downloaden als PDF via je persoonlijke portaal:</p>
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:8px">
                <tr><td style="border-radius:10px;background:linear-gradient(135deg,#FF6B35,#FF4757)">
                  <a href="${BASE_URL}/portal/account" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.3px">Factuur downloaden &rarr;</a>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="background-color:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px 40px">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr><td style="border-top:1px solid #e2e8f0;padding-top:20px">
              <p style="margin:0 0 6px;font-size:13px;color:#94a3b8;line-height:1.5">Vragen over deze factuur? Neem contact op via <a href="mailto:info@warmeleads.eu" style="color:#3B2F75;text-decoration:none;font-weight:600">info@warmeleads.eu</a> of bel <a href="tel:0850477067" style="color:#3B2F75;text-decoration:none;font-weight:600">085 047 7067</a>.</p>
              <p style="margin:0;font-size:12px;color:#cbd5e1;line-height:1.5">&copy; ${new Date().getFullYear()} WarmeLeads &middot; <a href="${BASE_URL}" style="color:#cbd5e1;text-decoration:none">warmeleads.eu</a></p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });

  // 9. Portaal herinnering
  templates.push({
    type: 'portal_reminder',
    label: 'Portaal herinnering',
    description: 'Wordt gestuurd om de klant te herinneren aan het portaal.',
    category: 'klant',
    subject: 'Je WarmeLeads portaal staat klaar!',
    html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; background: #1A1A2E;">
      <div style="background: linear-gradient(135deg, #3B2F75 0%, #E74C8C 50%, #FF6B35 100%); padding: 44px 32px 36px; text-align: center; border-radius: 16px 16px 0 0;">
        <img src="${BASE_URL}/logo-wit.png" alt="WarmeLeads" width="160" style="max-width: 160px; height: auto;" />
        <p style="color: rgba(255,255,255,0.7); margin: 14px 0 0; font-size: 13px; letter-spacing: 0.5px;">JOUW PERSOONLIJKE LEADPORTAAL</p>
      </div>
      <div style="margin: 0 20px; background: #ffffff; border-radius: 16px; padding: 36px 32px; position: relative; top: -8px;">
        <p style="color: #1A1A2E; font-size: 18px; font-weight: 700; line-height: 1.4; margin: 0 0 8px;">Hallo Pieter,</p>
        <p style="color: #475569; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">Je persoonlijke leadportaal staat klaar! Hier vind je al je leads overzichtelijk op een plek, kun je nieuwe batches bestellen en je account beheren.</p>
        <div style="background: linear-gradient(135deg, #FFF5F0 0%, #FFF0F5 100%); border: 1px solid #FFE0D0; border-radius: 14px; padding: 24px; margin: 0 0 28px;">
          <p style="color: #FF6B35; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 16px;">Je inloggegevens</p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="color: #64748b; font-size: 13px; padding: 6px 0; width: 100px;">E-mail</td><td style="color: #1A1A2E; font-size: 14px; font-weight: 600; padding: 6px 0;">pieter@zonnepro.nl</td></tr>
            <tr><td style="color: #64748b; font-size: 13px; padding: 6px 0; border-top: 1px solid #FFE0D0;">Wachtwoord</td><td style="color: #1A1A2E; font-size: 14px; font-weight: 600; padding: 6px 0; border-top: 1px solid #FFE0D0; font-family: monospace;">W3lk0m2026!</td></tr>
          </table>
        </div>
        <div style="text-align: center; margin: 0 0 28px;"><a href="${BASE_URL}/portal" style="display: inline-block; background: linear-gradient(135deg, #FF6B35 0%, #FF4757 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-weight: 700; font-size: 15px;">Ga naar je portaal &rarr;</a></div>
        <div style="border-top: 1px solid #f1f5f9; padding-top: 20px;"><p style="color: #94a3b8; font-size: 13px; line-height: 1.6; margin: 0; text-align: center;"><strong style="color: #64748b;">Tip:</strong> Installeer het portaal als app op je telefoon voor snelle toegang en pushnotificaties.</p></div>
      </div>
      <div style="padding: 28px 32px; text-align: center;"><p style="color: rgba(255,255,255,0.3); font-size: 12px; margin: 0;">WarmeLeads &middot; Jouw partner in exclusieve leads</p></div>
    </div>`,
  });

  // 10. Weekrapport (admin)
  templates.push({
    type: 'weekly_report',
    label: 'Weekrapport',
    description: 'Wekelijkse samenvatting met statistieken voor de admin.',
    category: 'admin',
    subject: 'WarmeLeads weekrapport – week 12',
    html: layout('Weekrapport – Week 12', `
      <p>Hier is je wekelijkse samenvatting:</p>
      ${dataTable(
        row('Totaal leads', '1.847') +
        row('Nieuwe leads deze week', '142') +
        row('Toegewezen deze week', '128') +
        row('Actieve klanten', '34') +
        row('Actieve batches', '21') +
        row('Voltooide batches', '3')
      )}
      <h2 style="margin:24px 0 12px;font-size:16px;color:#FF6B35;font-weight:600">Top Branches</h2>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;background:rgba(255,255,255,.03)">
        <tr style="background:rgba(255,107,53,.1)"><th style="padding:8px 12px;text-align:left;color:#FF6B35;font-size:13px;font-weight:600">Branche</th><th style="padding:8px 12px;text-align:right;color:#FF6B35;font-size:13px;font-weight:600">Leads</th></tr>
        <tr><td style="padding:6px 12px;color:#E2E8F0;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">Zonnepanelen</td><td style="padding:6px 12px;color:#FF6B35;font-size:14px;font-weight:600;text-align:right;border-bottom:1px solid rgba(255,255,255,.05)">58</td></tr>
        <tr><td style="padding:6px 12px;color:#E2E8F0;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">Warmtepompen</td><td style="padding:6px 12px;color:#FF6B35;font-size:14px;font-weight:600;text-align:right;border-bottom:1px solid rgba(255,255,255,.05)">41</td></tr>
        <tr><td style="padding:6px 12px;color:#E2E8F0;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">Thuisbatterijen</td><td style="padding:6px 12px;color:#FF6B35;font-size:14px;font-weight:600;text-align:right;border-bottom:1px solid rgba(255,255,255,.05)">29</td></tr>
      </table>
      <p style="margin-top:20px"><a href="${BASE_URL}/admin" style="display:inline-block;background:linear-gradient(135deg,#FF6B35,#FF4757);color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Naar dashboard &rarr;</a></p>`),
  });

  // 11. Feedback overzicht (admin)
  templates.push({
    type: 'feedback_digest',
    label: 'Feedback overzicht',
    description: 'Dagelijks overzicht van klantfeedback voor de admin.',
    category: 'admin',
    subject: 'Feedback overzicht – maandag 16 maart (5 nieuwe)',
    html: layout('Dagelijks Feedback Overzicht', `
      <p>Er zijn ${badge('5')} nieuwe feedbacks binnengekomen van klanten:</p>
      <div style="margin:12px 0">
        <span style="display:inline-block;background:#10B98120;color:#10B981;padding:4px 12px;border-radius:6px;font-size:13px;font-weight:600;margin:2px 4px 2px 0">Goed contact gehad: 2</span>
        <span style="display:inline-block;background:#8B5CF620;color:#8B5CF6;padding:4px 12px;border-radius:6px;font-size:13px;font-weight:600;margin:2px 4px 2px 0">Verkocht!: 1</span>
        <span style="display:inline-block;background:#F59E0B20;color:#F59E0B;padding:4px 12px;border-radius:6px;font-size:13px;font-weight:600;margin:2px 4px 2px 0">Onbereikbaar: 2</span>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-radius:8px;overflow:hidden;background:rgba(255,255,255,.03)">
        <tr style="background:rgba(255,107,53,.1)"><th style="padding:8px 12px;text-align:left;color:#FF6B35;font-size:13px;font-weight:600">Lead</th><th style="padding:8px 12px;text-align:left;color:#FF6B35;font-size:13px;font-weight:600">Klant</th><th style="padding:8px 12px;text-align:left;color:#FF6B35;font-size:13px;font-weight:600">Feedback</th></tr>
        <tr><td style="padding:8px 12px;color:#E2E8F0;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">Jan de Vries</td><td style="padding:8px 12px;color:#CBD5E1;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">ZonnePro BV</td><td style="padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.05)"><span style="display:inline-block;background:#8B5CF620;color:#8B5CF6;padding:3px 10px;border-radius:6px;font-size:13px;font-weight:600">Verkocht!</span></td></tr>
        <tr><td style="padding:8px 12px;color:#E2E8F0;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">Maria Jansen</td><td style="padding:8px 12px;color:#CBD5E1;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)">ZonnePro BV</td><td style="padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.05)"><span style="display:inline-block;background:#10B98120;color:#10B981;padding:3px 10px;border-radius:6px;font-size:13px;font-weight:600">Goed contact gehad</span></td></tr>
      </table>
      <p style="margin-top:20px"><a href="${BASE_URL}/admin" style="display:inline-block;background:linear-gradient(135deg,#FF6B35,#FF4757);color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Naar dashboard &rarr;</a></p>`),
  });

  // 12. Batch voltooid (admin)
  templates.push({
    type: 'batch_completed_admin',
    label: 'Batch voltooid (admin)',
    description: 'Admin notificatie wanneer een batch voltooid is.',
    category: 'admin',
    subject: 'Batch voltooid: ZonnePro BV – Zonnepanelen',
    html: layout('Batch Voltooid', `
      <p>Een batch is zojuist voltooid:</p>
      ${dataTable(
        row('Klant', 'ZonnePro BV') +
        row('Branche', 'Zonnepanelen') +
        row('Batch ID', 'a1b2c3d4') +
        row('Grootte', '250 / 250 leads') +
        row('Voltooid op', '16-03-2026')
      )}
      <p style="margin-top:16px">Ga naar het admin-paneel om een eventuele vervolg-batch aan te maken.</p>
      <p style="margin-top:20px"><a href="${BASE_URL}/admin/verdeling" style="display:inline-block;background:linear-gradient(135deg,#FF6B35,#FF4757);color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Naar verdeling &rarr;</a></p>`),
  });

  // 13. Nieuwe batch (admin)
  templates.push({
    type: 'new_batch_admin',
    label: 'Nieuwe batch (admin)',
    description: 'Admin notificatie wanneer een nieuwe batch besteld is.',
    category: 'admin',
    subject: 'Nieuwe batch: ZonnePro BV - 250 Zonnepanelen leads',
    html: invoiceLayout('Nieuwe Batch Aangemaakt', `
      <p>Er is een nieuwe batch aangemaakt:</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-radius:8px;overflow:hidden;background:rgba(255,255,255,.03)">
        ${row('Klant', 'ZonnePro BV')}
        ${row('Branche', 'Zonnepanelen')}
        ${row('Batch grootte', '250 leads')}
        ${row('Prijs per lead', '&euro;12,50')}
        ${row('Subtotaal excl. BTW', '&euro;3.125,00')}
        ${row('BTW 21%', '&euro;656,25')}
        <tr><td style="padding:10px 12px;color:#FF6B35;font-size:15px;font-weight:700;border-top:2px solid rgba(255,107,53,.2)">Totaal incl. BTW</td><td style="padding:10px 12px;color:#FF6B35;font-size:15px;font-weight:700;text-align:right;border-top:2px solid rgba(255,107,53,.2)">&euro;3.781,25</td></tr>
        ${row('Bron', 'Portal bestelling')}
        <tr><td style="padding:8px 12px;color:#94A3B8;font-size:14px">Betaalstatus</td><td style="padding:8px 12px;color:#10B981;font-size:14px;font-weight:600">Betaald</td></tr>
      </table>
      <p style="margin-top:12px"><a href="${BASE_URL}/admin/batches" style="display:inline-block;background:linear-gradient(135deg,#FF6B35,#FF4757);color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Bekijk in admin &rarr;</a></p>`),
  });

  // 14. Afspraak bevestiging (website)
  templates.push({
    type: 'booking_confirmation',
    label: 'Afspraak bevestiging',
    description: 'Bevestigingsmail voor de klant na het inplannen van een strategiegesprek.',
    category: 'website',
    subject: 'Bevestiging strategiegesprek - maandag 16 maart 2026 om 10:00',
    html: `<div style="font-family:-apple-system,system-ui,sans-serif;max-width:600px;margin:0 auto">
  <div style="background:linear-gradient(to bottom right,#1A1A2E,#3B2F75,#E74C8C);padding:32px;border-radius:12px 12px 0 0">
    <h1 style="color:#fff;font-size:24px;margin:0">Afspraak bevestigd</h1>
    <p style="color:rgba(255,255,255,.7);margin:8px 0 0;font-size:14px">Je strategiegesprek met WarmeLeads is gepland.</p>
  </div>
  <div style="background:#fff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
    <div style="background:#f8f9fa;border-radius:8px;padding:20px;margin-bottom:24px">
      <p style="margin:0 0 4px;font-size:13px;color:#64748b">Datum</p>
      <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#1e293b">maandag 16 maart 2026</p>
      <p style="margin:0 0 4px;font-size:13px;color:#64748b">Tijd</p>
      <p style="margin:0;font-size:16px;font-weight:600;color:#1e293b">10:00 uur</p>
    </div>
    <p style="font-size:14px;color:#475569;line-height:1.6">We nemen op het afgesproken moment contact met je op. Heb je in de tussentijd vragen? Neem gerust contact op via <a href="mailto:info@warmeleads.eu" style="color:#3B2F75">info@warmeleads.eu</a> of bel <a href="tel:0850477067" style="color:#3B2F75">085 047 7067</a>.</p>
    <p style="margin-top:24px;font-size:13px;color:#94a3b8">Met vriendelijke groet,<br>Het WarmeLeads team</p>
  </div>
</div>`,
  });

  // 15. Afspraak admin notificatie
  templates.push({
    type: 'booking_admin',
    label: 'Afspraak (admin)',
    description: 'Admin notificatie wanneer iemand een gesprek inplant via de website.',
    category: 'website',
    subject: 'Nieuw strategiegesprek: Pieter van Dijk - maandag 16 maart 2026 om 10:00',
    html: `<div style="font-family:-apple-system,system-ui,sans-serif;max-width:600px;margin:0 auto">
  <div style="background:linear-gradient(to bottom right,#1A1A2E,#3B2F75,#E74C8C);padding:32px;border-radius:12px 12px 0 0">
    <h1 style="color:#fff;font-size:24px;margin:0">Nieuw strategiegesprek ingepland</h1>
  </div>
  <div style="background:#fff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:8px 0;color:#64748b;font-size:13px;width:100px">Datum</td><td style="padding:8px 0;font-weight:600;color:#1e293b">maandag 16 maart 2026</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;font-size:13px">Tijd</td><td style="padding:8px 0;font-weight:600;color:#1e293b">10:00 uur</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;font-size:13px">Naam</td><td style="padding:8px 0;font-weight:600;color:#1e293b">Pieter van Dijk</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;font-size:13px">Bedrijf</td><td style="padding:8px 0;font-weight:600;color:#1e293b">ZonnePro BV</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;font-size:13px">E-mail</td><td style="padding:8px 0;font-weight:600;color:#1e293b"><a href="mailto:pieter@zonnepro.nl">pieter@zonnepro.nl</a></td></tr>
      <tr><td style="padding:8px 0;color:#64748b;font-size:13px">Telefoon</td><td style="padding:8px 0;font-weight:600;color:#1e293b"><a href="tel:0612345678">06-12345678</a></td></tr>
      <tr><td style="padding:8px 0;color:#64748b;font-size:13px">Branche</td><td style="padding:8px 0;font-weight:600;color:#1e293b">Zonnepanelen</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;font-size:13px">Toelichting</td><td style="padding:8px 0;color:#1e293b">Graag bespreken hoeveel leads per maand haalbaar zijn</td></tr>
    </table>
  </div>
</div>`,
  });

  // 16. Afspraak geannuleerd
  templates.push({
    type: 'booking_cancelled',
    label: 'Afspraak geannuleerd',
    description: 'Wordt gestuurd als een afspraak geannuleerd is.',
    category: 'website',
    subject: 'Afspraak geannuleerd - maandag 16 maart 2026',
    html: `<div style="font-family:-apple-system,system-ui,sans-serif;max-width:600px;margin:0 auto">
  <div style="background:linear-gradient(to bottom right,#1A1A2E,#3B2F75,#E74C8C);padding:32px;border-radius:12px 12px 0 0">
    <h1 style="color:#fff;font-size:24px;margin:0">Afspraak geannuleerd</h1>
  </div>
  <div style="background:#fff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
    <p style="font-size:14px;color:#475569;line-height:1.6">Helaas is je strategiegesprek op <strong>maandag 16 maart 2026</strong> om <strong>10:00 uur</strong> geannuleerd.</p>
    <p style="font-size:14px;color:#475569;line-height:1.6;margin-top:16px">Wil je een nieuw moment inplannen? Dat kan eenvoudig via <a href="https://www.warmeleads.eu/plan-gesprek" style="color:#3B2F75;font-weight:600">onze agenda</a>.</p>
    <p style="margin-top:24px;font-size:13px;color:#94a3b8">Met vriendelijke groet,<br>Het WarmeLeads team</p>
  </div>
</div>`,
  });

  // 17. Mollie foutmelding (admin)
  templates.push({
    type: 'mollie_error',
    label: 'Mollie foutmelding',
    description: 'Admin alert bij een fout in het Mollie betalingsproces.',
    category: 'admin',
    subject: '[URGENT] Batch aanmaken mislukt voor order abc-123',
    html: layout('Betalingsfout', `
      <p>De Mollie betaling is gelukt maar de batch kon niet worden aangemaakt in de database.</p>
      ${dataTable(
        row('Order ID', 'abc-123-def') +
        row('Klant ID', 'cust-456-ghi') +
        row('Branche', 'Zonnepanelen') +
        row('Batch size', '250') +
        row('Error', 'Database timeout')
      )}
      <p>Maak de batch handmatig aan via de admin.</p>`),
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
