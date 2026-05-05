import type { AdminCtx } from './types';
import { escape } from './_helpers';
import { EMAIL_BASE_URL } from '@/lib/email';

/**
 * Rendert de standaard AM-handtekening conform de huisstijl. Wordt gebruikt
 * als fallback wanneer admin_users.email_signature_html niet is gezet.
 *
 * Belangrijk: alle styles zijn inline en alle afbeeldingen krijgen vaste
 * width/height attributen zodat Outlook/Gmail/Apple Mail consistent renderen.
 */
export function renderDefaultSignature(admin: AdminCtx, baseUrl: string): string {
  const title = escape(admin.title || 'Accountmanager · WarmeLeads');
  const name = escape(admin.name);
  const email = escape(admin.email);
  const phone = admin.phone ? escape(admin.phone) : '';
  const phoneTel = admin.phone ? admin.phone.replace(/[^+0-9]/g, '') : '';
  const avatarBlock = admin.avatarUrl
    ? `<td valign="top" width="84" style="padding:0 18px 0 0;vertical-align:top;width:84px">
        <img src="${escape(admin.avatarUrl)}" width="84" height="84" alt="${name}" style="display:block;width:84px;height:84px;border:0;outline:none;text-decoration:none;border-radius:50%;background-color:#f1f5f9;object-fit:cover;object-position:center" />
      </td>
      <td valign="top" width="2" bgcolor="#E74C8C" style="width:2px;background-color:#E74C8C;line-height:1px;font-size:0">&nbsp;</td>`
    : '';
  const padLeft = admin.avatarUrl ? '18px' : '0';
  const phoneRow = phone
    ? `<tr>
        <td style="padding:1px 14px 1px 0;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;line-height:1.5;white-space:nowrap">Mobiel</td>
        <td style="padding:1px 0;font-size:13px;line-height:1.5">
          <a href="tel:${escape(phoneTel)}" style="color:#0f172a;text-decoration:none;font-weight:600">${phone}</a>
        </td>
      </tr>`
    : '';
  return `<table border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0f172a">
    <tbody><tr>
      ${avatarBlock}
      <td valign="top" style="padding:0 0 0 ${padLeft};vertical-align:top">
        <p style="margin:0;font-size:16px;font-weight:700;color:#3B2F75;line-height:1.2">${name}</p>
        <p style="margin:2px 0 0;font-size:12px;font-weight:500;color:#64748b;line-height:1.4">${title}</p>
        <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;margin-top:10px">
          <tbody>
            ${phoneRow}
            <tr>
              <td style="padding:1px 14px 1px 0;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;line-height:1.5;white-space:nowrap">E-mail</td>
              <td style="padding:1px 0;font-size:13px;line-height:1.5">
                <a href="mailto:${email}" style="color:#0f172a;text-decoration:none;font-weight:600">${email}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:1px 14px 1px 0;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;line-height:1.5;white-space:nowrap">Web</td>
              <td style="padding:1px 0;font-size:13px;line-height:1.5">
                <a href="${escape(baseUrl)}" style="color:#0f172a;text-decoration:none;font-weight:600">warmeleads.eu</a>
              </td>
            </tr>
          </tbody>
        </table>
      </td>
    </tr></tbody>
  </table>`;
}

/**
 * Geeft de te gebruiken signature HTML terug: override (als admin er een
 * heeft ingesteld) of de auto-render fallback.
 */
export function resolveSignature(admin: AdminCtx, baseUrl: string = EMAIL_BASE_URL): string {
  if (admin.signatureHtmlOverride && admin.signatureHtmlOverride.trim().length > 0) {
    return admin.signatureHtmlOverride;
  }
  return renderDefaultSignature(admin, baseUrl);
}
