import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';

/*
  booking_schedule is stored in app_settings (key = 'booking_schedule').
  Blocked dates are stored in booking_blocked table.

  CREATE TABLE IF NOT EXISTS booking_blocked (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    date date NOT NULL,
    time text,
    reason text,
    created_at timestamptz DEFAULT now()
  );
*/

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

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const supabase = createServerClient();

  const { data: setting } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'booking_schedule')
    .single();

  const schedule = setting?.value ? (typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value) : DEFAULT_SCHEDULE;

  const { data: blocked } = await supabase
    .from('booking_blocked')
    .select('*')
    .order('date', { ascending: true });

  return NextResponse.json({ schedule, blocked: blocked || [] });
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const body = await request.json();
  const supabase = createServerClient();

  if (body.type === 'schedule') {
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'booking_schedule', value: body.value, updated_at: new Date().toISOString() }, { onConflict: 'key' });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (body.type === 'block') {
    const { date, time, reason } = body;
    if (!date) return NextResponse.json({ error: 'Date required' }, { status: 400 });

    const { error } = await supabase
      .from('booking_blocked')
      .insert({ date, time: time || null, reason: reason || null });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
}

export async function DELETE(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const supabase = createServerClient();
  const { error } = await supabase.from('booking_blocked').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
