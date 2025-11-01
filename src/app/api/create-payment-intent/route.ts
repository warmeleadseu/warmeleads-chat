import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { withAuth } from '@/middleware/auth';
import type { AuthenticatedUser } from '@/middleware/auth';

// Helper to check if user is admin
function isAdmin(email: string): boolean {
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
  return adminEmails.includes(email);
}

export const POST = withAuth(async (req: NextRequest, user: AuthenticatedUser) => {
  try {
    const body = await req.json();
    
    const { amount, currency = 'eur', customerInfo, orderDetails, paymentMethod } = body;

    // Debug logging
    console.log('Payment intent request:', { amount, currency, customerInfo, orderDetails, paymentMethod, testMode: body.testMode });

    // Validate required fields
    if (!amount || amount <= 0 || !customerInfo?.name || !customerInfo?.email) {
      console.error('Validation failed:', { amount, customerInfo });
      return NextResponse.json(
        { error: 'Missing required fields or invalid amount' },
        { status: 400 }
      );
    }

    // Security: User can only create payment intent for themselves (unless admin)
    if (customerInfo.email !== user.email && !isAdmin(user.email)) {
      return NextResponse.json(
        { error: 'Forbidden - You can only create payments for yourself' },
        { status: 403 }
      );
    }

    // Create or retrieve customer
    let customer;
    const existingCustomers = await stripe.customers.list({
      email: customerInfo.email,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
    } else {
      customer = await stripe.customers.create({
        name: customerInfo.name,
        email: customerInfo.email,
        phone: customerInfo.phone,
        metadata: {
          company: customerInfo.company || '',
          source: 'WarmeLeads Chat',
        },
      });
    }

    // Create payment intent - simplified for debugging
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount),
      currency,
      metadata: {
        source: 'warmeleads_test',
        industry: orderDetails?.industry || 'test',
        leadType: orderDetails?.leadType || 'test',
      },
      description: `WarmeLeads Test Payment - €${(amount/100).toFixed(2)}`,
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error('Payment intent creation failed:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : null,
      type: error instanceof Error ? error.constructor.name : typeof error
    });
    
    return NextResponse.json(
      { 
        error: 'Failed to create payment intent',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
});

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
