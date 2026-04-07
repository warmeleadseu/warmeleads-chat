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

    const portalUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://warmeleads.eu'}/portal`;
    const greeting = customer.contact_person || customer.name;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; background: #0b0f1a;">
        <div style="background: linear-gradient(135deg, #0b0f1a 0%, #1a1040 50%, #0b0f1a 100%); padding: 40px 32px 32px; text-align: center; border-radius: 16px 16px 0 0;">
          <div style="margin-bottom: 8px;">
            <span style="font-size: 28px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff;">Warme</span><span style="font-size: 28px; font-weight: 800; letter-spacing: -0.5px; color: #a855f7;">Leads</span>
          </div>
          <p style="color: rgba(255,255,255,0.5); margin: 0; font-size: 13px; letter-spacing: 0.5px;">UW PERSOONLIJKE LEADPORTAAL</p>
        </div>
        <div style="margin: 0 20px; background: #ffffff; border-radius: 16px; padding: 36px 32px; position: relative; top: -8px;">
          <p style="color: #0f172a; font-size: 18px; font-weight: 700; line-height: 1.4; margin: 0 0 8px;">Hallo ${greeting},</p>
          <p style="color: #475569; font-size: 15px; line-height: 1.7; margin: 0 0 24px;">
            Uw persoonlijke leadportaal staat klaar! Hier vindt u al uw leads overzichtelijk op een plek, kunt u nieuwe batches bestellen en uw account beheren.
          </p>
          ${customer.portal_password ? `
          <div style="background: linear-gradient(135deg, #f8f6ff 0%, #f1f0ff 100%); border: 1px solid #e8e4ff; border-radius: 14px; padding: 24px; margin: 0 0 28px;">
            <p style="color: #7c3aed; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 16px;">Uw inloggegevens</p>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="color: #64748b; font-size: 13px; padding: 6px 0; width: 100px;">E-mail</td>
                <td style="color: #0f172a; font-size: 14px; font-weight: 600; padding: 6px 0;">${customer.email}</td>
              </tr>
              <tr>
                <td style="color: #64748b; font-size: 13px; padding: 6px 0; border-top: 1px solid #e8e4ff;">Wachtwoord</td>
                <td style="color: #0f172a; font-size: 14px; font-weight: 600; padding: 6px 0; border-top: 1px solid #e8e4ff; font-family: monospace;">${customer.portal_password}</td>
              </tr>
            </table>
          </div>
          ` : ''}
          <div style="text-align: center; margin: 0 0 28px;">
            <a href="${portalUrl}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-weight: 700; font-size: 15px; letter-spacing: 0.3px;">
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
