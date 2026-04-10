import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin, unauthorized } from '@/lib/adminAuth';
import { createServerClient } from '@/lib/supabase';
import { sendEmail } from '@/lib/email';

function forbidden() {
  return NextResponse.json({ error: 'Alleen superadmin heeft toegang' }, { status: 403 });
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  if (admin.role !== 'superadmin') return forbidden();

  const url = request.nextUrl.searchParams;
  const page = parseInt(url.get('page') || '1');
  const perPage = Math.min(parseInt(url.get('per_page') || '25'), 100);
  const type = url.get('type');
  const status = url.get('status');
  const search = url.get('search');
  const dateFrom = url.get('date_from');
  const dateTo = url.get('date_to');

  const supabase = createServerClient();

  let query = supabase
    .from('email_log')
    .select('id, type, to_email, to_name, subject, status, error, metadata, created_at', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (type) query = query.eq('type', type);
  if (status) query = query.eq('status', status);
  if (search) query = query.or(`to_email.ilike.%${search}%,subject.ilike.%${search}%,to_name.ilike.%${search}%`);
  if (dateFrom) query = query.gte('created_at', dateFrom);
  if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59.999Z');

  const from = (page - 1) * perPage;
  query = query.range(from, from + perPage - 1);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ emails: data || [], total: count || 0, page, perPage });
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) return unauthorized();
  if (admin.role !== 'superadmin') return forbidden();

  const { email_log_id, to_email } = await request.json();
  if (!email_log_id || !to_email) {
    return NextResponse.json({ error: 'email_log_id en to_email zijn verplicht' }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to_email)) {
    return NextResponse.json({ error: 'Ongeldig e-mailadres' }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data: original, error } = await supabase
    .from('email_log')
    .select('subject, html')
    .eq('id', email_log_id)
    .single();

  if (error || !original) {
    return NextResponse.json({ error: 'E-mail niet gevonden' }, { status: 404 });
  }

  const testSubject = `[TEST] ${original.subject}`;
  const sent = await sendEmail(to_email, testSubject, original.html, {
    type: 'test_resend',
    metadata: { original_id: email_log_id, sent_by: admin.id },
  });

  if (!sent) {
    return NextResponse.json({ error: 'Verzenden mislukt' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
