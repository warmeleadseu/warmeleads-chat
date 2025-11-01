import { NextRequest, NextResponse } from 'next/server';
import { leadPackages, calculatePackagePrice } from '@/lib/stripe';
import { withAuth } from '@/middleware/auth';
import type { AuthenticatedUser } from '@/middleware/auth';

// Helper to check if user is admin
function isAdmin(email: string): boolean {
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
  return adminEmails.includes(email);
}

export const POST = withAuth(async (req: NextRequest, user: AuthenticatedUser) => {
  try {
    console.log('🔵 Creating Stripe Checkout Session...');
    
    const body = await req.json();
    const { 
      packageId, 
      quantity, 
      customerEmail,
      customerName,
      customerCompany,
      paymentMethod = 'card'
    } = body;

    // Find the package
    const allPackages = Object.values(leadPackages).flat();
    const selectedPackage = allPackages.find(pkg => pkg.id === packageId);
    
    if (!selectedPackage) {
      return NextResponse.json(
        { error: 'Package not found' },
        { status: 400 }
      );
    }

    // Basic validation
    if (!customerEmail) {
      return NextResponse.json(
        { error: 'Customer email is required' },
        { status: 400 }
      );
    }

    // Security: User can only create checkout for themselves (unless admin)
    if (customerEmail !== user.email && !isAdmin(user.email)) {
      return NextResponse.json(
        { error: 'Forbidden - You can only create checkout sessions for yourself' },
        { status: 403 }
      );
    }
    
    // Validate quantity for exclusive leads
    if (selectedPackage.type === 'exclusive') {
      const minQty = selectedPackage.minQuantity || 30;
      if (!quantity || quantity < minQty) {
        return NextResponse.json(
          { error: `Minimum ${minQty} leads required for exclusive packages` },
          { status: 400 }
        );
      }
    }
    
    // Calculate price with tiered pricing (EXCL VAT)
    const pricing = calculatePackagePrice(selectedPackage, quantity);
    const totalAmountExclVAT = pricing.totalPrice;
    
    // Calculate VAT (21%)
    const { calculateVAT } = await import('@/lib/vatCalculator');
    const vatBreakdown = calculateVAT(totalAmountExclVAT);
    const totalAmountInclVAT = vatBreakdown.amountInclVAT;

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: 'Stripe not configured' },
        { status: 500 }
      );
    }

    console.log('🔵 Creating checkout session for:', {
      packageId,
      packageName: selectedPackage.name,
      amountExclVAT: totalAmountExclVAT,
      vatAmount: vatBreakdown.vatAmount,
      amountInclVAT: totalAmountInclVAT,
      pricePerLead: pricing.pricePerLead,
      quantity,
      tierInfo: pricing.tierInfo,
      customerEmail
    });

    // Create product description with quantity and pricing info
    const productDescription = selectedPackage.type === 'exclusive'
      ? `${quantity} exclusieve leads voor ${selectedPackage.industry} - ${pricing.tierInfo}`
      : `${quantity} gedeelde leads voor ${selectedPackage.industry}`;

    // Create Stripe Checkout Session with multiple payment methods
    const checkoutData: Record<string, string> = {
      // Enable multiple payment methods for European customers
      'payment_method_types[0]': 'card',           // Credit/Debit cards
      'payment_method_types[1]': 'ideal',          // iDEAL (Netherlands)
      'payment_method_types[2]': 'bancontact',     // Bancontact (Belgium)
      // Note: PayPal and Klarna require activation in Stripe Dashboard
      // To enable: https://dashboard.stripe.com/account/payments/settings
      'mode': 'payment',
      'locale': 'nl',                               // Dutch locale to ensure NL payment methods show
      'billing_address_collection': 'required',     // Collect billing address to detect country
      'success_url': `${process.env.NEXT_PUBLIC_BASE_URL || 'https://www.warmeleads.eu'}/portal?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      'cancel_url': `${process.env.NEXT_PUBLIC_BASE_URL || 'https://www.warmeleads.eu'}/portal?payment=cancelled`,
      'customer_email': customerEmail,
      'line_items[0][price_data][currency]': selectedPackage.currency.toUpperCase(), // Ensure uppercase for payment methods compatibility
      'line_items[0][price_data][product_data][name]': `${selectedPackage.name} - ${quantity} leads`,
      'line_items[0][price_data][product_data][description]': productDescription,
      'line_items[0][price_data][unit_amount]': totalAmountInclVAT.toString(), // INCL VAT - what customer pays
      'line_items[0][quantity]': '1',
      'metadata[source]': 'warmeleads_portal',
      'metadata[packageId]': packageId,
      'metadata[industry]': selectedPackage.industry,
      'metadata[leadType]': selectedPackage.type,
      'metadata[leadQuantity]': quantity.toString(),
      'metadata[pricePerLead]': pricing.pricePerLead.toString(), // EXCL VAT per lead
      'metadata[totalAmountExclVAT]': totalAmountExclVAT.toString(),
      'metadata[vatAmount]': vatBreakdown.vatAmount.toString(),
      'metadata[vatPercentage]': '21',
      'metadata[customerName]': customerName || '',
      'metadata[customerEmail]': customerEmail,
      'metadata[customerCompany]': customerCompany || '',
      'metadata[orderQuantity]': quantity.toString(),
    };

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(checkoutData).toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Stripe Checkout Session error:', errorText);
      return NextResponse.json(
        { error: 'Checkout session creation failed', details: errorText },
        { status: 500 }
      );
    }

    const session = await response.json();
    
    console.log('✅ Checkout session created:', session.id);

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
    
  } catch (error) {
    console.error('❌ Checkout session error:', error);
    return NextResponse.json(
      { error: 'Internal error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
});
