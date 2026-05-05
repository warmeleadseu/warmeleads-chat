import type { PricingTier } from '@/lib/pricing';
import { sortTiersAscending } from '@/lib/pricing';
import type { BranchCtx, RenderCtx } from './types';

export function escape(s: string | number | null | undefined): string {
  if (s === null || s === undefined || s === '') return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>(?=\s*\n?)/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr|table)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Vervangt {{merge_tags}} in een vrije-tekst veld door waarden uit de
 * render-context. Onbekende tags worden gestripd en geretourneerd als
 * warning zodat de UI ze kan tonen.
 */
export function applyMergeTags(
  input: string,
  ctx: RenderCtx,
): { text: string; missing: string[] } {
  const missing: string[] = [];
  const map: Record<string, string> = {
    first_name: ctx.recipient.firstName || ctx.recipient.name.split(' ')[0] || '',
    contact_name: ctx.recipient.name,
    company_name: ctx.recipient.companyName,
    am_first_name: ctx.admin.firstName,
    am_name: ctx.admin.name,
    am_email: ctx.admin.email,
    am_phone: ctx.admin.phone || '',
    branches_list: ctx.branchesSelected.map(b => b.name).join(', '),
  };
  const text = input.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (full, key: string) => {
    const k = key.toLowerCase();
    if (k in map) return map[k] || '';
    if (!missing.includes(k)) missing.push(k);
    return '';
  });
  return { text, missing };
}

const EURO = (v: number) => '€' + v.toFixed(2).replace('.', ',');

/**
 * HTML-blok met prijsstaffel voor de geselecteerde branches.
 * Toont per branche de effectieve tiers (incl. customer-overrides) en
 * markeert het tier dat past bij het opgegeven volume.
 */
export function renderPricingBlock(
  branches: BranchCtx[],
  volume?: number | null,
): string {
  if (!branches.length) return '';
  const blocks = branches
    .map(b => {
      const tiers = sortTiersAscending(b.effectiveTiers);
      if (!tiers.length) {
        return `<div style="margin:18px 0;padding:14px 16px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;font-size:14px;color:#7c2d12">
          <strong>${escape(b.name)}</strong>: prijzen op aanvraag.
        </div>`;
      }
      const rows = tiers
        .map(t => {
          const isMatch =
            typeof volume === 'number' &&
            volume >= t.min_leads &&
            !tiers.some(x => x.min_leads > t.min_leads && volume >= x.min_leads);
          const bg = isMatch ? 'background:#ecfdf5;' : '';
          const fontWeight = isMatch ? '700' : '500';
          const color = isMatch ? '#059669' : '#0f172a';
          return `<tr>
            <td style="padding:8px 14px;font-size:13px;color:#475569;border-bottom:1px solid #f1f5f9;${bg}">vanaf ${t.min_leads} leads</td>
            <td style="padding:8px 14px;font-size:13px;color:${color};font-weight:${fontWeight};text-align:right;border-bottom:1px solid #f1f5f9;${bg}">${EURO(t.price_per_lead)} <span style="font-weight:400;color:#94a3b8">/ lead</span></td>
          </tr>`;
        })
        .join('');
      const discount =
        b.nationwideDiscount > 0
          ? `<div style="margin-top:8px;font-size:12px;color:#64748b">Landelijk verspreid: ${EURO(b.nationwideDiscount)} korting per lead.</div>`
          : '';
      return `<div style="margin:18px 0">
        <div style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:8px">${escape(b.name)}</div>
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;border-collapse:separate;border-spacing:0">${rows}</table>
        ${discount}
      </div>`;
    })
    .join('');
  return blocks;
}

/**
 * Plaintext-versie van de pricingblok voor de text/plain body.
 */
export function renderPricingText(
  branches: BranchCtx[],
  volume?: number | null,
): string {
  if (!branches.length) return '';
  return branches
    .map(b => {
      const tiers = sortTiersAscending(b.effectiveTiers);
      if (!tiers.length) return `${b.name}: prijzen op aanvraag`;
      const lines = tiers.map(t => {
        const marker =
          typeof volume === 'number' &&
          volume >= t.min_leads &&
          !tiers.some(x => x.min_leads > t.min_leads && volume >= x.min_leads)
            ? '➜ '
            : '  ';
        return `${marker}vanaf ${t.min_leads} leads — ${EURO(t.price_per_lead)} per lead`;
      });
      return `${b.name}\n${lines.join('\n')}`;
    })
    .join('\n\n');
}

/**
 * Standaard layout-shell voor AM-mails: simpel, persoonlijk, geen WL-header.
 * De ontvanger ziet de mail als 1-op-1 communicatie van de AM zelf.
 */
export function composeShell(opts: {
  bodyHtml: string;
  signatureHtml: string;
  unsubscribeUrl: string | null;
}): string {
  const unsubBlock = opts.unsubscribeUrl
    ? `<tr><td style="padding:24px 0 0;text-align:center;font-size:11px;color:#94a3b8;line-height:1.6">
        Wil je geen e-mails meer van ons ontvangen? <a href="${opts.unsubscribeUrl}" style="color:#94a3b8;text-decoration:underline">Schrijf je hier uit</a>.
      </td></tr>`
    : '';
  return `<!DOCTYPE html>
<html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;color:#0f172a">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f8fafc">
    <tr><td align="center" style="padding:32px 16px">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px">
        <tr><td style="padding:32px 36px;font-size:15px;line-height:1.7;color:#0f172a">
          ${opts.bodyHtml}
          <div style="margin-top:32px;padding-top:24px;border-top:1px solid #e2e8f0">${opts.signatureHtml}</div>
        </td></tr>
      </table>
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%">
        ${unsubBlock}
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function paragraph(text: string): string {
  return `<p style="margin:0 0 14px">${text}</p>`;
}

export function ctaButton(label: string, url: string): string {
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:18px 0">
    <tr><td style="border-radius:10px;background:linear-gradient(135deg,#FF6B35,#FF4757)">
      <a href="${url}" target="_blank" style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.3px">${escape(label)} →</a>
    </td></tr>
  </table>`;
}

export function tipBox(html: string): string {
  return `<div style="margin:18px 0;padding:14px 18px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;font-size:14px;color:#92400e">${html}</div>`;
}

export function quoteBox(html: string): string {
  return `<div style="margin:18px 0;padding:14px 18px;background:#f8fafc;border-left:3px solid #3B2F75;border-radius:6px;font-size:14px;color:#475569;font-style:italic">${html}</div>`;
}

export function pickFirstName(name: string): string {
  return (name || '').trim().split(/\s+/)[0] || '';
}

/**
 * Greeting met natuurlijke fallback. We gebruiken voornaam wanneer mogelijk;
 * anders 'Hallo' zonder naam (klinkt natuurlijker dan 'Hallo bedrijf').
 */
export function greetingLine(ctx: RenderCtx): string {
  const fn = ctx.recipient.firstName.trim();
  if (fn) return `Hallo ${escape(fn)},`;
  return 'Goedendag,';
}

export function joinNL(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} en ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} en ${items[items.length - 1]}`;
}

export function pricingHasAny(branches: BranchCtx[]): boolean {
  return branches.some(b => (b.effectiveTiers || []).length > 0);
}

export function tierAt(volume: number, tiers: PricingTier[]): PricingTier | null {
  const sorted = [...tiers].sort((a, b) => b.min_leads - a.min_leads);
  return sorted.find(t => volume >= t.min_leads) ?? null;
}

export function asBoolean(v: unknown): boolean {
  if (v === true || v === 1 || v === '1' || v === 'true') return true;
  return false;
}

export function asNumber(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
}

export function asString(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

export function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.length > 0);
}
