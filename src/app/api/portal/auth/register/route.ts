import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { sendEmail } from '@/lib/email';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const { limited, response } = rateLimit(ip, 'portal-register', MAX_ATTEMPTS, WINDOW_MS);
    if (limited) return response!;

    const body = await request.json();
    const { name, contact_person, email, phone, password, branches, kvk_nummer, targets, street, house_number, postcode, city } = body;

    if (!name || !contact_person || !email || !phone || !password) {
      return NextResponse.json({ error: 'Alle verplichte velden moeten ingevuld zijn' }, { status: 400 });
    }

    const emailLower = email.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
      return NextResponse.json({ error: 'Ongeldig e-mailadres' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Wachtwoord moet minimaal 8 tekens bevatten' }, { status: 400 });
    }

    if (!Array.isArray(branches) || branches.length === 0) {
      return NextResponse.json({ error: 'Selecteer minimaal één branche' }, { status: 400 });
    }

    const supabase = createServerClient();

    const { data: existing } = await supabase
      .from('customers')
      .select('id')
      .eq('email', emailLower)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Dit e-mailadres is al in gebruik' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const welcomeExpiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const { data: customer, error: insertErr } = await supabase
      .from('customers')
      .insert({
        name,
        contact_person,
        email: emailLower,
        phone,
        password_hash: passwordHash,
        branches,
        kvk_nummer: kvk_nummer || null,
        street: street || null,
        house_number: house_number || null,
        postcode: postcode || null,
        city: city || null,
        is_active: true,
        portal_active: true,
        signup_source: 'website',
        welcome_offer_used: false,
        welcome_offer_expires_at: welcomeExpiry,
        demo_mode: true,
      })
      .select('id, name, email, contact_person, branches, demo_mode')
      .single();

    if (insertErr || !customer) {
      console.error('[register] insert error:', insertErr);
      return NextResponse.json({ error: 'Account aanmaken mislukt. Probeer het opnieuw.' }, { status: 500 });
    }

    if (Array.isArray(targets) && targets.length > 0) {
      const targetRows = targets.map((t: { type: string; provinces?: string[]; label?: string; lat?: number; lng?: number; radius_km?: number }) => {
        if (t.type === 'province') {
          return {
            customer_id: customer.id,
            label: (t.provinces || []).join(', '),
            target_type: 'province',
            provinces: t.provinces || [],
            lat: null,
            lng: null,
            radius_km: 0,
          };
        }
        return {
          customer_id: customer.id,
          label: t.label || 'Mijn regio',
          target_type: 'radius',
          lat: t.lat,
          lng: t.lng,
          radius_km: t.radius_km || 25,
        };
      });
      await supabase.from('customer_targets').insert(targetRows);
    }

    seedDemoLeads(supabase, customer.id, branches).catch((e) =>
      console.error('[register] demo seed error:', e)
    );

    sendWelcomeEmail(customer.email, customer.contact_person || customer.name, welcomeExpiry).catch(() => {});
    notifyAdmins(supabase, customer).catch(() => {});

    return NextResponse.json({
      success: true,
      token: customer.id,
      customer,
    });
  } catch (err) {
    console.error('[register] unexpected error:', err);
    return NextResponse.json({ error: 'Er ging iets mis bij het aanmaken van je account' }, { status: 500 });
  }
}

async function sendWelcomeEmail(email: string, name: string, expiresAt: string) {
  const expireDate = new Date(expiresAt).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.warmeleads.eu';
  const logoUrl = `${baseUrl}/warmeleads-logo-2026.png`;

  const html = `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Welkom bij WarmeLeads</title></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc">
    <tr><td align="center" style="padding:40px 16px">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
        <tr><td style="height:4px;background:linear-gradient(135deg,#3B2F75 0%,#E74C8C 35%,#FF6B35 70%,#FF4757 100%);border-radius:12px 12px 0 0;font-size:0;line-height:0">&nbsp;</td></tr>
        <tr><td style="background-color:#ffffff;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;padding:32px 40px 0">
          <img src="${logoUrl}" alt="WarmeLeads" width="130" style="max-width:130px;height:auto;display:block" />
        </td></tr>
        <tr><td style="background-color:#ffffff;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;padding:32px 40px">
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0f172a">Welkom bij WarmeLeads, ${name}!</h1>
          <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.7">Je account is succesvol aangemaakt. Je kunt nu inloggen op je persoonlijke klantportaal en je leads beheren.</p>
          <div style="margin:24px 0;padding:20px;background:linear-gradient(135deg,#faf5ff,#fff7ed);border:2px solid #e9d5ff;border-radius:12px">
            <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#3B2F75">🎉 20% welkomstkorting!</p>
            <p style="margin:0 0 4px;font-size:14px;color:#475569">Op je eerste bestelling, automatisch toegepast.</p>
            <p style="margin:0;font-size:13px;color:#94a3b8">Geldig tot ${expireDate}</p>
          </div>
          <table cellpadding="0" cellspacing="0" style="margin:28px 0 8px">
            <tr><td style="border-radius:10px;background:linear-gradient(135deg,#FF6B35,#FF4757)">
              <a href="${baseUrl}/portal" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.3px">Ga naar mijn portaal →</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="background-color:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px 40px">
          <p style="margin:0 0 6px;font-size:13px;color:#94a3b8">Vragen? Neem contact op via <a href="mailto:info@warmeleads.eu" style="color:#3B2F75;text-decoration:none;font-weight:600">info@warmeleads.eu</a> of bel <a href="tel:0850477067" style="color:#3B2F75;text-decoration:none;font-weight:600">085 047 7067</a>.</p>
          <p style="margin:0;font-size:12px;color:#cbd5e1">&copy; ${new Date().getFullYear()} WarmeLeads</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await sendEmail(email, 'Welkom bij WarmeLeads – jouw account is aangemaakt!', html, {
    type: 'welcome_signup',
    toName: name,
  });
}

const DEMO_STATUS_DISTRIBUTION: { status: string; notities: string | null }[] = [
  { status: 'nieuw', notities: null },
  { status: 'nieuw', notities: null },
  { status: 'gecontacteerd', notities: 'Terugbellen na 17:00' },
  { status: 'offerte', notities: 'Interesse in 10kWh systeem' },
];

async function seedDemoLeads(
  supabase: ReturnType<typeof createServerClient>,
  customerId: string,
  branches: string[]
) {
  const { data: demoLeads } = await supabase
    .from('leads')
    .select('id, branch')
    .eq('bron', 'demo')
    .is('customer_id', null)
    .in('branch', branches);

  if (!demoLeads || demoLeads.length === 0) return;

  const assignments = demoLeads.map((lead, i) => {
    const preset = DEMO_STATUS_DISTRIBUTION[i % DEMO_STATUS_DISTRIBUTION.length];
    return {
      lead_id: lead.id,
      customer_id: customerId,
      batch_id: null,
      distance_km: Math.round((3 + Math.random() * 25) * 10) / 10,
      source: 'demo',
      status: preset.status,
      notities: preset.notities,
    };
  });

  await supabase.from('lead_assignments').insert(assignments);
}

async function notifyAdmins(supabase: ReturnType<typeof createServerClient>, customer: { id: string; name: string; email: string; contact_person: string }) {
  const { data: admins } = await supabase
    .from('admin_users')
    .select('email, display_name')
    .eq('is_active', true);

  if (!admins || admins.length === 0) return;

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.warmeleads.eu';
  const logoUrl = `${baseUrl}/warmeleads-logo-2026.png`;

  const html = `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nieuwe klant aangemeld</title></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc">
    <tr><td align="center" style="padding:40px 16px">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
        <tr><td style="height:4px;background:linear-gradient(135deg,#3B2F75 0%,#E74C8C 35%,#FF6B35 70%,#FF4757 100%);border-radius:12px 12px 0 0;font-size:0;line-height:0">&nbsp;</td></tr>
        <tr><td style="background-color:#ffffff;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;padding:32px 40px 0">
          <img src="${logoUrl}" alt="WarmeLeads" width="130" style="max-width:130px;height:auto;display:block" />
        </td></tr>
        <tr><td style="background-color:#ffffff;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;padding:32px 40px">
          <p style="margin:0 0 16px"><span style="display:inline-block;background:#ecfdf5;border:1px solid #d1fae5;color:#059669;padding:5px 14px;border-radius:20px;font-size:12px;font-weight:700">NIEUWE SELF-SERVICE KLANT</span></p>
          <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0f172a">Nieuwe klant via website</h1>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
            <tr><td style="padding:12px 20px;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9;width:140px">Bedrijfsnaam</td><td style="padding:12px 20px;font-size:14px;color:#0f172a;border-bottom:1px solid #f1f5f9;font-weight:600">${customer.name}</td></tr>
            <tr><td style="padding:12px 20px;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9">Contactpersoon</td><td style="padding:12px 20px;font-size:14px;color:#0f172a;border-bottom:1px solid #f1f5f9">${customer.contact_person}</td></tr>
            <tr><td style="padding:12px 20px;font-size:14px;color:#64748b">E-mail</td><td style="padding:12px 20px;font-size:14px;color:#0f172a"><a href="mailto:${customer.email}" style="color:#3B2F75;text-decoration:none">${customer.email}</a></td></tr>
          </table>
          <table cellpadding="0" cellspacing="0" style="margin:20px 0">
            <tr><td style="border-radius:10px;background:linear-gradient(135deg,#FF6B35,#FF4757)">
              <a href="${baseUrl}/admin/customers" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none">Bekijk in admin →</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="background-color:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px 40px">
          <p style="margin:0;font-size:12px;color:#cbd5e1">&copy; ${new Date().getFullYear()} WarmeLeads</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  for (const admin of admins) {
    sendEmail(admin.email, `Nieuwe klant aangemeld: ${customer.name}`, html, {
      type: 'new_signup_admin',
      toName: admin.display_name,
      metadata: { customer_id: customer.id },
    }).catch(() => {});
  }
}
