import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * GET /api/admin/orders
 * 
 * Fetch all orders using SERVICE_ROLE key (bypasses RLS)
 * This is secure because it's server-side only
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Admin: Fetching all orders from Supabase...');
    
    const supabase = createServerClient();

    // Fetch all orders with customer data via JOIN
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *,
        customers (
          id,
          email,
          name,
          company,
          google_sheet_id,
          google_sheet_url
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching orders:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: error.message,
          code: error.code,
          hint: error.hint || 'Check Supabase credentials and RLS policies'
        },
        { status: 500 }
      );
    }

    console.log(`✅ Fetched ${orders?.length || 0} orders via SERVICE_ROLE`);
    
    // Transform snake_case to camelCase for frontend
    const transformedOrders = (orders || []).map((order: any) => ({
      id: order.id,
      orderNumber: order.order_number,
      customerId: order.customer_id,
      customerEmail: order.customer_email,
      customerName: order.customer_name,
      customerCompany: order.customer_company,
      packageId: order.package_id,
      packageName: order.package_name,
      industry: order.industry,
      leadType: order.lead_type,
      quantity: order.quantity,
      pricePerLead: order.price_per_lead,
      totalAmount: order.total_amount,
      vatAmount: order.vat_amount,
      totalAmountInclVAT: order.total_amount_incl_vat,
      vatPercentage: order.vat_percentage,
      currency: order.currency || 'EUR',
      status: order.status,
      paymentMethod: order.payment_method,
      paymentIntentId: order.payment_intent_id,
      sessionId: order.session_id,
      stripeSessionId: order.stripe_session_id,
      stripePaymentIntentId: order.stripe_payment_intent_id,
      invoiceNumber: order.invoice_number,
      invoiceUrl: order.invoice_url,
      leadsDelivered: order.leads_delivered || 0,
      conversions: order.conversions || 0,
      deliveredAt: order.delivered_at,
      createdAt: order.created_at,
      paidAt: order.paid_at,
      updatedAt: order.updated_at,
      // Include customer relation if exists
      customer: order.customers ? {
        id: order.customers.id,
        email: order.customers.email,
        name: order.customers.name,
        company: order.customers.company,
        googleSheetId: order.customers.google_sheet_id,
        googleSheetUrl: order.customers.google_sheet_url
      } : null
    }));

    const response = NextResponse.json({
      success: true,
      orders: transformedOrders,
      count: transformedOrders.length
    });

    // Prevent any caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;

  } catch (error: any) {
    console.error('💥 Server error fetching orders:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Unknown server error'
      },
      { status: 500 }
    );
  }
}

