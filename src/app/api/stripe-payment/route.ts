import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import type { AuthenticatedUser } from '@/middleware/auth';

// Helper to check if user is admin
function isAdmin(email: string): boolean {
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
  return adminEmails.includes(email);
}

export const POST = withAuth(async (req: NextRequest, user: AuthenticatedUser) => {
  try {
    console.log('🔵 Stripe payment endpoint called');
    
    const body = await req.json();
    console.log('🔵 Request body received:', {
      hasAmount: !!body.amount,
      amount: body.amount,
      currency: body.currency,
      hasCustomerInfo: !!body.customerInfo,
      customerEmail: body.customerInfo?.email,
      liveMode: body.liveMode
    });
    
    const { amount, currency = 'eur', customerInfo, orderDetails } = body;

    // Validate required fields
    if (!amount || amount <= 0) {
      console.error('❌ Invalid amount:', amount);
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    if (!customerInfo?.email) {
      console.error('❌ Missing customer email');
      return NextResponse.json(
        { error: 'Missing customer email' },
        { status: 400 }
      );
    }

    // Security: User can only create payment for themselves (unless admin)
    if (customerInfo.email !== user.email && !isAdmin(user.email)) {
      return NextResponse.json(
        { error: 'Forbidden - You can only create payments for yourself' },
        { status: 403 }
      );
    }

    // Check environment variable
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    
    if (!stripeSecretKey) {
      console.error('❌ STRIPE_SECRET_KEY not found in environment');
      return NextResponse.json(
        { error: 'Stripe configuration error' },
        { status: 500 }
      );
    }

    console.log('🔵 Stripe config:', {
      keyPrefix: stripeSecretKey.substring(0, 8) + '...',
      keyType: stripeSecretKey.startsWith('sk_live_') ? 'live' : 'test',
      nodeEnv: process.env.NODE_ENV
    });
    
    // Import Stripe dynamically
    console.log('🔵 Importing Stripe...');
    const Stripe = (await import('stripe')).default;
    
    console.log('🔵 Creating Stripe instance...');
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-08-27.basil',
      timeout: 20000, // 20 seconds timeout
      maxNetworkRetries: 3,
    });

    // Create simple payment intent
    console.log('🔵 Creating payment intent...');
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount),
      currency,
      description: `WarmeLeads - €${(amount/100).toFixed(2)}`,
      metadata: {
        source: 'warmeleads_checkout',
        industry: orderDetails?.industry || 'unknown',
        leadType: orderDetails?.leadType || 'unknown',
        customerEmail: customerInfo.email,
      },
    });

    console.log('✅ Payment intent created successfully:', paymentIntent.id);

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
    
  } catch (error) {
    console.error('❌ Stripe payment error:', error);
    console.error('❌ Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack?.substring(0, 500) : null,
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    
    return NextResponse.json(
      { 
        error: 'Payment creation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
});
