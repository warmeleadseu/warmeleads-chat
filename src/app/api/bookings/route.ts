import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { sendEmail } from '@/lib/email';

/*
  Supabase table required:

  CREATE TABLE IF NOT EXISTS bookings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    date date NOT NULL,
    time text NOT NULL,
    name text NOT NULL,
    company text,
    email text NOT NULL,
    phone text NOT NULL,
    branch text,
    message text,
    status text DEFAULT 'bevestigd',
    created_at timestamptz DEFAULT now()
  );
*/

const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '13:00', '13:30', '14:00', '14:30', '15:00',
  '15:30', '16:00', '16:30',
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');

  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 });

  const d = new Date(date + 'T00:00:00');
  if (isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid date' }, { status: 400 });

  const day = d.getDay();
  if (day === 0 || day === 6) return NextResponse.json({ slots: [] });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (d < today) return NextResponse.json({ slots: [] });

  const supabase = createServerClient();

  const { data: bookings } = await supabase
    .from('bookings')
    .select('time')
    .eq('date', date)
    .neq('status', 'geannuleerd');

  const bookedTimes = new Set((bookings || []).map((b: { time: string }) => b.time));

  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();

  const available = TIME_SLOTS.filter(slot => {
    if (bookedTimes.has(slot)) return false;
    if (isToday) {
      const [h, m] = slot.split(':').map(Number);
      const slotTime = new Date(now);
      slotTime.setHours(h, m, 0, 0);
      if (slotTime.getTime() - now.getTime() < 2 * 60 * 60 * 1000) return false;
    }
    return true;
  });

  return NextResponse.json({ slots: available });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { date, time, name, company, email, phone, branch, message } = body;

    if (!date || !time || !name || !email || !phone) {
      return NextResponse.json({ error: 'Vul alle verplichte velden in.' }, { status: 400 });
    }

    const supabase = createServerClient();

    const { data: existing } = await supabase
      .from('bookings')
      .select('id')
      .eq('date', date)
      .eq('time', time)
      .neq('status', 'geannuleerd')
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'Dit tijdslot is helaas net geboekt. Kies een ander moment.' }, { status: 409 });
    }

    const { data, error } = await supabase
      .from('bookings')
      .insert({ date, time, name, company: company || null, email, phone, branch: branch || null, message: message || null, status: 'bevestigd' })
      .select()
      .single();

    if (error) throw error;

    const dateObj = new Date(date + 'T00:00:00');
    const fmtDate = dateObj.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const confirmHtml = `
<div style="font-family:-apple-system,system-ui,sans-serif;max-width:600px;margin:0 auto">
  <div style="background:linear-gradient(to bottom right,#1A1A2E,#3B2F75,#E74C8C);padding:32px;border-radius:12px 12px 0 0">
    <h1 style="color:#fff;font-size:24px;margin:0">Afspraak bevestigd</h1>
    <p style="color:rgba(255,255,255,.7);margin:8px 0 0;font-size:14px">Je strategiegesprek met WarmeLeads is gepland.</p>
  </div>
  <div style="background:#fff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
    <div style="background:#f8f9fa;border-radius:8px;padding:20px;margin-bottom:24px">
      <p style="margin:0 0 4px;font-size:13px;color:#64748b">Datum</p>
      <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#1e293b">${fmtDate}</p>
      <p style="margin:0 0 4px;font-size:13px;color:#64748b">Tijd</p>
      <p style="margin:0;font-size:16px;font-weight:600;color:#1e293b">${time} uur</p>
    </div>
    <p style="font-size:14px;color:#475569;line-height:1.6">
      We nemen op het afgesproken moment contact met je op. Heb je in de tussentijd vragen?
      Neem gerust contact op via <a href="mailto:info@warmeleads.eu" style="color:#3B2F75">info@warmeleads.eu</a>
      of bel <a href="tel:0850477067" style="color:#3B2F75">085 047 7067</a>.
    </p>
    <p style="margin-top:24px;font-size:13px;color:#94a3b8">Met vriendelijke groet,<br>Het WarmeLeads team</p>
  </div>
</div>`;

    const notifyHtml = `
<div style="font-family:-apple-system,system-ui,sans-serif;max-width:600px;margin:0 auto">
  <div style="background:linear-gradient(to bottom right,#1A1A2E,#3B2F75,#E74C8C);padding:32px;border-radius:12px 12px 0 0">
    <h1 style="color:#fff;font-size:24px;margin:0">Nieuw strategiegesprek ingepland</h1>
  </div>
  <div style="background:#fff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:8px 0;color:#64748b;font-size:13px;width:100px">Datum</td><td style="padding:8px 0;font-weight:600;color:#1e293b">${fmtDate}</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;font-size:13px">Tijd</td><td style="padding:8px 0;font-weight:600;color:#1e293b">${time} uur</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;font-size:13px">Naam</td><td style="padding:8px 0;font-weight:600;color:#1e293b">${name}</td></tr>
      ${company ? `<tr><td style="padding:8px 0;color:#64748b;font-size:13px">Bedrijf</td><td style="padding:8px 0;font-weight:600;color:#1e293b">${company}</td></tr>` : ''}
      <tr><td style="padding:8px 0;color:#64748b;font-size:13px">E-mail</td><td style="padding:8px 0;font-weight:600;color:#1e293b"><a href="mailto:${email}">${email}</a></td></tr>
      <tr><td style="padding:8px 0;color:#64748b;font-size:13px">Telefoon</td><td style="padding:8px 0;font-weight:600;color:#1e293b"><a href="tel:${phone}">${phone}</a></td></tr>
      ${branch ? `<tr><td style="padding:8px 0;color:#64748b;font-size:13px">Branche</td><td style="padding:8px 0;font-weight:600;color:#1e293b">${branch}</td></tr>` : ''}
      ${message ? `<tr><td style="padding:8px 0;color:#64748b;font-size:13px">Toelichting</td><td style="padding:8px 0;color:#1e293b">${message}</td></tr>` : ''}
    </table>
  </div>
</div>`;

    await sendEmail(email, `Bevestiging strategiegesprek - ${fmtDate} om ${time}`, confirmHtml);
    await sendEmail('info@warmeleads.eu', `Nieuw strategiegesprek: ${name} - ${fmtDate} om ${time}`, notifyHtml);

    return NextResponse.json({ success: true, booking: data });
  } catch (err: unknown) {
    console.error('Booking error:', err);
    return NextResponse.json({ error: 'Er is iets misgegaan. Probeer het opnieuw.' }, { status: 500 });
  }
}
