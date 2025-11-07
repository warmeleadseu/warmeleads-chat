import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import type { AuthenticatedUser } from '@/middleware/auth';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const isAdmin = (email: string): boolean => {
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
  return adminEmails.includes(email);
};

export const POST = withAuth(async (req: NextRequest, user: AuthenticatedUser) => {
  try {
    const body = await req.json();
    const { orderNumber, rating, notes } = body as {
      orderNumber?: string;
      rating?: number;
      notes?: string;
    };

    if (!orderNumber) {
      return NextResponse.json({ error: 'orderNumber is verplicht' }, { status: 400 });
    }

    if (typeof rating !== 'number' || Number.isNaN(rating)) {
      return NextResponse.json({ error: 'rating is verplicht' }, { status: 400 });
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'rating moet tussen 1 en 5 liggen' }, { status: 400 });
    }

    const supabase = createServerClient();

    const { data: existingOrder, error: fetchError } = await supabase
      .from('orders')
      .select('customer_email, feedback_rating, feedback_notes, feedback_submitted_at')
      .eq('order_number', orderNumber)
      .single();

    if (fetchError || !existingOrder) {
      return NextResponse.json({ error: 'Bestelling niet gevonden' }, { status: 404 });
    }

    if (existingOrder.customer_email !== user.email && !isAdmin(user.email)) {
      return NextResponse.json({ error: 'Geen toegang om deze bestelling te wijzigen' }, { status: 403 });
    }

    const now = new Date().toISOString();

    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({
        feedback_rating: Math.round(rating),
        feedback_notes: notes?.trim() || null,
        feedback_submitted_at: now,
      })
      .eq('order_number', orderNumber)
      .select('*')
      .single();

    if (updateError) {
      console.error('❌ Fout bij opslaan orderfeedback:', updateError);
      return NextResponse.json({ error: 'Opslaan mislukt', details: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      order: {
        orderNumber,
        feedbackRating: updatedOrder.feedback_rating,
        feedbackNotes: updatedOrder.feedback_notes,
        feedbackSubmittedAt: updatedOrder.feedback_submitted_at,
      }
    });
  } catch (error) {
    console.error('❌ Error in POST /api/orders/feedback:', error);
    return NextResponse.json({
      error: 'Onverwachte fout',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
});
