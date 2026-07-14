import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { sendAppointmentReminderEmail } from '@/lib/appointmentEmails';
import { sendAppointmentPush } from '@/lib/pushNotification';
import { verifyCronAuth } from '@/lib/cronAuth';

/**
 * Runs hourly — sends a reminder for appointments starting 20-28 hours from now
 * (1-day reminder window). Marks reminder_sent_at to prevent duplicates.
 */
export async function GET(request: NextRequest) {
  const cronError = verifyCronAuth(request);
  if (cronError) return cronError;

  const supabase = createServerClient();

  const now = new Date();
  const windowStart = new Date(now.getTime() + 20 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 28 * 60 * 60 * 1000);

  const { data: appointments, error } = await supabase
    .from('appointments')
    .select('id, customer_id, branch, portal_user_id, starts_at, duration_minutes, contact_name, contact_phone, contact_email, street, house_number, postcode, city, notes, status, reminder_sent_at')
    .eq('status', 'scheduled')
    .is('reminder_sent_at', null)
    .gte('starts_at', windowStart.toISOString())
    .lte('starts_at', windowEnd.toISOString())
    .limit(200);

  if (error) {
    console.error('[cron/appointment-reminders]', error);
    return NextResponse.json({ error: 'Ophalen mislukt' }, { status: 500 });
  }

  if (!appointments || appointments.length === 0) {
    return NextResponse.json({ message: 'Geen reminders', count: 0 });
  }

  const customerIds = [...new Set(appointments.map(a => a.customer_id))];
  const portalUserIds = [...new Set(appointments.map(a => a.portal_user_id).filter(Boolean))] as string[];
  const branchSlugs = [...new Set(appointments.map(a => a.branch))];

  const [custRes, puRes, brRes] = await Promise.all([
    supabase.from('customers').select('id, name, email, contact_person').in('id', customerIds),
    portalUserIds.length
      ? supabase.from('portal_users').select('id, name, email').in('id', portalUserIds)
      : Promise.resolve({ data: [] }),
    supabase.from('branches').select('slug, name').in('slug', branchSlugs),
  ]);

  const custMap = new Map((custRes.data || []).map(c => [c.id, c]));
  const puMap = new Map(((puRes.data || []) as { id: string; name: string; email: string }[]).map(p => [p.id, p]));
  const brMap = new Map((brRes.data || []).map(b => [b.slug, b.name]));

  let sent = 0;
  for (const a of appointments) {
    const cust = custMap.get(a.customer_id);
    if (!cust?.email) continue;
    const branchName = brMap.get(a.branch);
    const assignee = a.portal_user_id ? puMap.get(a.portal_user_id) : null;
    try {
      await sendAppointmentReminderEmail(
        { name: cust.name, email: cust.email, contact_person: cust.contact_person },
        { ...a, branchName, portal_user_name: assignee?.name || null },
      );
      if (assignee?.email && assignee.email !== cust.email) {
        await sendAppointmentReminderEmail(
          { name: assignee.name, email: assignee.email, contact_person: assignee.name },
          { ...a, branchName, portal_user_name: assignee.name },
        );
      }
      const whenLabel = new Date(a.starts_at).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      await sendAppointmentPush(a.customer_id, 'reminder', {
        contactName: a.contact_name,
        whenLabel,
        appointmentId: a.id,
      });
      await supabase.from('appointments').update({ reminder_sent_at: new Date().toISOString() }).eq('id', a.id);
      sent++;
    } catch (e) {
      console.error('[cron/appointment-reminders] reminder failed', a.id, e);
    }
  }

  return NextResponse.json({ message: 'Reminders verstuurd', count: sent });
}
