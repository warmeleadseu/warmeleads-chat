import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { sendEmail } from '@/lib/email';

/*
  Tables required:

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

  CREATE TABLE IF NOT EXISTS booking_blocked (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    date date NOT NULL,
    time text,
    reason text,
    created_at timestamptz DEFAULT now()
  );
*/

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

const DEFAULT_SCHEDULE = {
  days: {
    monday:    { enabled: true,  start: '09:00', end: '17:00' },
    tuesday:   { enabled: true,  start: '09:00', end: '17:00' },
    wednesday: { enabled: true,  start: '09:00', end: '17:00' },
    thursday:  { enabled: true,  start: '09:00', end: '17:00' },
    friday:    { enabled: true,  start: '09:00', end: '17:00' },
    saturday:  { enabled: false, start: '09:00', end: '17:00' },
    sunday:    { enabled: false, start: '09:00', end: '17:00' },
  },
  lunch: { enabled: true, start: '12:30', end: '13:00' },
  slotDuration: 30,
};

function generateSlots(start: string, end: string, duration: number, lunch?: { enabled: boolean; start: string; end: string }): string[] {
  const slots: string[] = [];
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;

  let lunchStart = 0, lunchEnd = 0;
  if (lunch?.enabled) {
    const [lsh, lsm] = lunch.start.split(':').map(Number);
    const [leh, lem] = lunch.end.split(':').map(Number);
    lunchStart = lsh * 60 + lsm;
    lunchEnd = leh * 60 + lem;
  }

  for (let m = startMin; m + duration <= endMin; m += duration) {
    if (lunch?.enabled && m >= lunchStart && m < lunchEnd) continue;
    const h = Math.floor(m / 60);
    const min = m % 60;
    slots.push(`${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`);
  }
  return slots;
}

function parseSchedule(raw: unknown): typeof DEFAULT_SCHEDULE {
  try {
    if (!raw) return DEFAULT_SCHEDULE;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (parsed?.days && typeof parsed.days === 'object') return parsed;
  } catch { /* fall through */ }
  return DEFAULT_SCHEDULE;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const supabase = createServerClient();

    let schedule = DEFAULT_SCHEDULE;
    try {
      const { data: setting } = await supabase.from('app_settings').select('value').eq('key', 'booking_schedule').single();
      schedule = parseSchedule(setting?.value);
    } catch { /* use default */ }

    if (searchParams.get('info') === 'true') {
      const enabledDays = Object.entries(schedule.days || {})
        .filter(([, v]) => (v as { enabled: boolean }).enabled)
        .map(([k]) => k);
      return NextResponse.json({ enabledDays });
    }

    const date = searchParams.get('date');
    if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 });

    const d = new Date(date + 'T00:00:00');
    if (isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid date' }, { status: 400 });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (d < today) return NextResponse.json({ slots: [] });

    const dayKey = DAY_KEYS[d.getDay()];
    const dayConfig = schedule.days?.[dayKey];
    if (!dayConfig?.enabled) return NextResponse.json({ slots: [] });

    const allSlots = generateSlots(
      dayConfig.start || '09:00',
      dayConfig.end || '17:00',
      schedule.slotDuration || 30,
      schedule.lunch,
    );

    let bookedTimes = new Set<string>();
    let blockedTimes = new Set<string>();
    let blockedAll = false;

    try {
      const { data } = await supabase.from('bookings').select('time').eq('date', date).neq('status', 'geannuleerd');
      if (data) bookedTimes = new Set(data.map((b: { time: string }) => b.time));
    } catch { /* table may not exist yet */ }

    try {
      const { data } = await supabase.from('booking_blocked').select('time').eq('date', date);
      if (data) {
        blockedAll = data.some((b: { time: string | null }) => !b.time);
        blockedTimes = new Set(data.filter((b: { time: string | null }) => b.time).map((b: { time: string | null }) => b.time!));
      }
    } catch { /* table may not exist yet */ }

    if (blockedAll) return NextResponse.json({ slots: [] });

    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();

    const available = allSlots.filter(slot => {
      if (bookedTimes.has(slot)) return false;
      if (blockedTimes.has(slot)) return false;
      if (isToday) {
        const [h, m] = slot.split(':').map(Number);
        const slotTime = new Date(now);
        slotTime.setHours(h, m, 0, 0);
        if (slotTime.getTime() - now.getTime() < 2 * 60 * 60 * 1000) return false;
      }
      return true;
    });

    return NextResponse.json({ slots: available });
  } catch (err) {
    console.error('Booking GET error:', err);
    return NextResponse.json({ slots: [], error: 'Er is iets misgegaan' }, { status: 500 });
  }
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

    await sendEmail(email, `Bevestiging strategiegesprek - ${fmtDate} om ${time}`, confirmHtml, { type: 'booking_confirmation', toName: name, metadata: { date: fmtDate, time } });
    await sendEmail('info@warmeleads.eu', `Nieuw strategiegesprek: ${name} - ${fmtDate} om ${time}`, notifyHtml, { type: 'booking_admin', metadata: { name, date: fmtDate, time } });

    return NextResponse.json({ success: true, booking: data });
  } catch (err: unknown) {
    console.error('Booking error:', err);
    return NextResponse.json({ error: 'Er is iets misgegaan. Probeer het opnieuw.' }, { status: 500 });
  }
}
