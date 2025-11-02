import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/middleware/auth';

// Helper to check if user is admin
function isAdmin(email: string): boolean {
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
  return adminEmails.includes(email);
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json();
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required' },
        { status: 400 }
      );
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: 'Stripe not configured' },
        { status: 500 }
      );
    }

    // Retrieve the checkout session from Stripe
    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to retrieve checkout session:', errorText);
      return NextResponse.json(
        { error: 'Payment verification failed' },
        { status: 500 }
      );
    }

    const session = await response.json();
    
    // Security check: For authenticated users, verify they own this payment
    const user = await verifyAuthToken(req);
    const customerEmail = session.customer_details?.email || session.customer_email;
    const isGuestCheckout = session.metadata?.isGuest === 'true';
    
    if (user && customerEmail && customerEmail !== user.email && !isAdmin(user.email)) {
      return NextResponse.json(
        { error: 'Forbidden - You can only verify your own payments' },
        { status: 403 }
      );
    }
    
    // Check if payment was successful
    if (session.payment_status === 'paid') {
      console.log('✅ Payment verified:', {
        sessionId,
        paymentStatus: session.payment_status,
        customerEmail: session.customer_details?.email,
        amountTotal: session.amount_total,
        isGuest: isGuestCheckout
      });

      return NextResponse.json({
        success: true,
        paymentStatus: session.payment_status,
        customerDetails: session.customer_details,
        metadata: session.metadata,
        amountTotal: session.amount_total,
      });
    } else {
      console.log('❌ Payment not completed:', {
        sessionId,
        paymentStatus: session.payment_status
      });

      return NextResponse.json(
        { error: 'Payment not completed', paymentStatus: session.payment_status },
        { status: 400 }
      );
    }
    
  } catch (error) {
    console.error('Payment verification error:', error);
    return NextResponse.json(
      { error: 'Internal error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
