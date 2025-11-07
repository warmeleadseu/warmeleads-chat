import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import type { AuthenticatedUser } from '@/middleware/auth';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const isValidFrequency = (value: string): value is 'maand' | 'kwartaal' => {
  return value === 'maand' || value === 'kwartaal';
};

export const POST = withAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const body = await request.json();
    const {
      customerId = user.email,
      leadGoal,
      goalFrequency,
    } = body || {};

    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID ontbreekt' }, { status: 400 });
    }

    const parsedGoal = Number(leadGoal);
    if (!Number.isFinite(parsedGoal) || parsedGoal <= 0) {
      return NextResponse.json({ error: 'leadGoal moet een positief getal zijn' }, { status: 400 });
    }

    const frequency = typeof goalFrequency === 'string' && isValidFrequency(goalFrequency)
      ? goalFrequency
      : 'maand';

    // Security: alleen eigenaar of admin mag updaten
    const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(email => email.trim()) || [];
    const isAdmin = adminEmails.includes(user.email);

    if (!isAdmin && customerId !== user.email) {
      return NextResponse.json({ error: 'Verboden' }, { status: 403 });
    }

    const supabase = createServerClient();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('customers')
      .update({
        portal_lead_goal: Math.round(parsedGoal),
        portal_goal_frequency: frequency,
        portal_goal_updated_at: now,
        last_activity: now,
      })
      .eq('email', customerId)
      .select('portal_lead_goal, portal_goal_frequency, portal_goal_updated_at')
      .single();

    if (error) {
      console.error('❌ Fout bij opslaan portal-doel:', error);
      return NextResponse.json({ error: 'Opslaan mislukt', details: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Klant niet gevonden' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      leadGoal: data.portal_lead_goal ?? parsedGoal,
      goalFrequency: data.portal_goal_frequency ?? frequency,
      goalUpdatedAt: data.portal_goal_updated_at ?? now,
    });
  } catch (error) {
    console.error('❌ Error in POST /api/customer-goal:', error);
    return NextResponse.json({
      error: 'Onverwachte fout',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
});
