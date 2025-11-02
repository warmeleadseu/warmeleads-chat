import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * GET /api/admin/notifications
 * Fetch recent notifications/activity for admin
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔔 Admin: Fetching notifications...');
    
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    // Fetch recent orders (these are notifications)
    const { data: recentOrders, error: ordersError } = await supabase
      .from('orders')
      .select('id, order_number, customer_name, customer_email, total_amount_incl_vat, status, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (ordersError) {
      console.error('❌ Error fetching orders:', ordersError);
    }

    // Fetch recent customers
    const { data: recentCustomers, error: customersError } = await supabase
      .from('customers')
      .select('id, email, name, created_at, source')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (customersError) {
      console.error('❌ Error fetching customers:', customersError);
    }

    // Fetch recent chat activity
    const { data: recentChats, error: chatsError } = await supabase
      .from('chat_messages')
      .select('id, customer_email, message, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (chatsError) {
      console.error('❌ Error fetching chats:', chatsError);
    }

    // Combine and format notifications
    const notifications: any[] = [];

    // Add order notifications
    (recentOrders || []).forEach(order => {
      notifications.push({
        id: `order-${order.id}`,
        type: 'order',
        title: 'Nieuwe Bestelling',
        message: `${order.customer_name} heeft bestelling ${order.order_number} geplaatst`,
        amount: order.total_amount_incl_vat,
        status: order.status,
        timestamp: order.created_at,
        link: '/admin/orders',
        icon: '💰',
        priority: order.total_amount_incl_vat > 100000 ? 'high' : 'normal' // High priority for orders > €1000
      });
    });

    // Add customer notifications
    (recentCustomers || []).forEach(customer => {
      notifications.push({
        id: `customer-${customer.id}`,
        type: 'customer',
        title: 'Nieuwe Klant',
        message: `${customer.name || customer.email} heeft zich aangemeld`,
        source: customer.source,
        timestamp: customer.created_at,
        link: '/admin/customers',
        icon: '👤',
        priority: 'normal'
      });
    });

    // Add chat notifications (only unique users, not every message)
    const uniqueChatUsers = new Map();
    (recentChats || []).forEach(chat => {
      if (!uniqueChatUsers.has(chat.customer_email)) {
        uniqueChatUsers.set(chat.customer_email, {
          id: `chat-${chat.id}`,
          type: 'chat',
          title: 'Nieuwe Chat',
          message: `${chat.customer_email} heeft een gesprek gestart`,
          preview: chat.message.substring(0, 50) + (chat.message.length > 50 ? '...' : ''),
          timestamp: chat.created_at,
          link: '/admin/chats',
          icon: '💬',
          priority: 'low'
        });
      }
    });

    notifications.push(...Array.from(uniqueChatUsers.values()));

    // Sort by timestamp (newest first)
    notifications.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Calculate stats
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const stats = {
      total: notifications.length,
      last24h: notifications.filter(n => new Date(n.timestamp) >= last24Hours).length,
      unread: notifications.filter(n => new Date(n.timestamp) >= last24Hours).length, // Assume recent = unread
      byType: {
        orders: notifications.filter(n => n.type === 'order').length,
        customers: notifications.filter(n => n.type === 'customer').length,
        chats: notifications.filter(n => n.type === 'chat').length
      }
    };

    console.log('✅ Notifications fetched:', stats);

    const response = NextResponse.json({
      success: true,
      notifications: notifications.slice(0, limit),
      stats
    });

    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;

  } catch (error: any) {
    console.error('💥 Server error fetching notifications:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Unknown server error'
      },
      { status: 500 }
    );
  }
}

