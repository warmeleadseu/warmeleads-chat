/**
 * Gmail SMTP transport for lead-facing thuisbatterij appointment mails.
 *
 * Vercel env:
 *   GMAIL_APPOINTMENT_USER          (default: thuisbatterijafspraken@gmail.com)
 *   GMAIL_APPOINTMENT_APP_PASSWORD  (Google App Password — required)
 *   GMAIL_APPOINTMENT_FROM_NAME     (default: Thuisbatterij Afspraken)
 *
 * Setup: Google Account → Beveiliging → 2FA → App-wachtwoorden → "WarmeLeads".
 */
import nodemailer from 'nodemailer';
import { createServerClient } from '@/lib/supabase';

const DEFAULT_USER = 'thuisbatterijafspraken@gmail.com';
const DEFAULT_FROM_NAME = 'Thuisbatterij Afspraken';

export interface GmailSendOpts {
  type: string;
  toName?: string;
  metadata?: Record<string, unknown>;
  replyTo?: string;
  bodyText?: string;
}

export interface GmailSendResult {
  ok: boolean;
  messageId?: string | null;
  emailLogId?: string | null;
  error?: string;
}

function getGmailCredentials(): { user: string; pass: string; fromName: string } | null {
  const user = (process.env.GMAIL_APPOINTMENT_USER || DEFAULT_USER).trim();
  const pass = (process.env.GMAIL_APPOINTMENT_APP_PASSWORD || '').replace(/\s+/g, '');
  const fromName = (process.env.GMAIL_APPOINTMENT_FROM_NAME || DEFAULT_FROM_NAME).trim();
  if (!pass) return null;
  return { user, pass, fromName };
}

export function isGmailAppointmentConfigured(): boolean {
  return getGmailCredentials() !== null;
}

async function logGmailEmail(
  to: string,
  subject: string,
  html: string,
  status: 'sent' | 'failed',
  opts: GmailSendOpts,
  error?: string,
  providerMessageId?: string | null,
): Promise<string | null> {
  try {
    const supabase = createServerClient();
    const { data, error: dbError } = await supabase
      .from('email_log')
      .insert({
        type: opts.type || 'unknown',
        to_email: to,
        to_name: opts.toName || null,
        subject,
        html,
        status,
        error: error || null,
        metadata: { ...(opts.metadata || {}), provider: 'gmail_smtp' },
        reply_to: opts.replyTo || null,
        body_text: opts.bodyText || null,
        provider_message_id: providerMessageId || null,
      })
      .select('id')
      .single();
    if (dbError) {
      console.error('[gmail-smtp] email_log insert error:', dbError.message);
      return null;
    }
    return data?.id ?? null;
  } catch (e) {
    console.error('[gmail-smtp] email_log failed:', e);
    return null;
  }
}

/**
 * Stuur e-mail via Gmail SMTP (app-wachtwoord).
 * Gebruikt voor lead-facing thuisbatterij afspraakmails.
 */
export async function sendGmailEmail(
  to: string,
  subject: string,
  html: string,
  opts: GmailSendOpts,
): Promise<GmailSendResult> {
  const creds = getGmailCredentials();
  if (!creds) {
    console.warn('[gmail-smtp] GMAIL_APPOINTMENT_APP_PASSWORD not configured, skipping send');
    const id = await logGmailEmail(to, subject, html, 'failed', opts, 'GMAIL_APPOINTMENT_APP_PASSWORD not configured');
    return { ok: false, emailLogId: id, error: 'GMAIL_APPOINTMENT_APP_PASSWORD not configured' };
  }

  const from = `${creds.fromName} <${creds.user}>`;
  const replyTo = opts.replyTo || creds.user;

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: creds.user, pass: creds.pass },
    });

    const info = await transporter.sendMail({
      from,
      to,
      replyTo,
      subject,
      html,
      text: opts.bodyText,
    });

    const messageId = typeof info.messageId === 'string' ? info.messageId : null;
    const id = await logGmailEmail(to, subject, html, 'sent', { ...opts, replyTo }, undefined, messageId);
    return { ok: true, messageId, emailLogId: id };
  } catch (err) {
    console.error('[gmail-smtp] send failed:', err);
    const id = await logGmailEmail(to, subject, html, 'failed', { ...opts, replyTo }, String(err));
    return { ok: false, emailLogId: id, error: String(err) };
  }
}
