import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * GET /api/admin/analytics
 * 
 * Fetch detailed analytics data for admin dashboard
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📊 Admin: Fetching analytics data...');
    
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30d';

    // Calculate date ranges
    const now = new Date();
    let startDate: Date;
    
    switch (timeRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Fetch customers
    const { data: allCustomers } = await supabase
      .from('customers')
      .select('id, created_at, source, status');

    const customers = allCustomers || [];
    const customersInRange = customers.filter(c => new Date(c.created_at) >= startDate);

    // Fetch orders
    const { data: allOrders } = await supabase
      .from('orders')
      .select('id, customer_id, total_amount_incl_vat, status, created_at, industry, lead_type, customer_email');

    const orders = allOrders || [];
    const ordersInRange = orders.filter(o => new Date(o.created_at) >= startDate);

    // Fetch chat messages
    const { data: chatMessages } = await supabase
      .from('chat_messages')
      .select('id, created_at, customer_email')
      .gte('created_at', startDate.toISOString());

    const messages = chatMessages || [];

    // Calculate overview metrics
    const totalRevenue = ordersInRange
      .filter(o => o.status !== 'cancelled')
      .reduce((sum, o) => sum + (o.total_amount_incl_vat || 0), 0);

    const completedOrders = ordersInRange.filter(o => 
      o.status === 'completed' || o.status === 'delivered'
    );

    const conversionRate = customersInRange.length > 0
      ? (completedOrders.length / customersInRange.length) * 100
      : 0;

    // Traffic sources (from customer source field)
    const trafficSources = customers.reduce((acc: any, customer) => {
      const source = customer.source || 'direct';
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    }, {});

    // Industry breakdown
    const industryData = ordersInRange.reduce((acc: any, order) => {
      const industry = order.industry || 'Onbekend';
      if (!acc[industry]) {
        acc[industry] = { count: 0, revenue: 0 };
      }
      acc[industry].count++;
      if (order.status !== 'cancelled') {
        acc[industry].revenue += order.total_amount_incl_vat || 0;
      }
      return acc;
    }, {});

    const industries = Object.entries(industryData)
      .map(([name, data]: [string, any]) => ({
        name,
        orders: data.count,
        revenue: data.revenue
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // Lead type breakdown
    const leadTypes = ordersInRange.reduce((acc: any, order) => {
      const type = order.lead_type || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    // Top customers (by revenue)
    const customerRevenue = ordersInRange
      .filter(o => o.status !== 'cancelled')
      .reduce((acc: any, order) => {
        const email = order.customer_email;
        if (!acc[email]) {
          acc[email] = { email, revenue: 0, orders: 0 };
        }
        acc[email].revenue += order.total_amount_incl_vat || 0;
        acc[email].orders++;
        return acc;
      }, {});

    const topCustomers = Object.values(customerRevenue)
      .sort((a: any, b: any) => b.revenue - a.revenue)
      .slice(0, 10);

    // Daily revenue trend (last 30 days for chart)
    const dailyRevenue: { [key: string]: number } = {};
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    ordersInRange
      .filter(o => o.status !== 'cancelled' && new Date(o.created_at) >= last30Days)
      .forEach(order => {
        const date = new Date(order.created_at).toISOString().split('T')[0];
        dailyRevenue[date] = (dailyRevenue[date] || 0) + (order.total_amount_incl_vat || 0);
      });

    const revenueChart = Object.entries(dailyRevenue)
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate trends (compare to previous period)
    const periodLength = now.getTime() - startDate.getTime();
    const previousStartDate = new Date(startDate.getTime() - periodLength);
    
    const previousCustomers = customers.filter(c => {
      const date = new Date(c.created_at);
      return date >= previousStartDate && date < startDate;
    });

    const previousOrders = orders.filter(o => {
      const date = new Date(o.created_at);
      return date >= previousStartDate && date < startDate;
    });

    const previousRevenue = previousOrders
      .filter(o => o.status !== 'cancelled')
      .reduce((sum, o) => sum + (o.total_amount_incl_vat || 0), 0);

    const calculateTrend = (current: number, previous: number): string => {
      if (previous === 0) return current > 0 ? '+100%' : '0%';
      const change = ((current - previous) / previous) * 100;
      return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
    };

    const analytics = {
      overview: {
        totalVisitors: customersInRange.length,
        totalLeads: ordersInRange.length,
        totalRevenue: Math.round(totalRevenue),
        conversionRate: conversionRate.toFixed(1),
        trends: {
          visitors: calculateTrend(customersInRange.length, previousCustomers.length),
          leads: calculateTrend(ordersInRange.length, previousOrders.length),
          revenue: calculateTrend(totalRevenue, previousRevenue),
          conversion: calculateTrend(conversionRate, previousCustomers.length > 0 ? (previousOrders.length / previousCustomers.length) * 100 : 0)
        }
      },
      traffic: {
        chat: trafficSources.chat || 0,
        website: trafficSources.website || 0,
        checkout: trafficSources.checkout || 0,
        direct: trafficSources.direct || 0,
        other: Object.entries(trafficSources)
          .filter(([key]) => !['chat', 'website', 'checkout', 'direct'].includes(key))
          .reduce((sum, [, val]) => sum + (val as number), 0)
      },
      leadTypes: {
        exclusive: leadTypes.exclusive || 0,
        shared: leadTypes.shared || 0
      },
      industries,
      topCustomers,
      revenueChart,
      chatActivity: {
        totalMessages: messages.length,
        uniqueUsers: new Set(messages.map(m => m.customer_email)).size,
        averagePerUser: messages.length > 0 ? (messages.length / new Set(messages.map(m => m.customer_email)).size).toFixed(1) : '0'
      }
    };

    console.log('✅ Analytics data calculated');

    const response = NextResponse.json({
      success: true,
      analytics,
      timeRange
    });

    // Prevent any caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;

  } catch (error: any) {
    console.error('💥 Server error fetching analytics:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Unknown server error'
      },
      { status: 500 }
    );
  }
}

