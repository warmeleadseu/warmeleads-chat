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
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #7c3aed, #a855f7); padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">WarmeLeads</h1>
          <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">Uw persoonlijke leadportaal</p>
        </div>
        <div style="background: #ffffff; padding: 32px; border: 1px solid #e2e8f0; border-top: none;">
          <p style="color: #334155; font-size: 16px; line-height: 1.6;">Hallo ${greeting},</p>
          <p style="color: #334155; font-size: 15px; line-height: 1.6;">
            We wilden u laten weten dat uw persoonlijke leadportaal klaarstaat! Hier vindt u al uw leads overzichtelijk op een plek, kunt u nieuwe batches bestellen en uw account beheren.
          </p>
          ${customer.portal_password ? `
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <p style="color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 12px;">Uw inloggegevens</p>
            <p style="color: #334155; font-size: 14px; margin: 0 0 6px;"><strong>E-mail:</strong> ${customer.email}</p>
            <p style="color: #334155; font-size: 14px; margin: 0;"><strong>Wachtwoord:</strong> ${customer.portal_password}</p>
          </div>
          ` : ''}
          <div style="text-align: center; margin: 28px 0;">
            <a href="${portalUrl}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed, #a855f7); color: white; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 700; font-size: 15px;">
              Ga naar uw portaal
            </a>
          </div>
          <p style="color: #94a3b8; font-size: 13px; line-height: 1.5;">
            Tip: u kunt het portaal als app op uw telefoon installeren voor snelle toegang en pushnotificaties.
          </p>
        </div>
        <div style="padding: 20px; text-align: center;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">WarmeLeads &middot; Uw partner in exclusieve leads</p>
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
