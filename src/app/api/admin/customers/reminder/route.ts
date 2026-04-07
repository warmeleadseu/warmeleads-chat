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
    const logoUrl = `${baseUrl}/logo-wit.png`;
    const greeting = customer.contact_person || customer.name;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; background: #1A1A2E;">
        <div style="background: linear-gradient(135deg, #3B2F75 0%, #E74C8C 50%, #FF6B35 100%); padding: 44px 32px 36px; text-align: center; border-radius: 16px 16px 0 0;">
          <img src="${logoUrl}" alt="WarmeLeads" width="160" style="max-width: 160px; height: auto;" />
          <p style="color: rgba(255,255,255,0.7); margin: 14px 0 0; font-size: 13px; letter-spacing: 0.5px;">UW PERSOONLIJKE LEADPORTAAL</p>
        </div>
        <div style="margin: 0 20px; background: #ffffff; border-radius: 16px; padding: 36px 32px; position: relative; top: -8px;">
          <p style="color: #1A1A2E; font-size: 18px; font-weight: 700; line-height: 1.4; margin: 0 0 8px;">Hallo ${greeting},</p>
          <p style="color: #475569; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
            Uw persoonlijke leadportaal staat klaar! Hier vindt u al uw leads overzichtelijk op een plek, kunt u nieuwe batches bestellen en uw account beheren.
          </p>
          ${customer.portal_password ? `
          <div style="background: linear-gradient(135deg, #FFF5F0 0%, #FFF0F5 100%); border: 1px solid #FFE0D0; border-radius: 14px; padding: 24px; margin: 0 0 28px;">
            <p style="color: #FF6B35; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 16px;">Uw inloggegevens</p>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="color: #64748b; font-size: 13px; padding: 6px 0; width: 100px;">E-mail</td>
                <td style="color: #1A1A2E; font-size: 14px; font-weight: 600; padding: 6px 0;">${customer.email}</td>
              </tr>
              <tr>
                <td style="color: #64748b; font-size: 13px; padding: 6px 0; border-top: 1px solid #FFE0D0;">Wachtwoord</td>
                <td style="color: #1A1A2E; font-size: 14px; font-weight: 600; padding: 6px 0; border-top: 1px solid #FFE0D0; font-family: monospace;">${customer.portal_password}</td>
              </tr>
            </table>
          </div>
          ` : ''}
          <div style="text-align: center; margin: 0 0 28px;">
            <a href="${portalUrl}" style="display: inline-block; background: linear-gradient(135deg, #FF6B35 0%, #FF4757 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-weight: 700; font-size: 15px; letter-spacing: 0.3px;">
              Ga naar uw portaal &rarr;
            </a>
          </div>
          <div style="border-top: 1px solid #f1f5f9; padding-top: 20px;">
            <p style="color: #94a3b8; font-size: 13px; line-height: 1.6; margin: 0; text-align: center;">
              <strong style="color: #64748b;">Tip:</strong> Installeer het portaal als app op uw telefoon voor snelle toegang en pushnotificaties.
            </p>
          </div>
        </div>
        <div style="padding: 28px 32px; text-align: center;">
          <p style="color: rgba(255,255,255,0.3); font-size: 12px; margin: 0;">WarmeLeads &middot; Uw partner in exclusieve leads</p>
        </div>
      </div>
    `;

    const sent = await sendEmail(
      customer.email,
      'Uw WarmeLeads portaal staat klaar!',
      html,
    );

    if (!sent) {
      return NextResponse.json({ error: 'E-mail versturen mislukt' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Er ging iets mis' }, { status: 500 });
  }
}
