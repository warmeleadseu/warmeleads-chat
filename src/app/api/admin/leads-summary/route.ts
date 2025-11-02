import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * GET /api/admin/leads-summary
 * 
 * Fetch summary of leads across all customers
 * Since leads are stored in Google Sheets, this shows per-customer aggregates
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📊 Admin: Fetching leads summary...');
    
    const supabase = createServerClient();

    // Fetch all customers with Google Sheets
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('id, email, name, company, google_sheet_url, google_sheet_id, created_at, status')
      .not('google_sheet_url', 'is', null)
      .order('created_at', { ascending: false });

    if (customersError) {
      console.error('❌ Error fetching customers:', customersError);
      return NextResponse.json(
        { success: false, error: customersError.message },
        { status: 500 }
      );
    }

    // Fetch all orders to get lead counts
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('customer_id, customer_email, quantity, industry, lead_type, status, created_at');

    if (ordersError) {
      console.error('❌ Error fetching orders:', ordersError);
      return NextResponse.json(
        { success: false, error: ordersError.message },
        { status: 500 }
      );
    }

    // Build customer lead summaries
    const leadSummaries = (customers || []).map(customer => {
      // Get orders for this customer
      const customerOrders = (orders || []).filter(
        o => o.customer_email === customer.email || o.customer_id === customer.id
      );

      // Calculate totals
      const totalLeadsOrdered = customerOrders.reduce(
        (sum, o) => sum + (o.quantity || 0), 
        0
      );

      const exclusiveLeads = customerOrders
        .filter(o => o.lead_type === 'exclusive')
        .reduce((sum, o) => sum + (o.quantity || 0), 0);

      const sharedLeads = customerOrders
        .filter(o => o.lead_type === 'shared')
        .reduce((sum, o) => sum + (o.quantity || 0), 0);

      // Get industries
      const industries = [...new Set(customerOrders.map(o => o.industry).filter(Boolean))];

      // Most recent order
      const lastOrder = customerOrders.length > 0
        ? customerOrders.sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0]
        : null;

      return {
        customerId: customer.id,
        customerEmail: customer.email,
        customerName: customer.name || customer.email,
        customerCompany: customer.company,
        googleSheetUrl: customer.google_sheet_url,
        hasSpreadsheet: !!customer.google_sheet_url,
        totalLeadsOrdered,
        exclusiveLeads,
        sharedLeads,
        industries,
        status: customer.status,
        orderCount: customerOrders.length,
        lastOrderDate: lastOrder?.created_at || null,
        createdAt: customer.created_at
      };
    });

    // Calculate aggregate stats
    const totalCustomersWithSheets = leadSummaries.length;
    const totalLeadsOrdered = leadSummaries.reduce(
      (sum, c) => sum + c.totalLeadsOrdered, 
      0
    );
    const totalExclusive = leadSummaries.reduce(
      (sum, c) => sum + c.exclusiveLeads, 
      0
    );
    const totalShared = leadSummaries.reduce(
      (sum, c) => sum + c.sharedLeads, 
      0
    );
    const customersWithOrders = leadSummaries.filter(c => c.orderCount > 0).length;

    const stats = {
      totalCustomersWithSheets,
      totalLeadsOrdered,
      totalExclusive,
      totalShared,
      customersWithOrders,
      averageLeadsPerCustomer: totalCustomersWithSheets > 0 
        ? (totalLeadsOrdered / totalCustomersWithSheets).toFixed(1)
        : '0'
    };

    console.log('✅ Leads summary calculated:', stats);

    const response = NextResponse.json({
      success: true,
      stats,
      leadSummaries: leadSummaries.sort((a, b) => b.totalLeadsOrdered - a.totalLeadsOrdered)
    });

    // Prevent any caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;

  } catch (error: any) {
    console.error('💥 Server error fetching leads summary:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Unknown server error'
      },
      { status: 500 }
    );
  }
}

