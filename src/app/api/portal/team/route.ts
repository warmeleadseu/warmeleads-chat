import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomer, portalUnauthorized } from '@/lib/portalAuth';
import { createServerClient } from '@/lib/supabase';
import { hasPermission, forbidden, PERMISSIONS, ROLE_DEFAULTS } from '@/lib/portalPermissions';
import bcrypt from 'bcryptjs';
import { sendEmail } from '@/lib/email';
import { escapeForIlikeExact, pickEmailRow } from '@/lib/emailDbLookup';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.warmeleads.eu';

export async function GET(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.TEAM_MANAGE)) return forbidden();

  const { customer } = session;
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('portal_users')
    .select('id, name, email, role, is_active, permissions, assignment_rules, last_login_at, last_seen_at, login_count, phone, created_at')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'Teamleden ophalen mislukt' }, { status: 500 });
  }

  // Count leads per agent
  const userIds = (data || []).map(u => u.id);
  const leadCounts: Record<string, number> = {};
  if (userIds.length > 0) {
    const { data: counts } = await supabase
      .from('lead_assignments')
      .select('portal_user_id')
      .eq('customer_id', customer.id)
      .in('portal_user_id', userIds);

    (counts || []).forEach((row: { portal_user_id: string }) => {
      leadCounts[row.portal_user_id] = (leadCounts[row.portal_user_id] || 0) + 1;
    });
  }

  const members = (data || []).map(u => ({
    ...u,
    lead_count: leadCounts[u.id] || 0,
  }));

  return NextResponse.json({ members });
}

export async function POST(request: NextRequest) {
  const session = await verifyCustomer(request);
  if (!session) return portalUnauthorized();
  if (!hasPermission(session, PERMISSIONS.TEAM_MANAGE)) return forbidden();

  const { customer } = session;

  try {
    const body = await request.json();
    const { name, email, password, role, permissions, assignment_rules, phone } = body;

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Naam, e-mail en wachtwoord zijn verplicht' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Wachtwoord moet minimaal 8 tekens bevatten' }, { status: 400 });
    }

    const validRoles = ['manager', 'agent'];
    const userRole = validRoles.includes(role) ? role : 'agent';

    const supabase = createServerClient();

    // Check for duplicate email across both tables
    const normalizedEmail = email.toLowerCase().trim();

    const emailPattern = escapeForIlikeExact(normalizedEmail);

    const { data: existingCustomerRows } = await supabase
      .from('customers')
      .select('id, email')
      .ilike('email', emailPattern)
      .limit(5);

    if (pickEmailRow(existingCustomerRows || [], normalizedEmail)) {
      return NextResponse.json({ error: 'Dit e-mailadres is al in gebruik' }, { status: 409 });
    }

    const { data: existingUserRows } = await supabase
      .from('portal_users')
      .select('id, email')
      .ilike('email', emailPattern)
      .limit(5);

    if (pickEmailRow(existingUserRows || [], normalizedEmail)) {
      return NextResponse.json({ error: 'Dit e-mailadres is al in gebruik' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const userPermissions = Array.isArray(permissions)
      ? permissions
      : ROLE_DEFAULTS[userRole] || ROLE_DEFAULTS.agent;

    const { data: newUser, error: insertError } = await supabase
      .from('portal_users')
      .insert({
        customer_id: customer.id,
        name: name.trim(),
        email: normalizedEmail,
        password_hash: passwordHash,
        role: userRole,
        permissions: userPermissions,
        assignment_rules: assignment_rules || {},
        phone: phone || null,
      })
      .select('id, name, email, role, is_active, permissions, assignment_rules, last_login_at, last_seen_at, login_count, phone, created_at')
      .single();

    if (insertError) {
      console.error('[team POST] insert failed:', insertError);
      return NextResponse.json({ error: 'Teamlid aanmaken mislukt' }, { status: 500 });
    }

    // Send welcome email
    try {
      const displayName = customer.contact_person || customer.name;
      const html = buildWelcomeEmail(name.trim(), normalizedEmail, password, customer.name, displayName);
      await sendEmail(normalizedEmail, `Welkom bij het ${customer.name} leadportaal - WarmeLeads`, html, {
        type: 'agent_welcome',
        toName: name.trim(),
        metadata: { customer_id: customer.id, portal_user_id: newUser.id },
      });
    } catch (emailErr) {
      console.error('[team POST] welcome email failed:', emailErr);
    }

    return NextResponse.json({ member: { ...newUser, lead_count: 0 } });
  } catch {
    return NextResponse.json({ error: 'Er ging iets mis' }, { status: 500 });
  }
}

function buildWelcomeEmail(name: string, email: string, password: string, companyName: string, ownerName: string): string {
  return `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Welkom bij ${companyName}</title></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f8fafc">
    <tr><td align="center" style="padding:40px 16px">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%">
        <tr><td style="height:4px;background:linear-gradient(135deg,#3B2F75 0%,#E74C8C 35%,#FF6B35 70%,#FF4757 100%);border-radius:12px 12px 0 0;font-size:0;line-height:0">&nbsp;</td></tr>
        <tr><td style="background-color:#ffffff;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;padding:32px 40px">
          <img src="${BASE_URL}/warmeleads-logo-2026.png" alt="WarmeLeads" width="130" style="max-width:130px;height:auto;display:block;margin-bottom:32px" />
          <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0f172a">Welkom bij het ${companyName} leadportaal!</h1>
          <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.7">Hoi ${name}, ${ownerName} heeft een account voor je aangemaakt in het WarmeLeads leadportaal.</p>
          <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.7">Je kunt inloggen met de volgende gegevens:</p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin:0 0 24px">
            <p style="margin:0 0 8px;font-size:14px;color:#475569"><strong>E-mail:</strong> ${email}</p>
            <p style="margin:0;font-size:14px;color:#475569"><strong>Wachtwoord:</strong> ${password}</p>
          </div>
          <p style="margin:0 0 24px;font-size:13px;color:#94a3b8">We raden aan om na je eerste login je wachtwoord te wijzigen.</p>
          <table cellpadding="0" cellspacing="0" role="presentation" style="margin:28px 0">
            <tr><td style="border-radius:10px;background:linear-gradient(135deg,#3B2F75,#E74C8C)">
              <a href="${BASE_URL}/portal" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.3px">Inloggen in het portaal</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="background-color:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:20px 40px">
          <p style="margin:0;font-size:12px;color:#cbd5e1">&copy; ${new Date().getFullYear()} WarmeLeads &middot; <a href="${BASE_URL}" style="color:#cbd5e1;text-decoration:none">warmeleads.eu</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
