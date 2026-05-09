import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { sendFeedbackDigest, type FeedbackItem } from '@/lib/email';

function stripAccountManagerId(
  rows: Array<FeedbackItem & { accountManagerId: string | null }>,
): FeedbackItem[] {
  return rows.map(({ accountManagerId: _am, ...rest }) => rest);
}

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
    supabase.from('customers').select('id, name, account_manager_id').in('id', customerIds),
  ]);

  const leadMap = new Map((leads || []).map(l => [l.id, l]));
  const customerMap = new Map((customers || []).map(c => [c.id, c]));

  const rowsWithAm: Array<FeedbackItem & { accountManagerId: string | null }> = feedbacks.map(f => {
    const lead = leadMap.get(f.lead_id);
    const customer = customerMap.get(f.customer_id);
    return {
      leadName: lead?.naam_klant || 'Onbekend',
      customerName: customer?.name || 'Onbekend',
      branch: lead?.branch || '',
      rating: f.rating,
      comment: f.comment,
      createdAt: f.created_at,
      accountManagerId: customer?.account_manager_id ?? null,
    };
  });

  const { data: admins } = await supabase
    .from('admin_users')
    .select('id, email, role, is_account_manager')
    .eq('is_active', true);

  let emailsSent = 0;
  for (const admin of admins || []) {
    const isAm = admin.role === 'accountmanager' || !!admin.is_account_manager;
    let digestRows: Array<FeedbackItem & { accountManagerId: string | null }>;

    if (admin.role === 'superadmin') {
      digestRows = rowsWithAm;
    } else if (isAm) {
      digestRows = rowsWithAm.filter(r => r.accountManagerId === admin.id);
    } else {
      continue;
    }

    const ok = await sendFeedbackDigest(admin.email, stripAccountManagerId(digestRows));
    if (ok) emailsSent++;
  }

  return NextResponse.json({
    ok: true,
    sent: true,
    feedbackCount: rowsWithAm.length,
    emailsSent,
  });
}
