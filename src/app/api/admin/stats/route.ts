import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * GET /api/admin/stats
 * 
 * Fetch admin dashboard statistics
 * - Total customers
 * - Total orders & revenue
 * - Active orders
 * - Conversion rate
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📊 Admin: Fetching dashboard stats...');
    
    const supabase = createServerClient();

    // Fetch all customers
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('id, created_at');

    if (customersError) {
      console.error('❌ Error fetching customers:', customersError);
      return NextResponse.json(
        { success: false, error: customersError.message },
        { status: 500 }
      );
    }

    // Fetch all orders
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, total_amount_incl_vat, status, created_at');

    if (ordersError) {
      console.error('❌ Error fetching orders:', ordersError);
      return NextResponse.json(
        { success: false, error: ordersError.message },
        { status: 500 }
      );
    }

    // Calculate stats
    const totalCustomers = customers?.length || 0;
    const totalOrders = orders?.length || 0;
    
    // Active orders (pending or completed, not delivered)
    const activeOrders = orders?.filter(
      o => o.status === 'pending' || o.status === 'completed'
    ).length || 0;

    // Total revenue (all non-cancelled orders)
    const totalRevenue = orders
      ?.filter(o => o.status !== 'cancelled')
      .reduce((sum, o) => sum + (o.total_amount_incl_vat || 0), 0) || 0;

    // Revenue this month
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const revenueThisMonth = orders
      ?.filter(o => {
        if (o.status === 'cancelled') return false;
        const orderDate = new Date(o.created_at);
        return orderDate >= firstDayOfMonth;
      })
      .reduce((sum, o) => sum + (o.total_amount_incl_vat || 0), 0) || 0;

    // Orders this month
    const ordersThisMonth = orders
      ?.filter(o => {
        const orderDate = new Date(o.created_at);
        return orderDate >= firstDayOfMonth;
      }).length || 0;

    // New customers this month
    const newCustomersThisMonth = customers
      ?.filter(c => {
        const createdDate = new Date(c.created_at);
        return createdDate >= firstDayOfMonth;
      }).length || 0;

    // Conversion rate (customers who placed order / total customers)
    const customersWithOrders = new Set(
      orders?.map(o => o.customer_id).filter(Boolean)
    ).size;
    const conversionRate = totalCustomers > 0 
      ? ((customersWithOrders / totalCustomers) * 100).toFixed(1)
      : '0.0';

    // Calculate trends (compare to last month)
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const firstDayOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const revenueLastMonth = orders
      ?.filter(o => {
        if (o.status === 'cancelled') return false;
        const orderDate = new Date(o.created_at);
        return orderDate >= lastMonth && orderDate < firstDayOfThisMonth;
      })
      .reduce((sum, o) => sum + (o.total_amount_incl_vat || 0), 0) || 0;

    const ordersLastMonth = orders
      ?.filter(o => {
        const orderDate = new Date(o.created_at);
        return orderDate >= lastMonth && orderDate < firstDayOfThisMonth;
      }).length || 0;

    const calculateTrend = (current: number, previous: number): string => {
      if (previous === 0) return current > 0 ? '+100%' : '+0%';
      const change = ((current - previous) / previous) * 100;
      return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
    };

    const stats = {
      totalCustomers,
      newCustomersThisMonth,
      totalOrders,
      activeOrders,
      ordersThisMonth,
      totalRevenue: Math.round(totalRevenue), // in cents
      revenueThisMonth: Math.round(revenueThisMonth), // in cents
      conversionRate: parseFloat(conversionRate),
      trends: {
        revenue: calculateTrend(revenueThisMonth, revenueLastMonth),
        orders: calculateTrend(ordersThisMonth, ordersLastMonth),
        customers: newCustomersThisMonth > 0 ? `+${newCustomersThisMonth}` : '0'
      }
    };

    console.log('✅ Admin stats calculated:', stats);

    const response = NextResponse.json({
      success: true,
      stats
    });

    // Prevent any caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;

  } catch (error: any) {
    console.error('💥 Server error fetching admin stats:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Unknown server error'
      },
      { status: 500 }
    );
  }
}

