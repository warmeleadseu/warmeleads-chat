import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { sendFeedbackDigest } from '@/lib/email';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerClient();

  const since = new Date();
  since.setHours(since.getHours() - 24);
  const sinceISO = since.toISOString();

  const { data: feedbacks } = await supabase
    .from('lead_feedback')
    .select('lead_id, customer_id, rating, comment, created_at')
    .gte('created_at', sinceISO)
    .order('created_at', { ascending: false });

  if (!feedbacks || feedbacks.length === 0) {
    return NextResponse.json({ ok: true, sent: false, reason: 'Geen nieuwe feedbacks' });
  }

  const leadIds = [...new Set(feedbacks.map(f => f.lead_id))];
  const customerIds = [...new Set(feedbacks.map(f => f.customer_id))];

  const [{ data: leads }, { data: customers }] = await Promise.all([
    supabase.from('leads').select('id, naam_klant, branch').in('id', leadIds),
    supabase.from('customers').select('id, name').in('id', customerIds),
  ]);

  const leadMap = new Map((leads || []).map(l => [l.id, l]));
  const customerMap = new Map((customers || []).map(c => [c.id, c]));

  const feedbackItems = feedbacks.map(f => {
    const lead = leadMap.get(f.lead_id);
    const customer = customerMap.get(f.customer_id);
    return {
      leadName: lead?.naam_klant || 'Onbekend',
      customerName: customer?.name || 'Onbekend',
      branch: lead?.branch || '',
      rating: f.rating,
      comment: f.comment,
      createdAt: f.created_at,
    };
  });

  const { data: admins } = await supabase
    .from('admin_users')
    .select('email')
    .eq('is_active', true);

  let emailsSent = 0;
  for (const admin of admins || []) {
    const ok = await sendFeedbackDigest(admin.email, feedbackItems);
    if (ok) emailsSent++;
  }

  return NextResponse.json({
    ok: true,
    sent: true,
    feedbackCount: feedbackItems.length,
    emailsSent,
  });
}
