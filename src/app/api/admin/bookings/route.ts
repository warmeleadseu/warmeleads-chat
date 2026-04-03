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

    const html = `
<div style="font-family:-apple-system,system-ui,sans-serif;max-width:600px;margin:0 auto">
  <div style="background:linear-gradient(to bottom right,#1A1A2E,#3B2F75,#E74C8C);padding:32px;border-radius:12px 12px 0 0">
    <h1 style="color:#fff;font-size:24px;margin:0">Afspraak geannuleerd</h1>
  </div>
  <div style="background:#fff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
    <p style="font-size:14px;color:#475569;line-height:1.6">
      Helaas is je strategiegesprek op <strong>${fmtDate}</strong> om <strong>${booking.time} uur</strong> geannuleerd.
    </p>
    <p style="font-size:14px;color:#475569;line-height:1.6;margin-top:16px">
      Wil je een nieuw moment inplannen? Dat kan eenvoudig via
      <a href="https://www.warmeleads.eu/plan-gesprek" style="color:#3B2F75;font-weight:600">onze agenda</a>.
    </p>
    <p style="margin-top:24px;font-size:13px;color:#94a3b8">Met vriendelijke groet,<br>Het WarmeLeads team</p>
  </div>
</div>`;

    await sendEmail(booking.email, `Afspraak geannuleerd - ${fmtDate}`, html);
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
