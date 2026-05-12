import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { sendEmail } from '@/lib/email';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { escapeForIlikeExact, pickEmailRow } from '@/lib/emailDbLookup';
import crypto from 'crypto';

const MAX_ATTEMPTS = 3;
const WINDOW_MS = 15 * 60 * 1000;
const TOKEN_EXPIRY_MS = 60 * 60 * 1000;
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.warmeleads.eu';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const { limited, response } = rateLimit(ip, 'forgot-password', MAX_ATTEMPTS, WINDOW_MS);
    if (limited) return response!;

    const { email } = await request.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'E-mailadres is verplicht' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Always return success to prevent email enumeration
    const successResponse = NextResponse.json({
      success: true,
      message: 'Als dit e-mailadres bij ons bekend is, ontvang je binnen enkele minuten een e-mail met instructies.',
    });

    const supabase = createServerClient();

    let targetId: string | null = null;
    let targetColumn: 'customer_id' | 'portal_user_id' = 'customer_id';
    let displayName = '';
    let targetEmail = '';

    // Check customers table first
    const emailPattern = escapeForIlikeExact(normalizedEmail);

    const { data: customerRows } = await supabase
      .from('customers')
      .select('id, name, email, contact_person, is_active, portal_active, password_hash')
      .ilike('email', emailPattern)
      .limit(5);

    const customer = pickEmailRow(customerRows || [], normalizedEmail);

    if (customer && customer.is_active && customer.portal_active && customer.password_hash) {
      targetId = customer.id;
      targetColumn = 'customer_id';
      displayName = customer.contact_person || customer.name;
      targetEmail = customer.email;
    } else {
      // Check portal_users table
      const { data: portalUserRows } = await supabase
        .from('portal_users')
        .select('id, customer_id, name, email, is_active')
        .ilike('email', emailPattern)
        .limit(5);

      const portalUser = pickEmailRow(portalUserRows || [], normalizedEmail);

      if (portalUser && portalUser.is_active) {
        const { data: parentCustomer } = await supabase
          .from('customers')
          .select('id, is_active, portal_active')
          .eq('id', portalUser.customer_id)
          .eq('is_active', true)
          .eq('portal_active', true)
          .single();

        if (parentCustomer) {
          targetId = portalUser.id;
          targetColumn = 'portal_user_id';
          displayName = portalUser.name;
          targetEmail = portalUser.email;
        }
      }
    }

    if (!targetId) {
      return successResponse;
    }

    // Invalidate any existing unused tokens for this user
    await supabase
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq(targetColumn, targetId)
      .is('used_at', null);

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS).toISOString();

    const insertData: Record<string, string> = { token, expires_at: expiresAt };
    insertData[targetColumn] = targetId;
    await supabase.from('password_reset_tokens').insert(insertData);

    const resetUrl = `${BASE_URL}/portal/wachtwoord-resetten?token=${token}`;

    const html = `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Wachtwoord resetten</title></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f8fafc">
    <tr><td align="center" style="padding:40px 16px">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%">
        <tr><td style="height:4px;background:linear-gradient(135deg,#3B2F75 0%,#E74C8C 35%,#FF6B35 70%,#FF4757 100%);border-radius:12px 12px 0 0;font-size:0;line-height:0">&nbsp;</td></tr>
        <tr><td style="background-color:#ffffff;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;padding:32px 40px">
          <img src="${BASE_URL}/warmeleads-logo-2026.png" alt="WarmeLeads" width="130" style="max-width:130px;height:auto;display:block;margin-bottom:32px" />
          <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0f172a">Wachtwoord resetten</h1>
          <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.7">Hoi ${displayName}, je hebt een wachtwoord-reset aangevraagd voor je WarmeLeads portaal account.</p>
          <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.7">Klik op de onderstaande knop om een nieuw wachtwoord in te stellen. Deze link is 1 uur geldig.</p>
          <table cellpadding="0" cellspacing="0" role="presentation" style="margin:28px 0">
            <tr><td style="border-radius:10px;background:linear-gradient(135deg,#3B2F75,#E74C8C)">
              <a href="${resetUrl}" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.3px">Wachtwoord resetten</a>
            </td></tr>
          </table>
          <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;line-height:1.5">Heb je deze reset niet aangevraagd? Dan kun je deze e-mail veilig negeren.</p>
          <p style="margin:0;font-size:12px;color:#cbd5e1;word-break:break-all">${resetUrl}</p>
        </td></tr>
        <tr><td style="background-color:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:20px 40px">
          <p style="margin:0;font-size:12px;color:#cbd5e1">&copy; ${new Date().getFullYear()} WarmeLeads &middot; <a href="${BASE_URL}" style="color:#cbd5e1;text-decoration:none">warmeleads.eu</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await sendEmail(targetEmail, 'Wachtwoord resetten - WarmeLeads', html, {
      type: 'password_reset',
      toName: displayName,
      metadata: { [targetColumn]: targetId },
    });

    return successResponse;
  } catch {
    return NextResponse.json({ error: 'Er ging iets mis' }, { status: 500 });
  }
}
