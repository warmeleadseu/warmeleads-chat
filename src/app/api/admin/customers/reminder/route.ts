import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { sendEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  try {
    const { customer_id } = await request.json();
    if (!customer_id) {
      return NextResponse.json({ error: 'customer_id is verplicht' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data: customer, error } = await supabase
      .from('customers')
      .select('id, name, email, contact_person, portal_active, portal_password')
      .eq('id', customer_id)
      .single();

    if (error || !customer) {
      return NextResponse.json({ error: 'Klant niet gevonden' }, { status: 404 });
    }

    if (!customer.email) {
      return NextResponse.json({ error: 'Klant heeft geen e-mailadres' }, { status: 400 });
    }

    if (!customer.portal_active) {
      return NextResponse.json({ error: 'Portaal is niet actief voor deze klant' }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://warmeleads.eu';
    const portalUrl = `${baseUrl}/portal`;
    const logoUrl = `${baseUrl}/warmeleads-logo-2026.png`;
    const greeting = customer.contact_person || customer.name;
    const year = new Date().getFullYear();

    const html = `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Je WarmeLeads portaal staat klaar!</title></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f8fafc">
    <tr><td align="center" style="padding:40px 16px">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%">
        <tr><td style="height:4px;background:linear-gradient(135deg,#3B2F75 0%,#E74C8C 35%,#FF6B35 70%,#FF4757 100%);border-radius:12px 12px 0 0;font-size:0;line-height:0">&nbsp;</td></tr>
        <tr><td style="background-color:#ffffff;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr><td style="padding:32px 40px 24px;border-bottom:1px solid #f1f5f9">
              <img src="${logoUrl}" alt="WarmeLeads" width="130" style="max-width:130px;height:auto;display:block" />
            </td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr><td style="padding:32px 40px">
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px">
                <tr><td style="background-color:#faf5ff;border:1px solid #e9d5ff;border-radius:20px;padding:6px 14px">
                  <span style="color:#7c3aed;font-size:12px;font-weight:700;letter-spacing:0.5px">JOUW LEADPORTAAL</span>
                </td></tr>
              </table>
              <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#0f172a;line-height:1.4">Hallo ${greeting},</p>
              <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.7">Je persoonlijke leadportaal staat klaar! Hier vind je al je leads overzichtelijk op een plek, kun je nieuwe batches bestellen en je account beheren.</p>
              ${customer.portal_password ? `
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:28px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
                <tr><td style="background-color:#f8fafc;padding:14px 20px;border-bottom:1px solid #e2e8f0">
                  <span style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px">Je inloggegevens</span>
                </td></tr>
                <tr><td style="padding:0">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr><td style="padding:14px 20px;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9;width:120px">E-mail</td><td style="padding:14px 20px;font-size:14px;color:#0f172a;font-weight:600;border-bottom:1px solid #f1f5f9">${customer.email}</td></tr>
                    <tr><td style="padding:14px 20px;font-size:14px;color:#64748b">Wachtwoord</td><td style="padding:14px 20px;font-size:14px;color:#0f172a;font-weight:600;font-family:monospace">${customer.portal_password}</td></tr>
                  </table>
                </td></tr>
              </table>
              ` : ''}
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:28px">
                <tr><td style="border-radius:10px;background:linear-gradient(135deg,#FF6B35,#FF4757)">
                  <a href="${portalUrl}" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.3px">Ga naar je portaal &rarr;</a>
                </td></tr>
              </table>
              <div style="border-top:1px solid #f1f5f9;padding-top:20px">
                <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6"><strong style="color:#64748b">Tip:</strong> Installeer het portaal als app op je telefoon voor snelle toegang en pushnotificaties.</p>
              </div>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="background-color:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px 40px">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr><td style="border-top:1px solid #e2e8f0;padding-top:20px">
              <p style="margin:0 0 6px;font-size:13px;color:#94a3b8;line-height:1.5">Vragen? Neem contact op via <a href="mailto:info@warmeleads.eu" style="color:#3B2F75;text-decoration:none;font-weight:600">info@warmeleads.eu</a> of bel <a href="tel:0850477067" style="color:#3B2F75;text-decoration:none;font-weight:600">085 047 7067</a>.</p>
              <p style="margin:0;font-size:12px;color:#cbd5e1;line-height:1.5">&copy; ${year} WarmeLeads &middot; <a href="${baseUrl}" style="color:#cbd5e1;text-decoration:none">warmeleads.eu</a></p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const sent = await sendEmail(
      customer.email,
      'Je WarmeLeads portaal staat klaar!',
      html,
      { type: 'portal_reminder', toName: customer.contact_person || customer.name, metadata: { customer_id: customer.id } },
    );

    if (!sent) {
      return NextResponse.json({ error: 'E-mail versturen mislukt' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Er ging iets mis' }, { status: 500 });
  }
}
