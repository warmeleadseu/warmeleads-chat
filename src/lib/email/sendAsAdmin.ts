import { randomBytes } from 'crypto';
import { createServerClient } from '@/lib/supabase';
import {
  ALLOWED_FROM_DOMAIN,
  EMAIL_BASE_URL,
  dispatchEmail,
  type DispatchEmailResult,
} from '@/lib/email';

export type EmailScope = 'all' | 'marketing' | 'nurture' | 'pricing';

export interface SendAsAdminInput {
  /** AM die afzendt; geeft from-line en reply-to */
  admin: { id: string; name: string; email: string };
  /** Ontvanger e-mailadres */
  to: string;
  /** Onderwerp */
  subject: string;
  /** Volledig HTML-body inclusief layout */
  html: string;
  /** Plain-text fallback (aanbevolen voor deliverability) */
  text?: string;
  /**
   * Marketing/communicatie-scope. Bepaalt of we de mail blokkeren
   * wanneer de ontvanger zich uitgeschreven heeft. Transactionele mails
   * (welkom, password-reset) gebruiken `bypassOptOut: true`.
   */
  scope: EmailScope;
  bypassOptOut?: boolean;
  /** Optionele relaties voor logging en mail-historie */
  prospectId?: string | null;
  customerId?: string | null;
  /** Template-key (bv. 'intro_prospect') en de gekozen opties */
  templateKey?: string | null;
  templateOptions?: Record<string, unknown> | null;
  /**
   * Voorgegenereerde unsubscribe-token. Als niet meegegeven en de scope
   * niet 'all' is, genereren we er zelf een. Voor bulk gebruiken we een
   * unieke token per ontvanger om individuele opt-out attribution te
   * kunnen doen.
   */
  unsubscribeToken?: string | null;
  metadata?: Record<string, unknown>;
  toName?: string;
  /**
   * Cc-ontvangers. Worden gevalideerd, ge-dedupliceerd en gefilterd op
   * opt-outs (op de matching scope of 'all'). Ze ontvangen GEEN eigen
   * unsubscribe-link (dat is voor de primaire ontvanger).
   */
  cc?: string[];
  /** Bcc-ontvangers. Idem als cc, maar onzichtbaar voor andere ontvangers. */
  bcc?: string[];
}

export interface SendAsAdminResult extends DispatchEmailResult {
  /** True als opt-out de verzending heeft tegengehouden */
  blockedByOptOut?: boolean;
  unsubscribeToken?: string | null;
  /** Cc/Bcc-adressen die zijn weggefilterd omdat ze uitgeschreven zijn. */
  filteredOptedOut?: { cc: string[]; bcc: string[] };
}

const MAX_CC = 25;
const MAX_BCC = 25;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Normaliseert een lijst e-mailadressen: lowercase, trim, dedupe, max-length.
 * Adressen die het primaire `to`-adres of een al gebruikt cc-adres dupliceren
 * worden weggefilterd. Ongeldige adressen worden via `invalid` teruggemeld.
 */
export function normalizeCcBcc(
  raw: string[] | undefined,
  exclude: Set<string>,
  max: number,
): { addresses: string[]; invalid: string[] } {
  if (!raw || !Array.isArray(raw)) return { addresses: [], invalid: [] };
  const addresses: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim().toLowerCase();
    if (!trimmed) continue;
    if (!EMAIL_REGEX.test(trimmed) || trimmed.length > 254) {
      invalid.push(trimmed);
      continue;
    }
    if (exclude.has(trimmed) || seen.has(trimmed)) continue;
    seen.add(trimmed);
    addresses.push(trimmed);
    if (addresses.length >= max) break;
  }
  return { addresses, invalid };
}

export function generateUnsubscribeToken(): string {
  return randomBytes(24).toString('base64url');
}

export function buildUnsubscribeUrl(token: string): string {
  return `${EMAIL_BASE_URL}/email/unsubscribe?token=${encodeURIComponent(token)}`;
}

/**
 * Verstuurt een mail uit naam van een account-manager. Voegt automatisch
 * Reply-To in op het AM-emailadres en zet List-Unsubscribe headers (RFC 8058)
 * voor compliance bij Gmail/Yahoo/etc. Logt het resultaat in email_log met
 * AM-context en eventuele prospect/customer-koppeling.
 */
export async function sendAsAdmin(input: SendAsAdminInput): Promise<SendAsAdminResult> {
  const { admin } = input;
  if (!EMAIL_REGEX.test(admin.email)) {
    return { ok: false, error: 'Ongeldig admin-emailadres' };
  }
  const domain = admin.email.split('@')[1]?.toLowerCase();
  if (domain !== ALLOWED_FROM_DOMAIN) {
    return {
      ok: false,
      error: `Verzenden alleen toegestaan vanaf @${ALLOWED_FROM_DOMAIN}`,
    };
  }
  if (!EMAIL_REGEX.test(input.to)) {
    return { ok: false, error: 'Ongeldig ontvanger-emailadres' };
  }

  const recipientEmail = input.to.trim().toLowerCase();

  // 0. Cc/bcc normaliseren — de primaire ontvanger of admin zelf nemen we
  //    nooit twee keer mee. Cc-set is ook excluded van bcc om duplicaten
  //    te voorkomen.
  const adminEmail = admin.email.trim().toLowerCase();
  const exclude = new Set<string>([recipientEmail, adminEmail]);
  const cc = normalizeCcBcc(input.cc, exclude, MAX_CC);
  for (const a of cc.addresses) exclude.add(a);
  const bcc = normalizeCcBcc(input.bcc, exclude, MAX_BCC);

  let filteredCc = cc.addresses;
  let filteredBcc = bcc.addresses;
  const optedOutCc: string[] = [];
  const optedOutBcc: string[] = [];

  // 1. Opt-out check (tenzij expliciet gebypassed). We blokkeren wanneer
  //    de ontvanger uitgeschreven is op de matching scope of op 'all'.
  //    Cc/bcc-adressen die uitgeschreven zijn worden stil weggefilterd
  //    zodat we de primaire mail wél kunnen sturen.
  if (!input.bypassOptOut) {
    const supabase = createServerClient();
    const scopesToCheck = ['all', input.scope].filter((v, i, a) => a.indexOf(v) === i);
    const allCheckEmails = Array.from(new Set([recipientEmail, ...filteredCc, ...filteredBcc]));
    const { data: optoutRows } = await supabase
      .from('email_optouts')
      .select('email, scope')
      .in('email', allCheckEmails)
      .in('scope', scopesToCheck);
    const optedOutEmails = new Set((optoutRows || []).map(r => r.email));
    if (filteredCc.length > 0) {
      filteredCc = filteredCc.filter(e => {
        if (optedOutEmails.has(e)) {
          optedOutCc.push(e);
          return false;
        }
        return true;
      });
    }
    if (filteredBcc.length > 0) {
      filteredBcc = filteredBcc.filter(e => {
        if (optedOutEmails.has(e)) {
          optedOutBcc.push(e);
          return false;
        }
        return true;
      });
    }
    const optouts = optedOutEmails.has(recipientEmail)
      ? (optoutRows || []).filter(r => r.email === recipientEmail)
      : [];
    if (optouts && optouts.length > 0) {
      // Toch loggen zodat AM dit terugziet in de mail-historie.
      await dispatchEmail(input.to, input.subject, input.html, {
        type: `am_${input.templateKey || 'compose'}`,
        toName: input.toName,
        metadata: { ...(input.metadata || {}), opt_out_scopes: optouts.map(o => o.scope) },
        from: `${input.admin.name} <${input.admin.email}>`,
        replyTo: input.admin.email,
        bodyText: input.text,
        fromAdminId: admin.id,
        prospectId: input.prospectId ?? null,
        customerId: input.customerId ?? null,
        templateKey: input.templateKey ?? null,
        templateOptions: input.templateOptions ?? null,
        unsubscribeToken: null,
      })
        .then(async result => {
          if (result.emailLogId) {
            const sb = createServerClient();
            await sb
              .from('email_log')
              .update({ status: 'opt_out', error: 'recipient_unsubscribed' })
              .eq('id', result.emailLogId);
          }
        })
        .catch(() => {});
      return {
        ok: false,
        blockedByOptOut: true,
        error: 'Ontvanger heeft zich uitgeschreven',
      };
    }
  }

  // 2. Genereer unsubscribe-token (tenzij scope 'all' transactioneel is en
  //    de aanroeper er geen meegeeft).
  const unsubscribeToken =
    input.unsubscribeToken ??
    (input.scope === 'all' && input.bypassOptOut ? null : generateUnsubscribeToken());
  const unsubscribeUrl = unsubscribeToken ? buildUnsubscribeUrl(unsubscribeToken) : null;

  // 3. List-Unsubscribe headers — Gmail/Yahoo verwachten zowel mailto: als
  //    https: variant; List-Unsubscribe-Post markeert RFC 8058 1-click.
  const headers: Record<string, string> = {};
  if (unsubscribeUrl) {
    const mailto = `mailto:unsubscribe@${ALLOWED_FROM_DOMAIN}?subject=unsubscribe%20${encodeURIComponent(unsubscribeToken!)}`;
    headers['List-Unsubscribe'] = `<${unsubscribeUrl}>, <${mailto}>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  // 4. From-formatting: 'Voornaam Achternaam <adres@warmeleads.eu>'.
  //    Quoten als naam komma's of speciale tekens bevat.
  const safeName = input.admin.name.replace(/["\\]/g, '');
  const needsQuote = /[,;:<>@()\[\]\\.]/.test(safeName);
  const fromHeader = `${needsQuote ? `"${safeName}"` : safeName} <${input.admin.email}>`;

  const result = await dispatchEmail(input.to, input.subject, input.html, {
    type: `am_${input.templateKey || 'compose'}`,
    toName: input.toName,
    metadata: input.metadata,
    from: fromHeader,
    replyTo: input.admin.email,
    headers,
    bodyText: input.text,
    cc: filteredCc.length > 0 ? filteredCc : undefined,
    bcc: filteredBcc.length > 0 ? filteredBcc : undefined,
    fromAdminId: admin.id,
    prospectId: input.prospectId ?? null,
    customerId: input.customerId ?? null,
    templateKey: input.templateKey ?? null,
    templateOptions: input.templateOptions ?? null,
    unsubscribeToken,
  });

  const filteredOptedOut =
    optedOutCc.length > 0 || optedOutBcc.length > 0
      ? { cc: optedOutCc, bcc: optedOutBcc }
      : undefined;

  return { ...result, unsubscribeToken, filteredOptedOut };
}
