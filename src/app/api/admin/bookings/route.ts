import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { sendEmail } from '@/lib/email';

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();
  const sp = request.nextUrl.searchParams;
  const status = sp.get('status');
  const dateFrom = sp.get('date_from');
  const dateTo = sp.get('date_to');
  const search = sp.get('search');

  let q = supabase
    .from('bookings')
    .select('*')
    .order('date', { ascending: true })
    .order('time', { ascending: true });

  if (status && status !== 'all') q = q.eq('status', status);
  if (dateFrom) q = q.gte('date', dateFrom);
  if (dateTo) q = q.lte('date', dateTo);
  if (search) {
    q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ bookings: data || [] });
}

export async function PATCH(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const { id, status } = await request.json();
  if (!id || !status) return NextResponse.json({ error: 'Missing id or status' }, { status: 400 });

  const supabase = createServerClient();

  const { data: booking } = await supabase.from('bookings').select('*').eq('id', id).single();
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

  const { error } = await supabase.from('bookings').update({ status }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (status === 'geannuleerd' && booking.status !== 'geannuleerd') {
    const dateObj = new Date(booking.date + 'T00:00:00');
    const fmtDate = dateObj.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.warmeleads.eu';
    const logoUrl = `${siteUrl}/warmeleads-logo-2026.png`;
    const year = new Date().getFullYear();

    const html = `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Afspraak geannuleerd</title></head>
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
                <tr><td style="background-color:#fef2f2;border:1px solid #fecaca;border-radius:20px;padding:6px 14px">
                  <span style="color:#dc2626;font-size:12px;font-weight:700;letter-spacing:0.5px">GEANNULEERD</span>
                </td></tr>
              </table>
              <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#0f172a;line-height:1.3">Afspraak geannuleerd</h1>
              <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.7">Helaas is je strategiegesprek op <strong style="color:#0f172a">${fmtDate}</strong> om <strong style="color:#0f172a">${booking.time} uur</strong> geannuleerd.</p>
              <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.7">Wil je een nieuw moment inplannen? Dat kan eenvoudig via onze agenda:</p>
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px">
                <tr><td style="border-radius:10px;background:linear-gradient(135deg,#FF6B35,#FF4757)">
                  <a href="${siteUrl}/plan-gesprek" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.3px">Nieuw gesprek inplannen &rarr;</a>
                </td></tr>
              </table>
              <p style="margin:0;font-size:13px;color:#94a3b8">Met vriendelijke groet,<br>Het WarmeLeads team</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="background-color:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px 40px">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr><td style="border-top:1px solid #e2e8f0;padding-top:20px">
              <p style="margin:0 0 6px;font-size:13px;color:#94a3b8;line-height:1.5">Vragen? Neem contact op via <a href="mailto:info@warmeleads.eu" style="color:#3B2F75;text-decoration:none;font-weight:600">info@warmeleads.eu</a> of bel <a href="tel:0850477067" style="color:#3B2F75;text-decoration:none;font-weight:600">085 047 7067</a>.</p>
              <p style="margin:0;font-size:12px;color:#cbd5e1;line-height:1.5">&copy; ${year} WarmeLeads &middot; <a href="${siteUrl}" style="color:#cbd5e1;text-decoration:none">warmeleads.eu</a></p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await sendEmail(booking.email, `Afspraak geannuleerd - ${fmtDate}`, html, { type: 'booking_cancelled', toName: booking.name, metadata: { date: fmtDate } });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const supabase = createServerClient();
  const { error } = await supabase.from('bookings').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
