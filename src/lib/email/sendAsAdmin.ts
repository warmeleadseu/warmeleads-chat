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
}

export interface SendAsAdminResult extends DispatchEmailResult {
  /** True als opt-out de verzending heeft tegengehouden */
  blockedByOptOut?: boolean;
  unsubscribeToken?: string | null;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  // 1. Opt-out check (tenzij expliciet gebypassed). We blokkeren wanneer
  //    de ontvanger uitgeschreven is op de matching scope of op 'all'.
  if (!input.bypassOptOut) {
    const supabase = createServerClient();
    const scopesToCheck = ['all', input.scope].filter((v, i, a) => a.indexOf(v) === i);
    const { data: optouts } = await supabase
      .from('email_optouts')
      .select('email, scope')
      .eq('email', recipientEmail)
      .in('scope', scopesToCheck);
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
    fromAdminId: admin.id,
    prospectId: input.prospectId ?? null,
    customerId: input.customerId ?? null,
    templateKey: input.templateKey ?? null,
    templateOptions: input.templateOptions ?? null,
    unsubscribeToken,
  });

  return { ...result, unsubscribeToken };
}
