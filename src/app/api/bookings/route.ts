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

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://warmeleads.eu';
    const logoUrl = `${siteUrl}/warmeleads-logo-2026.png`;
    const year = new Date().getFullYear();

    const confirmHtml = `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Afspraak bevestigd</title></head>
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
                <tr><td style="background-color:#ecfdf5;border:1px solid #d1fae5;border-radius:20px;padding:6px 14px">
                  <span style="color:#059669;font-size:12px;font-weight:700;letter-spacing:0.5px">&#10003; BEVESTIGD</span>
                </td></tr>
              </table>
              <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#0f172a;line-height:1.3">Afspraak bevestigd</h1>
              <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.7">Je strategiegesprek met WarmeLeads is gepland.</p>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:28px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
                <tr><td style="background-color:#f8fafc;padding:14px 20px;border-bottom:1px solid #e2e8f0">
                  <span style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px">Afspraakgegevens</span>
                </td></tr>
                <tr><td style="padding:0">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr><td style="padding:14px 20px;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9;width:120px">Datum</td><td style="padding:14px 20px;font-size:14px;color:#0f172a;font-weight:600;border-bottom:1px solid #f1f5f9">${fmtDate}</td></tr>
                    <tr><td style="padding:14px 20px;font-size:14px;color:#64748b">Tijd</td><td style="padding:14px 20px;font-size:14px;color:#0f172a;font-weight:600">${time} uur</td></tr>
                  </table>
                </td></tr>
              </table>
              <p style="margin:0 0 8px;font-size:14px;color:#64748b;line-height:1.7">We nemen op het afgesproken moment contact met je op. Heb je in de tussentijd vragen? Neem gerust contact op via <a href="mailto:info@warmeleads.eu" style="color:#3B2F75;text-decoration:none;font-weight:600">info@warmeleads.eu</a> of bel <a href="tel:0850477067" style="color:#3B2F75;text-decoration:none;font-weight:600">085 047 7067</a>.</p>
              <p style="margin:24px 0 0;font-size:13px;color:#94a3b8">Met vriendelijke groet,<br>Het WarmeLeads team</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="background-color:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px 40px">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr><td style="border-top:1px solid #e2e8f0;padding-top:20px">
              <p style="margin:0;font-size:12px;color:#cbd5e1;line-height:1.5">&copy; ${year} WarmeLeads &middot; <a href="${siteUrl}" style="color:#cbd5e1;text-decoration:none">warmeleads.eu</a></p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const notifyHtml = `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nieuw strategiegesprek</title></head>
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
                <tr><td style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:20px;padding:6px 14px">
                  <span style="color:#2563eb;font-size:12px;font-weight:700;letter-spacing:0.5px">NIEUW GESPREK</span>
                </td></tr>
              </table>
              <h1 style="margin:0 0 24px;font-size:20px;font-weight:700;color:#0f172a;line-height:1.3">Nieuw strategiegesprek ingepland</h1>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:20px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
                <tr><td style="background-color:#f8fafc;padding:14px 20px;border-bottom:1px solid #e2e8f0">
                  <span style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px">Contactgegevens</span>
                </td></tr>
                <tr><td style="padding:0">
                  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr><td style="padding:12px 20px;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9;width:120px">Datum</td><td style="padding:12px 20px;font-size:14px;color:#0f172a;font-weight:600;border-bottom:1px solid #f1f5f9">${fmtDate}</td></tr>
                    <tr><td style="padding:12px 20px;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9">Tijd</td><td style="padding:12px 20px;font-size:14px;color:#0f172a;font-weight:600;border-bottom:1px solid #f1f5f9">${time} uur</td></tr>
                    <tr><td style="padding:12px 20px;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9">Naam</td><td style="padding:12px 20px;font-size:14px;color:#0f172a;font-weight:600;border-bottom:1px solid #f1f5f9">${name}</td></tr>
                    ${company ? `<tr><td style="padding:12px 20px;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9">Bedrijf</td><td style="padding:12px 20px;font-size:14px;color:#0f172a;font-weight:600;border-bottom:1px solid #f1f5f9">${company}</td></tr>` : ''}
                    <tr><td style="padding:12px 20px;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9">E-mail</td><td style="padding:12px 20px;font-size:14px;border-bottom:1px solid #f1f5f9"><a href="mailto:${email}" style="color:#3B2F75;text-decoration:none;font-weight:600">${email}</a></td></tr>
                    <tr><td style="padding:12px 20px;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9">Telefoon</td><td style="padding:12px 20px;font-size:14px;border-bottom:1px solid #f1f5f9"><a href="tel:${phone}" style="color:#3B2F75;text-decoration:none;font-weight:600">${phone}</a></td></tr>
                    ${branch ? `<tr><td style="padding:12px 20px;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9">Branche</td><td style="padding:12px 20px;font-size:14px;color:#0f172a;border-bottom:1px solid #f1f5f9">${branch}</td></tr>` : ''}
                    ${message ? `<tr><td style="padding:12px 20px;font-size:14px;color:#64748b">Toelichting</td><td style="padding:12px 20px;font-size:14px;color:#475569">${message}</td></tr>` : ''}
                  </table>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="background-color:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px 40px">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr><td style="border-top:1px solid #e2e8f0;padding-top:20px">
              <p style="margin:0;font-size:12px;color:#cbd5e1;line-height:1.5">&copy; ${year} WarmeLeads &middot; <a href="${siteUrl}" style="color:#cbd5e1;text-decoration:none">warmeleads.eu</a></p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await sendEmail(email, `Bevestiging strategiegesprek - ${fmtDate} om ${time}`, confirmHtml, { type: 'booking_confirmation', toName: name, metadata: { date: fmtDate, time } });
    await sendEmail('info@warmeleads.eu', `Nieuw strategiegesprek: ${name} - ${fmtDate} om ${time}`, notifyHtml, { type: 'booking_admin', metadata: { name, date: fmtDate, time } });

    return NextResponse.json({ success: true, booking: data });
  } catch (err: unknown) {
    console.error('Booking error:', err);
    return NextResponse.json({ error: 'Er is iets misgegaan. Probeer het opnieuw.' }, { status: 500 });
  }
}
